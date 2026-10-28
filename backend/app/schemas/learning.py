from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LearningAttemptCreate(BaseModel):
    session_id: str = Field(min_length=1, max_length=36)
    question_id: str = Field(min_length=1, max_length=100)
    # Kept for compatibility with the current frontend; the backend verifies
    # the text against the generated question record before saving.
    question_text: str = Field(min_length=1)
    answer_text: str = Field(min_length=1)
    difficulty: str = Field(default="beginner", max_length=30)
    hint_count: int = Field(default=0, ge=0)
    hints_used: list[str] = Field(default_factory=list)


class LearningAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    session_id: str
    question_id: str
    question_text: str
    answer_text: str
    hint_count: int
    hints_used: list[str]
    score: float | None
    feedback: str | None
    strengths: list[str]
    improvements: list[str]
    difficulty: str
    created_at: datetime


class RubricCriterion(BaseModel):
    criterion: str
    max_score: int = Field(ge=1, le=10)


class GeneratedQuestion(BaseModel):
    question: str
    topic: str
    concept: str
    difficulty: Literal["beginner", "intermediate", "expert", "exceptional"]
    reference_answer: str
    rubric: list[RubricCriterion]


class GenerateQuestionRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=100)
    difficulty: Literal["beginner", "intermediate", "expert"] = "beginner"


class GenerateQuestionsRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=100)


# Student-facing generation response intentionally excludes reference answers
# and rubrics so the initial assessment cannot reveal the answer key.
class GeneratedQuestionForStudent(BaseModel):
    id: int
    question_number: int
    question: str
    topic: str
    concept: str
    difficulty: Literal["beginner", "intermediate", "expert", "exceptional"]


class GeneratedQuestionWithId(GeneratedQuestion):
    id: int
    question_number: int


class GenerateQuestionsResponse(BaseModel):
    session_id: str
    topic: str
    questions: list[GeneratedQuestionForStudent]


class ReportQuestion(BaseModel):
    id: int
    question_number: int
    question: str
    topic: str
    concept: str
    difficulty: str
    answer: str | None
    score: float | None
    feedback: str | None
    strengths: list[str]
    improvements: list[str]
    hint: str | None = None
    hints: list[str] = Field(default_factory=list)
    reference_answer: str | None = None


class LearningReportResponse(BaseModel):
    session_id: str
    topic: str
    exam_title: str
    completed_at: datetime | None
    questions_completed: int
    total_questions: int
    overall_score: float | None
    is_complete: bool
    evaluation_status: Literal["pending", "complete", "failed"]
    strengths: list[str]
    improvements: list[str]
    questions: list[ReportQuestion]


# Compatibility schema for any existing route that still imports this name.
class GeneratedQuestionRecordResponse(GeneratedQuestion):
    id: int
    session_id: str
    question_number: int


class HintRevealRequest(BaseModel):
    session_id: str
    question_id: str
    hint_number: int = Field(ge=1, le=5)
