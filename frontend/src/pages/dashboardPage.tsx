
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./dashboardPage.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type DashboardSession = {
  session_id: string;
  topic: string;
  completed_at: string | null;
  overall_score: number | null;
  questions_completed: number;
  total_questions: number;
};

type DashboardData = {
  sessions: DashboardSession[];
  sessions_completed: number;
  questions_answered: number;
  average_score: number | null;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [practiceTopic, setPracticeTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      const token = sessionStorage.getItem("access_token");

      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        setLoading(true);
        setError("");

        // This endpoint will be implemented in the backend next.
        const response = await fetch(
          `${API_BASE_URL}/api/learning/dashboard`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            signal: controller.signal,
          }
        );

        if (response.status === 401 || response.status === 403) {
          sessionStorage.removeItem("access_token");
          navigate("/login", { replace: true });
          return;
        }

        if (!response.ok) {
          throw new Error(
            "We couldn't load your dashboard. Please try again."
          );
        }

        const result = (await response.json()) as DashboardData;
        setData(result);
        console.log(result)
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;

        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong loading your dashboard."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadDashboard();

    return () => controller.abort();
  }, [navigate]);

  const sessions = (data?.sessions ?? []).filter(
  (session) =>
    session.completed_at !== null &&
    !Number.isNaN(Date.parse(session.completed_at))
);

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">INTELLIPREP</p>
          <h1>Your Dashboard</h1>
          <p>Track your technical interview preparation and progress.</p>
        </div>
      </header>

      <section className="dashboard-hero">
        
<section className="dashboard-hero">
  <div className="dashboard-hero-content">
    <p className="dashboard-eyebrow">YOUR NEXT STEP</p>
    <h2>Ready to practise?</h2>
  </div>

  <p className="dashboard-hero-description">
    Choose a technical stack and strengthen your knowledge with adaptive
    questions and personalised AI feedback.
  </p>

  <div className="dashboard-practice-form">
    <label htmlFor="practice-topic">Technical stack</label>
    <input
      id="practice-topic"
      type="text"
      value={practiceTopic}
      onChange={(event) => setPracticeTopic(event.target.value)}
      placeholder="e.g. Angular, Python, SQL"
    />
    <p className="dashboard-adaptive-note">
      <span aria-hidden="true">✦</span>
      Adaptive learning · Beginner to exceptional
    </p>
  </div>

  <button
    type="button"
    className="dashboard-primary-button"
    disabled={!practiceTopic.trim()}
    onClick={() =>
      navigate("/learning", {
        state: {
          topic: practiceTopic.trim(),
          difficulty: "adaptive",
          autoStart: true,
        },
      })
    }
  >
    Start a practice session <span aria-hidden="true">→</span>
  </button>
</section>

      </section>

      <section className="dashboard-stats" aria-label="Your performance">
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon" aria-hidden="true">▣</span>
          <p>Sessions completed</p>
          <strong>
            {loading ? "—" : data?.sessions_completed ?? 0}
          </strong>
        </article>

        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon" aria-hidden="true">◎</span>
          <p>Average score</p>
          <strong>
            {loading
              ? "—"
              : data?.average_score == null
                ? "—"
                : `${Math.round(data.average_score)}%`}
          </strong>
        </article>

        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon" aria-hidden="true">✓</span>
          <p>Questions answered</p>
          <strong>
            {loading ? "—" : data?.questions_answered ?? 0}
          </strong>
        </article>

        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon" aria-hidden="true">↗</span>
          <p>Practice history</p>
          <strong>{loading ? "—" : sessions.length}</strong>
        </article>
      </section>

      <section className="dashboard-history">
        <div className="dashboard-section-heading">
          <div>
            <h2>Recent Practice Sessions</h2>
            <p>Choose a session to review your report.</p>
          </div>
        </div>

        {loading ? (
          <div className="dashboard-state" role="status">
            Loading your practice sessions…
          </div>
        ) : error ? (
          <div className="dashboard-state dashboard-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="dashboard-state">
            <h3>No practice sessions yet</h3>
            <p>
              Complete your first assessment and it will appear here.
            </p>
            <Link to="/learning" className="dashboard-primary-button">
              Start practising <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <div className="dashboard-session-list">
            {sessions.map((session) => (
              <button
                type="button"
                className="dashboard-session-row"
                key={session.session_id}
                onClick={() =>
                  navigate(
                    `/report?session_id=${encodeURIComponent(session.session_id)}`
                  )
                }
                aria-label={`View report for ${session.topic}, completed ${
                  session.completed_at
                    ? new Date(session.completed_at).toLocaleString()
                    : "date unavailable"
                }`}
              >
                <span className="dashboard-session-topic">
                  <span className="dashboard-column-label">Stack</span>
                  <strong>{session.topic}</strong>
                </span>

                <span className="dashboard-session-date">
                  <span className="dashboard-column-label">Completed</span>
                  <strong>
                    {session.completed_at
                      ? new Date(session.completed_at).toLocaleString()
                      : "—"}
                  </strong>
                </span>

                <span className="dashboard-session-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
