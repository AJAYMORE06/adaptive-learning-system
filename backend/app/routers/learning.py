
import json
import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.dependencies.auth import get_current_user
from app.models.generatedQuestion import GeneratedQuestionRecord
from app.models.learningAttempt import LearningAttempt
from app.models.user import User
from app.schemas.learning import (
    GenerateQuestionRequest,
    GeneratedQuestion,
    GenerateQuestionsRequest,
    GenerateQuestionsResponse,
    GeneratedQuestionWithId,
    LearningAttemptCreate,
    LearningAttemptResponse,
)
from app.services.geminiService import generate_text


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/learning", tags=["Learning"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------
# Save a user's learning attempt
# --------------------------------------------------

@router.post(
    "/attempts",
    response_model=LearningAttemptResponse,
    status_code=status.HTTP_201_CREATED,
)
def save_learning_attempt(
    payload: LearningAttemptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    answer = payload.answer_text.strip()

    if not answer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide an answer before submitting.",
        )

    attempt = LearningAttempt(
        user_id=current_user.id,
        question_id=payload.question_id,
        question_text=payload.question_text,
        answer_text=answer,
        difficulty=payload.difficulty,
        hint_count=payload.hint_count,
        hints_used=payload.hints_used,
        score=None,
        feedback=None,
    )

    try:
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt

    except Exception:
        db.rollback()
        logger.exception("Failed to save learning attempt.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save your learning attempt. Please try again.",
        )


# --------------------------------------------------
# Generate one question
# --------------------------------------------------

@router.post(
    "/generate-question",
    response_model=GeneratedQuestion,
)
def generate_question(
    payload: GenerateQuestionRequest,
    current_user: User = Depends(get_current_user),
):
    prompt = f"""
You are a technical interview question generator for IntelliPrep.

Generate exactly one original technical interview question.

Topic: {payload.topic}
Difficulty: {payload.difficulty}

Return only a valid JSON object with these fields:
- question: a clear, unambiguous interview question
- topic: the requested topic
- concept: the specific concept being tested
- difficulty: exactly "{payload.difficulty}"
- reference_answer: a technically accurate expected answer
- rubric: an array of 3 to 5 criteria, each with:
    - criterion: what a good answer must demonstrate
    - max_score: integer from 1 to 10

Assess conceptual understanding, not exact wording.
Do not include Markdown fences or text outside the JSON.
"""

    try:
        raw_response = generate_text(prompt)
        data = json.loads(raw_response)

        question = GeneratedQuestion.model_validate(data)

        if not 3 <= len(question.rubric) <= 5:
            raise ValueError("Rubric must contain 3 to 5 criteria.")

        return question

    except (json.JSONDecodeError, ValidationError, ValueError):
        logger.exception("An invalid single-question response.")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="An invalid question. Please retry.",
        )

    except Exception:
        logger.exception("Single-question generation failed.")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Question generation failed. Please try again.",
        )


# --------------------------------------------------
# Generate and persist a 10-question session
# --------------------------------------------------

@router.post(
    "/generate-questions",
    response_model=GenerateQuestionsResponse,
)
def generate_questions(
    payload: GenerateQuestionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prompt = f"""
You are IntelliPrep, an expert technical interview question generator.

Generate exactly 10 original technical interview questions on:
{payload.topic}

Return ONLY a valid JSON array containing exactly 10 question objects.
Do not include Markdown fences, explanations, or text outside the JSON.

Each question must contain:
- question: a clear, technically accurate interview question
- topic: "{payload.topic}"
- concept: the specific concept being assessed
- difficulty: one of "beginner", "intermediate", "expert", "exceptional"
- reference_answer: a technically accurate model answer
- rubric: an array of 3 to 5 scoring criteria

Each rubric criterion must contain:
- criterion: a specific requirement of a good answer
- max_score: an integer between 1 and 10

The difficulty distribution must be EXACTLY:
- 3 beginner questions
- 3 intermediate questions
- 3 expert questions
- 1 exceptional question

Order the questions as follows:
1–3 beginner
4–6 intermediate
7–9 expert
10 exceptional

Requirements:
- Questions must be distinct and relevant to the topic.
- Difficulty must increase progressively.
- Reference answers must be accurate and sufficiently detailed.
- Rubric criteria must be specific and measurable.
- Use valid JSON syntax with double quotes.
- Do not include additional fields.
"""

    # Step 1: Generate and validate before writing anything to the database.
    try:
        raw_response = generate_text(prompt)
        data = json.loads(raw_response)

        if not isinstance(data, list) or len(data) != 10:
            raise ValueError("Expected exactly 10 questions.")

        questions = [
            GeneratedQuestion.model_validate(item)
            for item in data
        ]

        expected_counts = {
            "beginner": 3,
            "intermediate": 3,
            "expert": 3,
            "exceptional": 1,
        }

        actual_counts = {
            difficulty: sum(
                question.difficulty == difficulty
                for question in questions
            )
            for difficulty in expected_counts
        }

        if actual_counts != expected_counts:
            raise ValueError(
                f"Incorrect difficulty distribution: {actual_counts}"
            )

        for question in questions:
            if not 3 <= len(question.rubric) <= 5:
                raise ValueError(
                    "Each question must have 3 to 5 rubric criteria."
                )

    except (json.JSONDecodeError, ValidationError, ValueError):
        logger.exception("An invalid question set.")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "An invalid question set. "
                "Please try generating the questions again."
            ),
        )

    except Exception:
        logger.exception("Question generation failed.")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Question generation failed. Please try again.",
        )

    # Step 2: Create database records only after validation succeeds.
    session_id = str(uuid4())

    records = [
        GeneratedQuestionRecord(
            user_id=current_user.id,
            session_id=session_id,
            question_number=index,
            question=question.question,
            topic=question.topic,
            concept=question.concept,
            difficulty=question.difficulty,
            reference_answer=question.reference_answer,
            rubric=[
                criterion.model_dump()
                for criterion in question.rubric
            ],
        )
        for index, question in enumerate(questions, start=1)
    ]

    try:
        db.add_all(records)
        db.flush()

        # Capture database-generated IDs before committing.
        response_questions = [
            GeneratedQuestionWithId(
                id=record.id,
                question_number=record.question_number,
                question=record.question,
                topic=record.topic,
                concept=record.concept,
                difficulty=record.difficulty,
                reference_answer=record.reference_answer,
                rubric=record.rubric,
            )
            for record in records
        ]

        db.commit()

        return GenerateQuestionsResponse(
            session_id=session_id,
            topic=payload.topic,
            questions=response_questions,
        )

    except Exception:
        db.rollback()
        logger.exception(
            "Failed to save generated questions for user_id=%s.",
            current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save the generated questions. Please try again.",
        )
