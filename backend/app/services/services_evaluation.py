"""LLM answer evaluation helper for IntelliPrep.

The helper is intentionally independent of FastAPI so it can be tested.
The output score is normalised to 0-10 and should be interpreted as an
AI-assisted estimate, not a definitive judgement of a learner.
"""
import json
import logging
from pydantic import BaseModel, Field, ValidationError

from app.services.geminiService import generate_text

logger = logging.getLogger(__name__)


class AnswerEvaluation(BaseModel):
    score: float = Field(ge=0, le=10)
    feedback: str = Field(min_length=1, max_length=3000)
    strengths: list[str] = Field(default_factory=list, max_length=8)
    improvements: list[str] = Field(default_factory=list, max_length=8)
    hint: str = Field(min_length=1, max_length=1000)


def evaluate_answer(question: str, answer: str, reference_answer: str, rubric: list) -> AnswerEvaluation:
    prompt = f"""
You are an educational feedback assistant for a technical interview practice system.
Evaluate the learner's answer fairly against the question, reference answer and rubric.
Accept technically equivalent wording; do not require exact phrases.
Do not invent claims about the learner. Keep feedback specific and constructive.
Give a progressive hint that guides the learner without simply revealing the full answer.
Return ONLY valid JSON with keys:
- score: number from 0 to 10
- feedback: concise paragraph
- strengths: array of 1-4 concrete points (can be empty if none)
- improvements: array of 1-4 concrete points
- hint: one short guiding question or prompt, not the model answer

QUESTION:
{question}

LEARNER ANSWER:
{answer}

REFERENCE ANSWER (for evaluator only):
{reference_answer}

RUBRIC:
{json.dumps(rubric, ensure_ascii=False)}
"""
    try:
        raw = generate_text(prompt)
        # Tolerate accidental markdown fences without accepting arbitrary prose.
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3].strip()
        data = json.loads(cleaned)
        return AnswerEvaluation.model_validate(data)
    except (json.JSONDecodeError, ValidationError, ValueError) as exc:
        logger.exception("LLM returned an invalid answer evaluation")
        raise RuntimeError("AI evaluation returned an invalid response") from exc
