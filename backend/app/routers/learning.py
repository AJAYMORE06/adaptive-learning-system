import json
import logging
from collections import Counter, defaultdict
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.dependencies.auth import get_current_user
from app.models.generatedQuestion import GeneratedQuestionRecord
from app.models.learningAttempt import LearningAttempt
from app.models.user import User
from app.schemas.learning import (
    GeneratedQuestion,
    GeneratedQuestionForStudent,
    GenerateQuestionRequest,
    GenerateQuestionsRequest,
    GenerateQuestionsResponse,
    LearningAttemptCreate,
    LearningAttemptResponse,
    LearningReportResponse,
    ReportQuestion,
)
from app.services.geminiService import generate_text
from app.services.services_evaluation import evaluate_answer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/learning", tags=["Learning"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _parse_json_response(raw_response: str):
    cleaned = raw_response.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()
    return json.loads(cleaned)


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
            status_code=400, detail="Please provide an answer before submitting."
        )

    try:
        question_id = int(payload.question_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid question ID.") from None

    question = (
        db.query(GeneratedQuestionRecord)
        .filter(
            GeneratedQuestionRecord.id == question_id,
            GeneratedQuestionRecord.session_id == payload.session_id,
            GeneratedQuestionRecord.user_id == current_user.id,
        )
        .first()
    )
    if question is None:
        raise HTTPException(
            status_code=404, detail="Question was not found in this assessment session."
        )

    now = datetime.now(UTC)

    db.query(GeneratedQuestionRecord).filter(
        GeneratedQuestionRecord.user_id == current_user.id,
        GeneratedQuestionRecord.session_id == payload.session_id,
    ).update(
        {GeneratedQuestionRecord.last_activity_at: now},
        synchronize_session=False,
    )

    # Treat the database record as authoritative; don't trust question text or
    # difficulty sent by the browser.
    try:
        evaluation = evaluate_answer(
            question=question.question,
            answer=answer,
            reference_answer=question.reference_answer,
            rubric=question.rubric,
        )
    except RuntimeError:
        raise HTTPException(
            status_code=502,
            detail=(
                "Your answer could not be evaluated right now. Please retry submission."
            ),
        ) from None
    except Exception:
        logger.exception("Answer evaluation failed for question_id=%s", question_id)
        raise HTTPException(
            status_code=502,
            detail="AI evaluation is temporarily unavailable. Please try again.",
        ) from None

    attempt = LearningAttempt(
        user_id=current_user.id,
        session_id=payload.session_id,
        question_id=str(question.id),
        question_text=question.question,
        answer_text=answer,
        difficulty=question.difficulty,
        hint_count=payload.hint_count,
        hints_used=payload.hints_used,
        score=float(evaluation.score),
        feedback=evaluation.feedback,
        strengths=evaluation.strengths,
        improvements=evaluation.improvements,
        learning_hint=evaluation.hint,
    )

    try:
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "An answer for this question has already been saved in this session."
            ),
        ) from None
    except Exception:
        db.rollback()
        logger.exception("Failed to save learning attempt.")
        raise HTTPException(
            status_code=500,
            detail="Failed to save your learning attempt. Please try again.",
        ) from None


@router.post("/generate-question", response_model=GeneratedQuestionForStudent)
def generate_question(
    payload: GenerateQuestionRequest,
    current_user: User = Depends(get_current_user),
):

    prompt = f"""
    You are a technical interview question generator for IntelliPrep,
    an AI-powered personalised technical interview preparation system.

    OBJECTIVE:
    Generate exactly one original, clear, technically accurate technical
    interview question for the specified topic and difficulty.

    INPUTS:
    Topic: {payload.topic}
    Difficulty: {payload.difficulty}

    QUESTION GENERATION RULES:

    1. Generate exactly one interview question relevant to the specified topic.
    2. Match the question's complexity, expected depth, and required reasoning
    to the requested difficulty: beginner, intermediate, or expert.
    3. Beginner questions should assess foundational knowledge and basic
    understanding.
    4. Intermediate questions should assess practical application,
    problem-solving, and relationships between concepts.
    5. Expert questions should assess deeper technical reasoning, trade-offs,
    edge cases, system behaviour, or advanced problem-solving, as appropriate
    to the topic.
    6. Avoid ambiguous questions. Include sufficient context to make clear
    what the candidate is expected to explain or solve.
    7. Ensure the question is technically meaningful and suitable for a
    technical interview.
    8. Avoid duplicate, trivial, excessively broad, or unnecessarily complex
    questions.
    9. Do not invent technical facts, APIs, language features, or requirements.
    10. Do not include the answer in the question itself.
    11. Use the requested topic as the primary subject. The concept field must
        identify the specific technical concept being assessed.
    12. The difficulty field must match the requested difficulty exactly.

    REFERENCE ANSWER REQUIREMENTS:

    1. Provide a technically accurate model answer that directly addresses
    the question.
    2. Include the key concepts and reasoning needed for a strong answer.
    3. Keep the answer proportionate to the question and difficulty level.
    4. For coding questions, include an explanation or code where appropriate.
    5. Do not include irrelevant details or unsupported claims.
    6. The reference answer is for evaluation purposes and must not be
    included in the question text.

    RUBRIC REQUIREMENTS:

    1. Provide 3 to 5 distinct assessment criteria.
    2. Each criterion must contain exactly these fields:
    - criterion: a specific, assessable requirement.
    - max_score: an integer from 1 to 10.
    3. Criteria must measure different aspects of the answer without
    unnecessary overlap.
    4. Criteria must align with the question and reference answer.
    5. Criteria must reward technical correctness and relevant reasoning,
    rather than exact wording.
    6. Make each criterion specific enough to support consistent scoring.
    7. The sum of all max_score values must equal 10.
    8. Do not include criteria that cannot reasonably be assessed from
    the learner's response.

    OUTPUT REQUIREMENTS:

    Return only one valid JSON object with exactly these fields:
    - question: string
    - topic: string
    - concept: string
    - difficulty: string
    - reference_answer: string
    - rubric: array of 3 to 5 objects

    Each rubric object must contain:
    - criterion: string
    - max_score: integer

    Additional constraints:
    - Use valid JSON syntax with double-quoted keys and string values.
    - Escape quotation marks, backslashes, and special characters correctly.
    - Do not include Markdown fences, comments, or text outside the JSON.
    - Do not add extra fields.
    - Ensure all fields contain meaningful values.
    - Ensure the rubric scores sum to exactly 10.
    """

    try:
        data = _parse_json_response(generate_text(prompt))
        question = GeneratedQuestion.model_validate(data)
        if not 3 <= len(question.rubric) <= 5:
            raise ValueError("Rubric must contain 3 to 5 criteria.")
        # This endpoint does not persist a question, so id and question_number
        # are set to a sentinel for schema consistency. If this route is used
        # in the UI, consider creating a persisted session for it instead.
        return {
            "id": 0,
            "question_number": 1,
            "question": question.question,
            "topic": question.topic,
            "concept": question.concept,
            "difficulty": question.difficulty,
        }
    except (json.JSONDecodeError, ValidationError, ValueError):
        logger.exception("Gemini returned an invalid single-question response.")
        raise HTTPException(
            status_code=502, detail="Gemini returned an invalid question. Please retry."
        ) from None
    except Exception:
        logger.exception("Single-question generation failed.")
        raise HTTPException(
            status_code=502, detail="Question generation failed. Please try again."
        ) from None


@router.post("/generate-questions", response_model=GenerateQuestionsResponse)
def generate_questions(
    payload: GenerateQuestionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prompt = f"""
You are IntelliPrep, an expert technical interview question generator.

Generate exactly 10 original technical interview questions on the following input topic:
{payload.topic}

Return ONLY a valid JSON array containing exactly 10 question objects.
Each object must have exactly these fields:
question, topic, concept, difficulty, reference_answer, rubric.

IMPORTANT FIELD RULES:
- "topic" MUST always be exactly "{payload.topic}".
- Never use a subtopic or specific technical concept as the value of "topic".
- "concept" must identify the specific technical concept being tested by the question.
- All 10 questions must use the same input topic.
- Generate questions across relevant concepts within the input topic.
- Do not confuse the topic with the concept.

DIFFICULTY DISTRIBUTION:
- Questions 1-3: beginner
- Questions 4-6: intermediate
- Questions 7-9: expert
- Question 10: exceptional

RUBRIC REQUIREMENTS:
- Each rubric must contain 3 to 5 criteria.
- Each criterion must be an object with:
  - "criterion": a clear evaluation criterion.
  - "max_score": an integer between 1 and 10, inclusive.
- Ensure every question has a valid rubric.

QUALITY REQUIREMENTS:
- Questions must be distinct, technically accurate, relevant to the input topic,
  and progressively harder.
- Reference answers must be technically accurate and sufficiently detailed
  to support evaluation.
- Every question must have a non-empty concept.
- Ensure the JSON is valid and all 10 questions follow these requirements.

Before returning the response, verify that:
1. Exactly 10 questions are present.
2. Every question's "topic" equals "{payload.topic}".
3. The difficulty distribution is correct.
4. Every rubric contains 3 to 5 criteria.

Return ONLY the JSON array.
Do not include Markdown fences, explanations, or extra fields.
"""
    try:
        data = _parse_json_response(generate_text(prompt))
        if not isinstance(data, list) or len(data) != 10:
            raise ValueError("Expected exactly 10 questions.")
        questions = [GeneratedQuestion.model_validate(item) for item in data]
        for question in questions:
            question.topic = payload.topic
        expected_counts = {
            "beginner": 3,
            "intermediate": 3,
            "expert": 3,
            "exceptional": 1,
        }
        actual_counts = Counter(question.difficulty for question in questions)
        if dict(actual_counts) != expected_counts:
            raise ValueError(
                f"Incorrect difficulty distribution: {dict(actual_counts)}"
            )
        if any(not 3 <= len(question.rubric) <= 5 for question in questions):
            raise ValueError("Each question must have 3 to 5 rubric criteria.")
    except (json.JSONDecodeError, ValidationError, ValueError):
        logger.exception("Gemini returned an invalid question set.")
        raise HTTPException(
            status_code=502,
            detail="An invalid question set. Please try generating questions again.",
        ) from None
    except Exception:
        logger.exception("Gemini question generation failed.")
        raise HTTPException(
            status_code=502, detail="Question generation failed. Please try again."
        ) from None

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
            rubric=[criterion.model_dump() for criterion in question.rubric],
        )
        for index, question in enumerate(questions, start=1)
    ]

    try:
        db.add_all(records)
        db.flush()
        response_questions = [
            {
                "id": record.id,
                "question_number": record.question_number,
                "question": record.question,
                "topic": record.topic,
                "concept": record.concept,
                "difficulty": record.difficulty,
            }
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
            status_code=500,
            detail="Failed to save generated questions. Please try again.",
        ) from None


def _safe_list(value):
    return value if isinstance(value, list) else []


@router.get("/reports/{session_id}", response_model=LearningReportResponse)
def get_learning_report(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    generated = (
        db.query(GeneratedQuestionRecord)
        .filter(
            GeneratedQuestionRecord.session_id == session_id,
            GeneratedQuestionRecord.user_id == current_user.id,
        )
        .order_by(GeneratedQuestionRecord.question_number.asc())
        .all()
    )
    if not generated:
        raise HTTPException(status_code=404, detail="Assessment session not found.")

    attempts = (
        db.query(LearningAttempt)
        .filter(
            LearningAttempt.session_id == session_id,
            LearningAttempt.user_id == current_user.id,
        )
        .all()
    )
    attempt_by_question = {str(item.question_id): item for item in attempts}
    completed_count = sum(1 for q in generated if str(q.id) in attempt_by_question)
    total_questions = len(generated)
    is_complete = total_questions > 0 and completed_count == total_questions

    evaluated_scores = [
        float(attempt_by_question[str(q.id)].score)
        for q in generated
        if str(q.id) in attempt_by_question
        and attempt_by_question[str(q.id)].score is not None
    ]
    all_evaluated = is_complete and len(evaluated_scores) == total_questions
    overall_score = (
        round((sum(evaluated_scores) / len(evaluated_scores)) * 10, 1)
        if all_evaluated and evaluated_scores
        else None
    )

    # Do not reveal per-question feedback or answer keys until all 10 answers
    # have been submitted and evaluated.
    unlock_feedback = is_complete and all_evaluated
    strengths, improvements, report_questions = [], [], []

    for q in generated:
        attempt = attempt_by_question.get(str(q.id))
        if unlock_feedback and attempt:
            strengths.extend(_safe_list(attempt.strengths))
            improvements.extend(_safe_list(attempt.improvements))

        report_questions.append(
            ReportQuestion(
                id=q.id,
                question_number=q.question_number,
                question=q.question,
                topic=q.topic,
                concept=q.concept,
                difficulty=q.difficulty,
                answer=attempt.answer_text if attempt else None,
                score=float(attempt.score)
                if unlock_feedback and attempt and attempt.score is not None
                else None,
                feedback=attempt.feedback if unlock_feedback and attempt else None,
                strengths=_safe_list(attempt.strengths)
                if unlock_feedback and attempt
                else [],
                improvements=_safe_list(attempt.improvements)
                if unlock_feedback and attempt
                else [],
                hint=attempt.learning_hint if unlock_feedback and attempt else None,
                reference_answer=q.reference_answer if unlock_feedback else None,
            )
        )

    return LearningReportResponse(
        session_id=session_id,
        topic=generated[0].topic,
        exam_title=f"{generated[0].topic} Technical Interview",
        completed_at=max((a.created_at for a in attempts), default=None)
        if is_complete
        else None,
        questions_completed=completed_count,
        total_questions=total_questions,
        overall_score=overall_score,
        is_complete=is_complete,
        evaluation_status="complete" if unlock_feedback else "pending",
        strengths=list(dict.fromkeys(strengths))[:8],
        improvements=list(dict.fromkeys(improvements))[:8],
        questions=report_questions,
    )


@router.get("/dashboard")
def get_learning_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Retrieve this user's generated questions.
    generated_questions = (
        db.query(GeneratedQuestionRecord)
        .filter(GeneratedQuestionRecord.user_id == current_user.id)
        .order_by(GeneratedQuestionRecord.question_number.asc())
        .all()
    )

    # Group generated questions by session.
    questions_by_session = defaultdict(list)

    for question in generated_questions:
        questions_by_session[question.session_id].append(question)

    # Retrieve this user's submitted answers.
    attempts = (
        db.query(LearningAttempt)
        .filter(LearningAttempt.user_id == current_user.id)
        .order_by(LearningAttempt.created_at.desc())
        .all()
    )

    attempts_by_session = defaultdict(list)

    for attempt in attempts:
        attempts_by_session[attempt.session_id].append(attempt)

    # Include generated sessions even if the user has not answered yet.
    session_ids = set(questions_by_session) | set(attempts_by_session)

    sessions = []

    for session_id in session_ids:
        questions = questions_by_session.get(session_id, [])
        session_attempts = attempts_by_session.get(session_id, [])

        topic = questions[0].topic if questions else "Technical interview"
        total_questions = len(questions)

        # A session is completed when all generated questions have answers.
        completed_question_ids = {attempt.question_id for attempt in session_attempts}

        completed_count = sum(
            1 for question in questions if str(question.id) in completed_question_ids
        )

        # Calculate scores from evaluated answers only.
        scored_attempts = [
            attempt for attempt in session_attempts if attempt.score is not None
        ]

        average_score = (
            sum(attempt.score for attempt in scored_attempts) / len(scored_attempts)
            if scored_attempts
            else None
        )

        is_complete = total_questions > 0 and completed_count >= total_questions

        sessions.append(
            {
                "session_id": session_id,
                "topic": topic,
                "completed_at": (
                    max(
                        (attempt.created_at for attempt in session_attempts),
                        default=None,
                    ).isoformat()
                    if is_complete and session_attempts
                    else None
                ),
                "overall_score": (
                    round(average_score * 10, 1) if average_score is not None else None
                ),
                "questions_completed": completed_count,
                "total_questions": total_questions,
                "is_complete": is_complete,
            }
        )

    # Most recently active sessions first.
    allSessions = sessions

    sessions.sort(
        key=lambda item: item["completed_at"] or "",
        reverse=True,
    )

    completed_sessions = [session for session in sessions if session["is_complete"]]

    all_scored_attempts = [attempt for attempt in attempts if attempt.score is not None]

    average_score = (
        sum(attempt.score for attempt in all_scored_attempts)
        / len(all_scored_attempts)
        * 10
        if all_scored_attempts
        else None
    )

    return {
        "sessions_completed": len(completed_sessions),
        "questions_answered": len(attempts),
        "average_score": (
            round(average_score, 1) if average_score is not None else None
        ),
        "sessions": allSessions,
    }
