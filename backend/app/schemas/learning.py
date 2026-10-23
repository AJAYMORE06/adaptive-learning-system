
from pydantic import BaseModel, Field, ConfigDict
from typing import Literal
from datetime import datetime


class LearningAttemptCreate(BaseModel):
    question_id: str = Field(min_length=1, max_length=100)
    question_text: str = Field(min_length=1)
    answer_text: str = Field(min_length=1)
    difficulty: str = Field(default="easy", max_length=30)
    hint_count: int = Field(default=0, ge=0)
    hints_used: list[str] = Field(default_factory=list)


class LearningAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    question_id: str
    question_text: str
    answer_text: str
    hint_count: int
    hints_used: list[str]
    score: float | None
    feedback: str | None
    difficulty: str
    created_at: object


class GenerateQuestionRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=100)
    difficulty: Literal["beginner", "intermediate", "expert"] = "beginner"


class RubricCriterion(BaseModel):
    criterion: str
    max_score: int = Field(ge=1, le=10)


class GeneratedQuestion(BaseModel):
    question: str
    topic: str
    concept: str
    difficulty: Literal["beginner", "intermediate", "expert", "exceptional",]
    reference_answer: str
    rubric: list[RubricCriterion]


class GenerateQuestionRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=100)
    difficulty: Literal[
        "beginner",
        "intermediate",
        "expert",
    ] = "beginner"


class GeneratedQuestion(BaseModel):
    question: str
    topic: str
    concept: str
    difficulty: Literal[
        "beginner",
        "intermediate",
        "expert",
        "exceptional",
    ]
    reference_answer: str
    rubric: list[RubricCriterion]


class GenerateQuestionsRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=100)


class GeneratedQuestionRecordResponse(GeneratedQuestion):
    id: int
    session_id: str
    question_number: int

class GenerateQuestionsRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=100)


class GeneratedQuestionWithId(GeneratedQuestion):
    id: int
    question_number: int


class GenerateQuestionsResponse(BaseModel):
    session_id: str
    topic: str
    questions: list[GeneratedQuestionWithId]