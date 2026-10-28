from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_admin
from app.models.generatedQuestion import GeneratedQuestionRecord
from app.models.learningAttempt import LearningAttempt
from app.models.user import User
from app.models.userFeedback import UserFeedback

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
    dependencies=[Depends(get_current_admin)],
)


def _session_summary(
    user_id: int,
    session_id: str,
    db: Session,
) -> dict[str, Any] | None:
    questions = (
        db.query(GeneratedQuestionRecord)
        .filter(
            GeneratedQuestionRecord.user_id == user_id,
            GeneratedQuestionRecord.session_id == session_id,
        )
        .order_by(GeneratedQuestionRecord.question_number)
        .all()
    )

    if not questions:
        return None

    attempts = (
        db.query(LearningAttempt)
        .filter(
            LearningAttempt.user_id == user_id,
            LearningAttempt.session_id == session_id,
        )
        .all()
    )

    attempts_by_question = {attempt.question_id: attempt for attempt in attempts}

    scores = [
        attempts_by_question[q.id].score
        for q in questions
        if q.id in attempts_by_question and attempts_by_question[q.id].score is not None
    ]

    answered_count = len(attempts_by_question)
    total_questions = len(questions)

    is_complete = total_questions > 0 and answered_count >= total_questions

    last_activity_at = max(q.last_activity_at for q in questions)

    if last_activity_at.tzinfo is None:
        last_activity_at = last_activity_at.replace(tzinfo=UTC)

    if is_complete:
        status = "Completed"
    elif datetime.now(UTC) - last_activity_at >= timedelta(minutes=30):
        status = "Abandoned"
    else:
        status = "In Progress"

    return {
        "session_id": session_id,
        "topic": questions[0].topic,
        "started_at": min(q.created_at for q in questions),
        "total_questions": total_questions,
        "questions_answered": answered_count,
        "is_complete": is_complete,
        "status": status,
        "average_score": (round(sum(scores) / len(scores), 2) if scores else None),
        "overall_score": (
            round(sum(scores) / len(scores) * 10, 2)
            if scores
            and answered_count >= total_questions
            and len(scores) == total_questions
            else None
        ),
    }


@router.get("/sessions")
def get_admin_sessions(
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    session_rows = (
        db.query(
            GeneratedQuestionRecord.user_id,
            GeneratedQuestionRecord.session_id,
        )
        .distinct()
        .all()
    )

    results = []

    for user_id, session_id in session_rows:
        summary = _session_summary(user_id, session_id, db)

        if summary is None:
            continue

        user = db.get(User, user_id)

        results.append(
            {
                **summary,
                "user_id": user_id,
                "student_name": user.full_name if user else "Unknown",
                "student_email": user.email if user else None,
            }
        )

    results.sort(
        key=lambda item: item["started_at"],
        reverse=True,
    )

    return results


@router.get("/feedback")
def get_admin_feedback(
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    feedback_entries = (
        db.query(UserFeedback).order_by(UserFeedback.submitted_at.desc()).all()
    )

    results = []

    for item in feedback_entries:
        user = db.get(User, item.user_id)

        results.append(
            {
                "id": item.id,
                "user_id": item.user_id,
                "student_name": user.full_name if user else "Unknown",
                "student_email": user.email if user else None,
                "rating": item.rating,
                "ease_of_use": item.ease_of_use,
                "hint_usefulness": item.hint_usefulness,
                "recommendation": item.recommendation,
                "improvements": item.improvements,
                "submitted_at": item.submitted_at,
            }
        )

    return results


@router.get("/overview")
def get_admin_overview(
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    total_users = db.query(User).count()

    session_rows = (
        db.query(
            GeneratedQuestionRecord.user_id,
            GeneratedQuestionRecord.session_id,
        )
        .distinct()
        .all()
    )
    sessions = [
        _session_summary(user_id, session_id, db)
        for user_id, session_id in session_rows
    ]
    sessions = [session for session in sessions if session is not None]

    total_answers = db.query(LearningAttempt).count()

    scored_attempts = (
        db.query(LearningAttempt.score).filter(LearningAttempt.score.isnot(None)).all()
    )
    scores = [row[0] for row in scored_attempts]

    return {
        "total_users": total_users,
        "total_sessions": len(sessions),
        "completed_sessions": sum(1 for session in sessions if session["is_complete"]),
        "total_answers": total_answers,
        "average_question_score": (
            round(sum(scores) / len(scores), 2) if scores else None
        ),
    }


@router.get("/users")
def get_admin_users(
    search: str | None = Query(default=None, max_length=200),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    query = db.query(User)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter((User.full_name.ilike(term)) | (User.email.ilike(term)))

    users = query.order_by(User.created_at.desc()).all()
    results = []

    for user in users:
        session_rows = (
            db.query(GeneratedQuestionRecord.session_id)
            .filter(GeneratedQuestionRecord.user_id == user.id)
            .distinct()
            .all()
        )

        summaries = [_session_summary(user.id, row[0], db) for row in session_rows]
        summaries = [item for item in summaries if item is not None]

        user_attempts = (
            db.query(LearningAttempt).filter(LearningAttempt.user_id == user.id).all()
        )
        scored = [
            attempt.score for attempt in user_attempts if attempt.score is not None
        ]

        results.append(
            {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "created_at": user.created_at,
                "session_count": len(summaries),
                "completed_sessions": sum(
                    1 for item in summaries if item["is_complete"]
                ),
                "questions_answered": len(user_attempts),
                "average_question_score": (
                    round(sum(scored) / len(scored), 2) if scored else None
                ),
            }
        )

    return results


@router.get("/users/{user_id}/sessions")
def get_user_sessions(
    user_id: int,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    session_rows = (
        db.query(GeneratedQuestionRecord.session_id)
        .filter(GeneratedQuestionRecord.user_id == user_id)
        .distinct()
        .all()
    )

    sessions = [_session_summary(user_id, row[0], db) for row in session_rows]

    return sorted(
        [session for session in sessions if session is not None],
        key=lambda session: session["started_at"],
        reverse=True,
    )


@router.get("/users/{user_id}/report")
def get_student_report(
    user_id: int,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    questions = (
        db.query(GeneratedQuestionRecord)
        .filter(GeneratedQuestionRecord.user_id == user_id)
        .order_by(
            GeneratedQuestionRecord.created_at,
            GeneratedQuestionRecord.question_number,
        )
        .all()
    )

    attempts = (
        db.query(LearningAttempt)
        .filter(LearningAttempt.user_id == user_id)
        .order_by(LearningAttempt.created_at)
        .all()
    )

    # Match an answer to its generated question within the same session.
    attempts_by_question = {
        (attempt.session_id, attempt.question_id): attempt for attempt in attempts
    }

    sessions_by_id: dict[str, dict[str, Any]] = {}

    for question in questions:
        session_id = question.session_id

        if session_id not in sessions_by_id:
            sessions_by_id[session_id] = {
                "session_id": session_id,
                "topic": question.topic,
                "started_at": question.created_at,
                "questions": [],
            }

        attempt = attempts_by_question.get((session_id, str(question.id)))

        sessions_by_id[session_id]["questions"].append(
            {
                "question_id": str(question.id),
                "question_number": question.question_number,
                "question": question.question,
                "topic": question.topic,
                "concept": question.concept,
                "difficulty": question.difficulty,
                "reference_answer": question.reference_answer,
                "rubric": question.rubric,
                "answered": attempt is not None,
                "answer": attempt.answer_text if attempt else None,
                "score": attempt.score if attempt else None,
                "feedback": attempt.feedback if attempt else None,
                "strengths": attempt.strengths if attempt else [],
                "improvements": attempt.improvements if attempt else [],
                "learning_hint": attempt.learning_hint if attempt else None,
                "hints_used": attempt.hints_used if attempt else [],
                "hint_count": attempt.hint_count if attempt else 0,
                "submitted_at": attempt.created_at if attempt else None,
            }
        )

    scored_attempts = [
        attempt.score for attempt in attempts if attempt.score is not None
    ]

    return {
        "student": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "created_at": user.created_at,
        },
        "summary": {
            "total_sessions": len(sessions_by_id),
            "questions_answered": len(attempts),
            "average_question_score": (
                round(sum(scored_attempts) / len(scored_attempts), 2)
                if scored_attempts
                else None
            ),
        },
        "sessions": list(sessions_by_id.values()),
    }


@router.get("/sessions/{session_id}/report")
def get_admin_session_report(
    session_id: str,
    user_id: int,
    db: Session = Depends(get_db),
):
    questions = (
        db.query(GeneratedQuestionRecord)
        .filter(
            GeneratedQuestionRecord.session_id == session_id,
            GeneratedQuestionRecord.user_id == user_id,
        )
        .order_by(GeneratedQuestionRecord.question_number)
        .all()
    )

    if not questions:
        raise HTTPException(
            status_code=404,
            detail="Session report not found.",
        )

    attempts = (
        db.query(LearningAttempt)
        .filter(
            LearningAttempt.session_id == session_id,
            LearningAttempt.user_id == user_id,
        )
        .all()
    )

    # Assumption: question_id stores the GeneratedQuestionRecord.id.
    # Verify this against your answer-submission code before relying on it.
    attempts_by_question = {str(attempt.question_id): attempt for attempt in attempts}

    report_questions = []

    for question in questions:
        attempt = attempts_by_question.get(str(question.id))

        learning_hints = (
            attempt.learning_hints
            if attempt and attempt.learning_hints
            else ([attempt.learning_hint] if attempt and attempt.learning_hint else [])
        )

        report_questions.append(
            {
                "question_id": str(question.id),
                "question_number": question.question_number,
                "question": question.question,
                "concept": question.concept,
                "difficulty": question.difficulty,
                "answered": attempt is not None,
                "answer": attempt.answer_text if attempt else None,
                "score": attempt.score if attempt else None,
                "feedback": attempt.feedback if attempt else None,
                "strengths": attempt.strengths if attempt else [],
                "improvements": attempt.improvements if attempt else [],
                "learning_hint": attempt.learning_hint if attempt else None,
                "learning_hints": learning_hints,
                "total_hints": (
                    attempt.total_hints
                    if attempt and attempt.total_hints
                    else len(learning_hints)
                ),
                "hint_count": attempt.hint_count if attempt else 0,
                "hints_used": attempt.hints_used if attempt else [],
            }
        )

    scored_values = [q["score"] for q in report_questions if q["score"] is not None]

    average_score = sum(scored_values) / len(scored_values) if scored_values else None

    answered_count = sum(1 for q in report_questions if q["answered"])

    overall_score = (
        average_score * 10
        if answered_count == len(questions) and len(scored_values) == len(questions)
        else None
    )

    user = db.query(User).filter(User.id == user_id).first()

    return {
        "session_id": session_id,
        "user_id": user_id,
        "student_name": (
            getattr(user, "name", None)
            or getattr(user, "full_name", None)
            or getattr(user, "email", None)
            or "Unknown student"
        )
        if user
        else "Unknown student",
        "topic": questions[0].topic,
        "started_at": questions[0].created_at,
        "total_questions": len(questions),
        "questions_answered": answered_count,
        "average_score": average_score,
        "overall_score": overall_score,
        "questions": report_questions,
    }
