// 1) Add session_id to the POST /api/learning/attempts body:
body: JSON.stringify({
  session_id: sessionId,
  question_id: String(currentQuestion.id),
  question_text: currentQuestion.question,
  answer_text: answer.trim(),
  difficulty: currentQuestion.difficulty,
  hint_count: hintsUsed.length,
  hints_used: hintsUsed,
})

// 2) After the final question submission succeeds:
navigate(`/report?session_id=${encodeURIComponent(sessionId)}`);

// 3) Make sure your generated-question TypeScript type does NOT require or
// expose reference_answer/rubric in the initial assessment response.
