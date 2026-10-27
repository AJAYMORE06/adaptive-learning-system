import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./reportPage.css";

type Difficulty = "beginner" | "intermediate" | "expert" | "exceptional" | string;

type QuestionResult = {
  id: string | number;
  question_number?: number;
  difficulty: Difficulty;
  question: string;
  score: number | null;
  answer: string;
  feedback: string | null;
  strengths: string[];
  improvements: string[];
  hint?: string | null;
  reference_answer?: string | null;
};

type ReportData = {
  session_id: string;
  topic: string;
  exam_title?: string;
  completed_at?: string | null;
  questions_completed: number;
  total_questions: number;
  overall_score: number | null;
  questions: QuestionResult[];
  strengths?: string[];
  improvements?: string[];
  is_complete?: boolean;
  evaluation_status?: "pending" | "complete" | "failed" | string;
};

const API_BASE_URL = "http://localhost:8000";

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  easy: "Beginner",
  intermediate: "Intermediate",
  medium: "Intermediate",
  expert: "Expert",
  hard: "Expert",
  exceptional: "Exceptional",
};

function labelDifficulty(value: string) {
  return DIFFICULTY_LABELS[value.toLowerCase()] ?? value;
}

function scoreLabel(score: number) {
  if (score >= 8) return "Strong";
  if (score >= 6) return "Developing";
  return "Needs improvement";
}

function scoreClass(score: number) {
  if (score >= 8) return "score-strong";
  if (score >= 6) return "score-developing";
  return "score-low";
}

function toList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export default function ReportPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedAnswers, setExpandedAnswers] = useState<string[]>([]);
  const [expandedHints, setExpandedHints] = useState<string[]>([]);
  const [expandedModels, setExpandedModels] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      setLoading(true);
      setError("");

      if (!sessionId) {
        setReport(null);
        setError("No assessment session was selected. Open a report from a completed assessment.");
        setLoading(false);
        return;
      }

      const token = sessionStorage.getItem("access_token");
      if (!token) {
        setReport(null);
        setError("Your session has expired. Please sign in again to view this report.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/learning/reports/${encodeURIComponent(sessionId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("This report is not available yet, or the session could not be found.");
          }
          if (response.status === 401 || response.status === 403) {
            throw new Error("You are not authorised to view this report. Please sign in again.");
          }
          throw new Error("We couldn't load this report. Please try again in a moment.");
        }

        const raw = await response.json();
        const rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];

        const normalized: ReportData = {
          session_id: String(raw.session_id ?? sessionId),
          topic: String(raw.topic ?? "Technical interview"),
          exam_title: raw.exam_title,
          completed_at: raw.completed_at ?? null,
          questions_completed: Number(raw.questions_completed ?? raw.completed_questions ?? rawQuestions.length),
          total_questions: Number(raw.total_questions ?? rawQuestions.length),
          overall_score:
            typeof raw.overall_score === "number" ? raw.overall_score : null,
          is_complete: Boolean(raw.is_complete ?? raw.completed ?? false),
          evaluation_status: raw.evaluation_status ?? "pending",
          strengths: toList(raw.strengths),
          improvements: toList(raw.improvements),
          questions: rawQuestions.map((item: Record<string, unknown>, index: number) => ({
            id: String(item.id ?? item.question_id ?? index + 1),
            question_number: Number(item.question_number ?? index + 1),
            difficulty: String(item.difficulty ?? "beginner"),
            question: String(item.question ?? item.question_text ?? "Question text unavailable"),
            score: typeof item.score === "number" ? item.score : null,
            answer: String(item.answer ?? item.answer_text ?? ""),
            feedback: typeof item.feedback === "string" ? item.feedback : null,
            strengths: toList(item.strengths),
            improvements: toList(item.improvements),
            hint: typeof item.hint === "string" ? item.hint : null,
            reference_answer:
              typeof item.reference_answer === "string" ? item.reference_answer : null,
          })),
        };

        if (!cancelled) setReport(normalized);
      } catch (caught) {
        if (!cancelled) {
          setReport(null);
          setError(caught instanceof Error ? caught.message : "Something went wrong while loading the report.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const questions = report?.questions ?? [];
  const filteredQuestions = useMemo(
    () =>
      filter === "all"
        ? questions
        : questions.filter((item) => item.difficulty.toLowerCase() === filter),
    [filter, questions]
  );

  const scoredQuestions = questions.filter(
    (item): item is QuestionResult & { score: number } => typeof item.score === "number"
  );
  const averageScore = scoredQuestions.length
    ? scoredQuestions.reduce((sum, item) => sum + item.score, 0) / scoredQuestions.length
    : null;
  const overallScore = report?.overall_score ?? null;

  const allStrengths = useMemo(() => {
    const supplied = report?.strengths ?? [];
    return supplied.length
      ? supplied
      : [...new Set(questions.flatMap((item) => item.strengths))].slice(0, 5);
  }, [report?.strengths, questions]);

  const allImprovements = useMemo(() => {
    const supplied = report?.improvements ?? [];
    return supplied.length
      ? supplied
      : [...new Set(questions.flatMap((item) => item.improvements))].slice(0, 5);
  }, [report?.improvements, questions]);

  function toggleItem(id: string, current: string[], setter: (next: string[]) => void) {
    setter(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const evaluationComplete =
    report?.evaluation_status === "complete" ||
    (questions.length > 0 && scoredQuestions.length === questions.length);

  return (
    <main className="report-page">
      <header className="report-header">
        <Link to="/dashboard" className="report-back-link">
          <span aria-hidden="true">←</span> Dashboard
        </Link>
        <p className="report-eyebrow">INTELLIPREP / PERFORMANCE</p>
        <div className="report-title-row">
          <div>
            <h1>Your evaluation report</h1>
            <p>
              Review your answers, understand your knowledge gaps, and discover
              what to practise next.
            </p>
          </div>
          {report?.is_complete && (
            <span className="report-completed-badge">
              <span aria-hidden="true">✓</span> Assessment completed
            </span>
          )}
        </div>
      </header>

      {loading ? (
        <section className="report-state-card" aria-live="polite">
          <span className="report-loading-mark" aria-hidden="true" />
          <h2>Loading your report</h2>
          <p>We're retrieving the results for this assessment session.</p>
        </section>
      ) : error ? (
        <section className="report-state-card report-error-card" role="alert">
          <span className="report-state-icon" aria-hidden="true">!</span>
          <h2>Report unavailable</h2>
          <p>{error}</p>
          <Link to="/dashboard" className="report-primary-button">Return to the Dashboard <span aria-hidden="true">→</span></Link>
        </section>
      ) : report ? (
        <>
          <section className="report-session-meta" aria-label="Assessment details">
            <div>
              <span className="report-stat-label">Topic</span>
              <strong>{report.exam_title || `${report.topic} technical interview`}</strong>
            </div>
            {report.completed_at && (
              <div>
                <span className="report-stat-label">Completed</span>
                <strong>{new Date(report.completed_at).toLocaleString()}</strong>
              </div>
            )}
          </section>

          <section className="report-overview" aria-label="Assessment summary">
            <article className="report-score-card report-score-primary">
              <span className="report-stat-label">Overall score</span>
              <div className="report-score-value">
                {overallScore === null ? "—" : Math.round(overallScore)}
                <span>{overallScore === null ? "" : "%"}</span>
              </div>
              <div
                className="report-progress-track"
                role="progressbar"
                aria-label="Overall score"
                aria-valuenow={overallScore === null ? 0 : Math.round(overallScore)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="report-progress-fill" style={{ width: `${overallScore === null ? 0 : Math.max(0, Math.min(100, overallScore))}%` }} />
              </div>
              <span className="report-stat-caption">
                {overallScore === null ? "Score appears after AI evaluation" : "Based on your evaluated answers"}
              </span>
            </article>

            <article className="report-stat-card">
              <span className="report-stat-icon" aria-hidden="true">✓</span>
              <span className="report-stat-label">Questions completed</span>
              <strong>{report.questions_completed}<span> / {report.total_questions}</span></strong>
              <span className="report-stat-caption">In this assessment session</span>
            </article>

            <article className="report-stat-card">
              <span className="report-stat-icon" aria-hidden="true">◈</span>
              <span className="report-stat-label">Average question score</span>
              <strong>{averageScore === null ? "—" : `${averageScore.toFixed(1)} / 10`}</strong>
              <span className="report-stat-caption">
                {averageScore === null ? "Evaluation is pending" : `${scoredQuestions.length} answers evaluated`}
              </span>
            </article>
          </section>

          {!report.is_complete && (
            <section className="report-notice" role="status">
              <strong>Assessment in progress</strong>
              <p>This report may be incomplete until all questions have been submitted.</p>
            </section>
          )}

          {!evaluationComplete && (
            <section className="report-notice report-pending-notice" role="status">
              <strong>AI evaluation pending</strong>
              <p>Your submitted answers are available below. Scores and feedback will appear when the evaluation service has finished processing them.</p>
            </section>
          )}

          <section className="report-insights">
            <div className="report-section-heading">
              <div>
                <p className="report-eyebrow">YOUR NEXT STEPS</p>
                <h2>Performance overview</h2>
              </div>
            </div>
            <div className="report-insight-grid">
              <article className="report-insight-card">
                <div className="report-insight-heading">
                  <span className="report-insight-symbol strength-symbol">+</span>
                  <h3>Strengths</h3>
                </div>
                {allStrengths.length ? (
                  <ul className="report-insight-list">{allStrengths.map((item) => <li key={item}>{item}</li>)}</ul>
                ) : (
                  <p>Strengths will be summarised here after your answers have been evaluated.</p>
                )}
                <span className="report-insight-note">Keep building on concepts you understand well.</span>
              </article>
              <article className="report-insight-card">
                <div className="report-insight-heading">
                  <span className="report-insight-symbol improve-symbol">↗</span>
                  <h3>Areas to improve</h3>
                </div>
                {allImprovements.length ? (
                  <ul className="report-insight-list">{allImprovements.map((item) => <li key={item}>{item}</li>)}</ul>
                ) : (
                  <p>Targeted recommendations will appear here when AI feedback is available.</p>
                )}
                <span className="report-insight-note">Use the question review to plan your next practice session.</span>
              </article>
            </div>
          </section>

          <section className="report-questions">
            <div className="report-section-heading report-question-heading">
              <div>
                <p className="report-eyebrow">DETAILED REVIEW</p>
                <h2>Question-by-question feedback</h2>
                <p className="report-section-description">
                  Explore your submitted answers and any evaluation feedback available for this session.
                </p>
              </div>
              <label className="report-filter">
                <span>Difficulty</span>
                <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                  <option value="all">All levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="expert">Expert</option>
                  <option value="exceptional">Exceptional</option>
                </select>
              </label>
            </div>

            {filteredQuestions.length === 0 ? (
              <div className="report-empty-questions">
                <h3>No questions to display</h3>
                <p>{questions.length ? "Try choosing a different difficulty level." : "Question results will appear here when the report contains submitted answers."}</p>
              </div>
            ) : (
              <div className="report-question-list">
                {filteredQuestions.map((item, index) => {
                  const id = String(item.id);
                  const answerOpen = expandedAnswers.includes(id);
                  const hintOpen = expandedHints.includes(id);
                  const modelOpen = expandedModels.includes(id);
                  const score = item.score;
                  return (
                    <article className="report-question-card" key={id}>
                      <div className="report-question-topline">
                        <span className="report-question-number">QUESTION {item.question_number ?? index + 1}</span>
                        <div className="report-question-badges">
                          <span className="report-difficulty">{labelDifficulty(item.difficulty)}</span>
                          {score === null ? (
                            <span className="report-score-badge score-pending">Evaluation pending</span>
                          ) : (
                            <span className={`report-score-badge ${scoreClass(score)}`}>{score}/10 · {scoreLabel(score)}</span>
                          )}
                        </div>
                      </div>
                      <h3 className="report-question-title">{item.question}</h3>
                      {score !== null && (
                        <div className="report-question-score-track" role="progressbar" aria-label={`Question ${item.question_number ?? index + 1} score`} aria-valuenow={score * 10} aria-valuemin={0} aria-valuemax={100}>
                          <div className={`report-question-score-fill ${scoreClass(score)}`} style={{ width: `${Math.max(0, Math.min(100, score * 10))}%` }} />
                        </div>
                      )}

                      <div className="report-answer-section">
                        <button type="button" className="report-disclosure" aria-expanded={answerOpen} onClick={() => toggleItem(id, expandedAnswers, setExpandedAnswers)}>
                          <span>Your submitted answer</span><span aria-hidden="true">{answerOpen ? "−" : "+"}</span>
                        </button>
                        {answerOpen && <p className="report-submitted-answer">{item.answer.trim() || "No answer was submitted for this question."}</p>}
                      </div>

                      <div className="report-feedback">
                        <h4>AI feedback</h4>
                        <p>{item.feedback || "Feedback will appear here after this answer has been evaluated."}</p>
                      </div>

                      <div className="report-feedback-grid">
                        <div>
                          <h4 className="report-strength-title">What went well</h4>
                          {item.strengths.length ? <ul>{item.strengths.map((strength) => <li key={strength}>{strength}</li>)}</ul> : <p className="report-list-empty">Not available yet.</p>}
                        </div>
                        <div>
                          <h4 className="report-improvement-title">What to improve</h4>
                          {item.improvements.length ? <ul>{item.improvements.map((improvement) => <li key={improvement}>{improvement}</li>)}</ul> : <p className="report-list-empty">Not available yet.</p>}
                        </div>
                      </div>

                      {report.is_complete && evaluationComplete && item.hint && (
                        <div className="report-hint">
                          <button type="button" className="report-hint-toggle" aria-expanded={hintOpen} onClick={() => toggleItem(id, expandedHints, setExpandedHints)}>
                            <span className="report-hint-icon" aria-hidden="true">✦</span>
                            <span className="report-hint-label"><strong>Learning hint</strong><small>A prompt to help you strengthen your answer</small></span>
                            <span className="report-hint-action">{hintOpen ? "Hide hint −" : "Show hint +"}</span>
                          </button>
                          {hintOpen && <p className="report-hint-content">{item.hint}</p>}
                        </div>
                      )}

                      {report.is_complete && evaluationComplete && item.reference_answer && (
                        <div className="report-answer-section report-model-answer">
                          <button type="button" className="report-disclosure" aria-expanded={modelOpen} onClick={() => toggleItem(id, expandedModels, setExpandedModels)}>
                            <span>Model answer</span><span aria-hidden="true">{modelOpen ? "−" : "+"}</span>
                          </button>
                          {modelOpen && <p className="report-submitted-answer">{item.reference_answer}</p>}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <footer className="report-footer">
            <div>
              <h2>Ready to practise again?</h2>
              <p>Use these insights to strengthen your answers in your next IntelliPrep session.</p>
              <p className="retest-status">Each practice session should be saved separately so your progress can be compared over time.</p>
            </div>
            <div className="report-footer-actions">
              <Link
      to="/learning"
      state={{
        topic: report.topic,
        difficulty: "adaptive",
        autoStart: true,
      }}
      className="report-primary-button"
    >
      Practise Again <span aria-hidden="true">→</span>
    </Link>
            </div>
          </footer>
        </>
      ) : null}
    </main>
  );
}
