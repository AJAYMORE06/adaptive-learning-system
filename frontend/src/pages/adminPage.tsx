import { useEffect, useState } from "react";
import "./adminPage.css";

type SessionStatus = "Completed" | "In Progress" | "Abandoned";

interface SessionReport {
  session_id: string;
  user_id: number;
  student_name: string;
  topic: string;
  started_at: string;
  total_questions: number;
  questions_answered: number;
  average_score: number | null;
  overall_score: number | null;
  questions: {
    question_id: string;
    question_number: number;
    question: string;
    concept: string;
    difficulty: string;
    answered: boolean;
    answer: string | null;
    score: number | null;
    feedback: string | null;
    strengths: string[];
    improvements: string[];
    learning_hint: string[] | null;
    learning_hints: string[];
    total_hints: number;
    hint_count: number;
    hints_used: number[];
  }[];
}

interface AdminOverview {
  total_users: number;
  total_sessions: number;
  completed_sessions: number;
  total_answers: number;
  average_question_score: number;
}

interface AdminStudent {
  id: number;
  full_name: string;
  email: string;
  created_at: string;
  session_count: number;
  completed_sessions: number;
  questions_answered: number;
  average_question_score: number | null;
}

interface AdminSession {
  session_id: string;
  topic: string;
  started_at: string;
  total_questions: number;
  questions_answered: number;
  is_complete: boolean;
  average_score: number | null;
  overall_score: number | null;
  status: SessionStatus;
}

interface AdminFeedback {
  id: number;
  user_id: number;
  student_name: string;
  student_email: string | null;
  rating: number;
  ease_of_use: string;
  hint_usefulness: string;
  recommendation: string;
  improvements: string | null;
  submitted_at: string;
}

interface AdminAllSession extends AdminSession {
  user_id: number;
  student_name: string;
  student_email: string | null;
  status: "Completed" | "In Progress" | "Abandoned";
}

const navigation = [
  { label: "Overview", icon: "▦", id: "overview" },
  { label: "Students", icon: "♙", id: "students" },
  { label: "Sessions", icon: "▤", id: "sessions" },
  { label: "Feedback", icon: "☷", id: "feedback" },
];

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<AdminStudent | null>(null);

  const [studentSessions, setStudentSessions] = useState<AdminSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");

  const [allSessions, setAllSessions] = useState<AdminAllSession[]>([]);
  const [allSessionsLoading, setAllSessionsLoading] = useState(false);
  const [allSessionsError, setAllSessionsError] = useState("");

  const [feedbackEntries, setFeedbackEntries] = useState<AdminFeedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [sessionReport, setSessionReport] = useState<SessionReport | null>(null);

  const [sessionReportLoading, setSessionReportLoading] = useState(false);

  const [sessionReportError, setSessionReportError] = useState("");

  const handleLogout = () => {
    sessionStorage.removeItem("access_token");
    window.location.href = "/login";
  };

  const averageFeedbackRating =
    feedbackEntries.length > 0
      ? (
          feedbackEntries.reduce((sum, item) => sum + item.rating, 0) / feedbackEntries.length
        ).toFixed(1)
      : "—";

  useEffect(() => {
    const token = sessionStorage.getItem("access_token");

    if (!token) {
      setError("No login token found. Please log in again.");
      setLoading(false);
      return;
    }

    fetch("/api/admin/overview", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const body = await response.json();

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${body.detail ?? "Request failed"}`);
        }

        setOverview(body as AdminOverview);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeSection === "students") {
      void loadStudents(searchTerm);
    } else if (activeSection === "sessions") {
      void loadAllSessions();
    } else if (activeSection === "feedback") {
      void loadFeedback();
    }
  }, [activeSection]);

  const metrics = [
    {
      label: "Total students",
      value: overview?.total_users,
      icon: "♙",
      color: "blue",
      description: "Registered users",
    },
    {
      label: "Total sessions",
      value: overview?.total_sessions,
      icon: "▤",
      color: "purple",
      description: "Learning sessions created",
    },
    {
      label: "Completed sessions",
      value: overview?.completed_sessions,
      icon: "✓",
      color: "green",
      description: "Sessions completed",
    },
    {
      label: "Answers submitted",
      value: overview?.total_answers,
      icon: "☷",
      color: "orange",
      description: "Answers recorded",
    },
  ];

  function selectSection(id: string) {
    setActiveSection(id);
    setMenuOpen(false);
  }

  async function loadStudents(search = "") {
    const token = sessionStorage.getItem("access_token");

    if (!token) {
      setStudentsError("No login token found. Please log in again.");
      return;
    }

    setStudentsLoading(true);
    setStudentsError("");

    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const query = params.toString();
      const response = await fetch(`/api/admin/users${query ? `?${query}` : ""}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.detail ?? `Request failed (${response.status})`);
      }

      if (!Array.isArray(body)) {
        throw new Error("Unexpected response from the students API.");
      }

      setStudents(body as AdminStudent[]);
    } catch (err) {
      setStudentsError(err instanceof Error ? err.message : "Unable to load students.");
    } finally {
      setStudentsLoading(false);
    }
  }

  async function loadStudentSessions(student: AdminStudent) {
    const token = sessionStorage.getItem("access_token");

    if (!token) {
      setSessionsError("No login token found. Please log in again.");
      return;
    }

    setSelectedStudent(student);
    setStudentSessions([]);
    setSessionsLoading(true);
    setSessionsError("");

    try {
      const response = await fetch(`/api/admin/users/${student.id}/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.detail ?? `Request failed (${response.status})`);
      }

      if (!Array.isArray(body)) {
        throw new Error("Unexpected response from the sessions API.");
      }

      setStudentSessions(body as AdminSession[]);
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Unable to load sessions.");
    } finally {
      setSessionsLoading(false);
    }
  }

  async function fetchAdminData<T>(path: string): Promise<T> {
    const token = sessionStorage.getItem("access_token");

    if (!token) {
      throw new Error("No login token found. Please log in again.");
    }

    const response = await fetch(path, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.detail ?? `Request failed (${response.status})`);
    }

    return body as T;
  }

  async function loadAllSessions() {
    setAllSessionsLoading(true);
    setAllSessionsError("");

    try {
      const data = await fetchAdminData<AdminAllSession[]>("/api/admin/sessions");
      setAllSessions(data);
    } catch (err) {
      setAllSessionsError(err instanceof Error ? err.message : "Unable to load sessions.");
    } finally {
      setAllSessionsLoading(false);
    }
  }

  async function loadFeedback() {
    setFeedbackLoading(true);
    setFeedbackError("");

    try {
      const data = await fetchAdminData<AdminFeedback[]>("/api/admin/feedback");
      setFeedbackEntries(data);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : "Unable to load feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function loadSessionReport(sessionId: string, userId: number) {
    setSessionReport(null);
    setSessionReportError("");
    setSessionReportLoading(true);

    try {
      const report = await fetchAdminData<SessionReport>(
        `/api/admin/sessions/${encodeURIComponent(sessionId)}/report?user_id=${userId}`
      );

      setSessionReport(report);
    } catch (err) {
      setSessionReportError(err instanceof Error ? err.message : "Unable to load session report.");
    } finally {
      setSessionReportLoading(false);
    }
  }

  return (
    <div className="admin-layout">
      {menuOpen && (
        <button
          className="admin-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`admin-sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="admin-brand">
          <div className="brand-icon">I</div>
          <div>
            <strong>IntelliPrep</strong>
            <span>ADMIN CONSOLE</span>
          </div>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="admin-navigation" aria-label="Admin navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeSection === item.id ? "nav-active" : ""}`}
              onClick={() => selectSection(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {activeSection === item.id && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="admin-profile">
            <div className="profile-avatar">A</div>
            <div className="profile-details">
              <strong>Administrator</strong>
            </div>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <button
            className="menu-toggle"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            ☰
          </button>

          <div className="breadcrumb">
            <span>Admin</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{navigation.find((item) => item.id === activeSection)?.label}</strong>
          </div>

          <div className="admin-header">
            <button type="button" className="logout-button" onClick={handleLogout}>
              <span aria-hidden="true">↪</span>
              Logout
            </button>
          </div>
        </header>

        <div className="admin-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">INTELLIPREP / ADMINISTRATION</div>
              <h1>{navigation.find((item) => item.id === activeSection)?.label}</h1>
              <p>Monitor student activity and learning progress across IntelliPrep.</p>
            </div>
          </section>

          {error && (
            <div className="admin-error" role="alert">
              <strong>Unable to load dashboard</strong>
              <p>{error}</p>
              <button onClick={() => window.location.reload()}>Try again</button>
            </div>
          )}

          {activeSection === "overview" && !error && (
            <>
              <section className="metrics-grid" aria-label="Overview metrics">
                {metrics.map((metric) => (
                  <article className="metric-card" key={metric.label}>
                    <div className="metric-card-top">
                      <span className="metric-label">{metric.label}</span>
                      <span className={`metric-icon ${metric.color}`}>{metric.icon}</span>
                    </div>

                    <div className="metric-value">
                      {loading ? (
                        <span className="loading-value">—</span>
                      ) : (
                        (metric.value ?? 0).toLocaleString()
                      )}
                    </div>

                    <div className="metric-description">{metric.description}</div>
                  </article>
                ))}
              </section>

              <section className="learning-outcomes">
                <div className="learning-outcomes__header">
                  <div>
                    <h2>Before &amp; After Learning Outcomes</h2>
                    <p>
                      Compare technical interview performance before and after using IntelliPrep.
                    </p>
                  </div>
                  <span className="learning-outcomes__badge">Study outcomes</span>
                </div>

                <div className="learning-outcomes__grid">
                  <article className="learning-outcomes__card">
                    <span className="learning-outcomes__label">Pre-assessment average</span>
                    <div className="learning-outcomes__score">
                      <span>—</span>
                      <small>/ 10</small>
                    </div>
                    <p>Before using IntelliPrep</p>
                  </article>

                  <article className="learning-outcomes__card">
                    <span className="learning-outcomes__label">Post-assessment average</span>
                    <div className="learning-outcomes__score">
                      <span>—</span>
                      <small>/ 10</small>
                    </div>
                    <p>After using IntelliPrep</p>
                  </article>

                  <article className="learning-outcomes__card learning-outcomes__card--change">
                    <span className="learning-outcomes__label">Score improvement</span>
                    <div className="learning-outcomes__score">
                      <span>—</span>
                      <small>points</small>
                    </div>
                    <p>Post-assessment average minus pre-assessment average</p>
                  </article>
                </div>

                <div className="learning-outcomes__note">
                  <strong>Awaiting study data</strong>
                  <p>
                    Results will appear when participants have completed both assessments and their
                    scores have been recorded.
                  </p>
                </div>
              </section>
            </>
          )}

          {activeSection === "students" && !error && (
            <section className="students-section">
              <div className="students-toolbar">
                <div>
                  <h2>Student directory</h2>
                  <p>Review registered students and their learning activity.</p>
                </div>

                <div className="student-search">
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSearchTerm(value);
                      void loadStudents(value);
                    }}
                    placeholder="Search name or email..."
                    aria-label="Search students by name or email"
                  />
                </div>
              </div>

              {studentsError && (
                <div className="admin-error" role="alert">
                  {studentsError}
                  <button onClick={() => void loadStudents(searchTerm)}>Retry</button>
                </div>
              )}

              {sessionReport && (
                <div className="session-report-overlay" onClick={() => setSessionReport(null)}>
                  <section
                    className="session-report-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="session-report-title"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="panel-heading">
                      <div>
                        <h2 id="session-report-title">{sessionReport.topic} — Session Report</h2>
                        <p>
                          {sessionReport.student_name} ·{" "}
                          {new Date(sessionReport.started_at).toLocaleString()}
                        </p>
                      </div>

                      <button
                        className="student-details-button"
                        onClick={() => setSessionReport(null)}
                        aria-label="Close session report"
                      >
                        ✕ Close
                      </button>
                    </div>

                    <div className="student-report-summary">
                      <article>
                        <span>Questions</span>
                        <strong>{sessionReport.total_questions}</strong>
                      </article>

                      <article>
                        <span>Answered</span>
                        <strong>{sessionReport.questions_answered}</strong>
                      </article>

                      <article>
                        <span>Overall score</span>
                        <strong>
                          {sessionReport.overall_score == null
                            ? "—"
                            : `${sessionReport.overall_score.toFixed(1)} / 10`}
                        </strong>
                      </article>
                    </div>

                    {sessionReport.questions.map((question) => (
                      <article className="student-report-question" key={question.question_id}>
                        <div className="report-question-heading">
                          <h4>
                            Question {question.question_number}: {question.concept}
                          </h4>
                          <span>
                            {question.score == null ? "Not scored" : `Score: ${question.score}`}
                          </span>
                        </div>

                        <p className="report-question-text">{question.question}</p>
                        <p>
                          <strong>Difficulty:</strong> {question.difficulty}
                        </p>

                        <div className="report-answer-block">
                          <strong>Student&apos;s answer</strong>
                          <p>{question.answer || "No answer submitted."}</p>
                        </div>

                        {question.feedback && (
                          <div className="report-feedback-block">
                            <strong>AI feedback</strong>
                            <p>{question.feedback}</p>
                          </div>
                        )}

                        {(question.strengths ?? []).length > 0 && (
                          <div>
                            <strong>Strengths</strong>
                            <ul>
                              {(question.strengths ?? []).map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {(question.improvements ?? []).length > 0 && (
                          <div>
                            <strong>Areas to improve</strong>
                            <ul>
                              {(question.improvements ?? []).map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {(question.learning_hints ?? [])
                        .slice(0, question.hint_count)
                        .map((hint, index) => (
                          <div
                            className="report-hint-block"
                            key={`${question.question_id}-${index}`}
                          >
                            <strong>Learning hint {index + 1}</strong>
                            <p>{hint}</p>
                          </div>
                        ))}

                      <p className="report-hint-count">
                        Hints used: {question.hint_count} of {question.total_hints}
                      </p>
                      </article>
                    ))}
                  </section>
                </div>
              )}

              <div className="students-table-wrap">
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Registered</th>
                      <th>Sessions</th>
                      <th>Completed</th>
                      <th>Answers</th>
                      <th>Avg. score</th>
                      <th>Details</th>
                    </tr>
                  </thead>

                  <tbody>
                    {studentsLoading ? (
                      <tr>
                        <td colSpan={7} className="table-message">
                          Loading students…
                        </td>
                      </tr>
                    ) : studentsError ? null : students.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="table-message">
                          No students found.
                        </td>
                      </tr>
                    ) : (
                      students.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <div className="student-identity">
                              <div className="student-avatar">
                                {(student.full_name || student.email).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <strong>{student.full_name || "Unnamed student"}</strong>
                                <span>{student.email}</span>
                              </div>
                            </div>
                          </td>

                          <td>
                            {student.created_at
                              ? new Date(student.created_at).toLocaleDateString()
                              : "—"}
                          </td>

                          <td>{student.session_count}</td>
                          <td>{student.completed_sessions}</td>
                          <td>{student.questions_answered}</td>

                          <td>
                            {student.average_question_score == null
                              ? "—"
                              : student.average_question_score.toFixed(1)}
                          </td>

                          <td>
                            <button
                              className="student-details-button"
                              onClick={() => void loadStudentSessions(student)}
                            >
                              View sessions
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {selectedStudent && (
                <section className="panel student-session-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>{selectedStudent.full_name}'s sessions</h2>
                      <p>{selectedStudent.email}</p>
                    </div>
                    <button
                      className="student-details-button"
                      onClick={() => setSelectedStudent(null)}
                    >
                      x Close
                    </button>
                  </div>

                  {sessionsLoading ? (
                    <p>Loading sessions…</p>
                  ) : sessionsError ? (
                    <div className="admin-error" role="alert">
                      {sessionsError}
                      <button onClick={() => void loadStudentSessions(selectedStudent)}>
                        Retry
                      </button>
                    </div>
                  ) : studentSessions.length === 0 ? (
                    <p>No learning sessions found for this student.</p>
                  ) : (
                    <div className="students-table-wrap">
                      <table className="students-table">
                        <thead>
                          <tr>
                            <th>Topic</th>
                            <th>Started</th>
                            <th>Questions</th>
                            <th>Answered</th>
                            <th>Status</th>
                            <th>Overall score</th>
                            <th>Report</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentSessions.map((session) => (
                            <tr key={session.session_id}>
                              <td>{session.topic}</td>
                              <td>
                                {session.started_at
                                  ? new Date(session.started_at).toLocaleDateString()
                                  : "—"}
                              </td>
                              <td>{session.total_questions}</td>
                              <td>{session.questions_answered}</td>
                              <td>
                                <span
                                  className={`session-status ${session.status
                                    .toLowerCase()
                                    .replace(/\s+/g, "-")}`}
                                >
                                  {session.status}
                                </span>
                              </td>
                              <td>
                                {session.overall_score == null
                                  ? "—"
                                  : session.overall_score.toFixed(1)}
                              </td>
                              <td>
                                <button
                                  className="student-details-button"
                                  onClick={() => {
                                    void loadSessionReport(session.session_id, selectedStudent.id);
                                  }}
                                >
                                  View report
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {sessionReportLoading && (
                    <div className="panel student-report-panel">Loading session report…</div>
                  )}

                  {sessionReportError && (
                    <div className="admin-error" role="alert">
                      {sessionReportError}
                    </div>
                  )}
                  {sessionReport && (
                    <section className="panel student-report-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>{sessionReport.topic} — Session Report</h2>
                          <p>{sessionReport.student_name}</p>
                        </div>

                        <button
                          className="student-details-button"
                          onClick={() => setSessionReport(null)}
                        >
                          Close report
                        </button>
                      </div>

                      <p>
                        Questions answered: {sessionReport.questions_answered} /{" "}
                        {sessionReport.total_questions}
                      </p>

                      {sessionReport.questions.map((question) => (
                        <article className="student-report-question" key={question.question_id}>
                          <h4>
                            Question {question.question_number}: {question.concept}
                          </h4>

                          <p>{question.question}</p>

                          <strong>Student's answer</strong>
                          <p>{question.answer || "No answer submitted."}</p>

                          <strong>Score</strong>
                          <p>{question.score ?? "Not scored"}</p>

                          {question.feedback && (
                            <>
                              <strong>AI feedback</strong>
                              <p>{question.feedback}</p>
                            </>
                          )}
                        </article>
                      ))}
                    </section>
                  )}
                </section>
              )}
            </section>
          )}

          {activeSection === "sessions" && !error && (
            <section className="students-section">
              <div className="students-toolbar">
                <div>
                  <h2>Learning sessions</h2>
                  <p>Monitor assessment activity across all students.</p>
                </div>
                <span className="activity-status">{allSessions.length} sessions</span>
              </div>

              {allSessionsError && (
                <div className="admin-error" role="alert">
                  {allSessionsError}
                  <button onClick={() => void loadAllSessions()}>Retry</button>
                </div>
              )}

              {/* Session report appears ABOVE the sessions table */}
              {sessionReportLoading && (
                <div className="panel student-report-panel">Loading session report…</div>
              )}

              {sessionReportError && (
                <div className="admin-error" role="alert">
                  {sessionReportError}
                </div>
              )}

              {sessionReport && (
                <div className="session-report-overlay" onClick={() => setSessionReport(null)}>
                  <section
                    className="session-report-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="session-report-title"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="panel-heading">
                      <div>
                        <h2 id="session-report-title">{sessionReport.topic} — Session Report</h2>
                        <p>
                          {sessionReport.student_name} ·{" "}
                          {new Date(sessionReport.started_at).toLocaleString()}
                        </p>
                      </div>

                      <button
                        className="student-details-button"
                        onClick={() => setSessionReport(null)}
                        aria-label="Close session report"
                      >
                        ✕ Close
                      </button>
                    </div>

                    <div className="student-report-summary">
                      <article>
                        <span>Questions</span>
                        <strong>{sessionReport.total_questions}</strong>
                      </article>

                      <article>
                        <span>Answered</span>
                        <strong>{sessionReport.questions_answered}</strong>
                      </article>

                      <article>
                        <span>Overall score</span>
                        <strong>
                          {sessionReport.overall_score == null
                            ? "—"
                            : `${sessionReport.overall_score.toFixed(1)} / 10`}
                        </strong>
                      </article>
                    </div>

                    {sessionReport.questions.map((question) => (
                      <article className="student-report-question" key={question.question_id}>
                        <div className="report-question-heading">
                          <h4>
                            Question {question.question_number}: {question.concept}
                          </h4>
                          <span>
                            {question.score == null ? "Not scored" : `Score: ${question.score}`}
                          </span>
                        </div>

                        <p className="report-question-text">{question.question}</p>
                        <p>
                          <strong>Difficulty:</strong> {question.difficulty}
                        </p>

                        <div className="report-answer-block">
                          <strong>Student&apos;s answer</strong>
                          <p>{question.answer || "No answer submitted."}</p>
                        </div>

                        {question.feedback && (
                          <div className="report-feedback-block">
                            <strong>AI feedback</strong>
                            <p>{question.feedback}</p>
                          </div>
                        )}

                        {(question.strengths ?? []).length > 0 && (
                          <div>
                            <strong>Strengths</strong>
                            <ul>
                              {(question.strengths ?? []).map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {(question.improvements ?? []).length > 0 && (
                          <div>
                            <strong>Areas to improve</strong>
                            <ul>
                              {(question.improvements ?? []).map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {(question.learning_hints ?? [])
                          .slice(0, question.hint_count)
                          .map((hint, index) => (
                            <div
                              className="report-hint-block"
                              key={`${question.question_id}-${index}`}
                            >
                              <strong>Learning hint {index + 1}</strong>
                              <p>{hint}</p>
                            </div>
                          ))}

                        <p className="report-hint-count">
                          Hints used: {question.hint_count} of {question.total_hints}
                        </p>
                      </article>
                    ))}
                  </section>
                </div>
              )}

              {/* Sessions table */}
              <div className="students-table-wrap">
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Topic</th>
                      <th>Started</th>
                      <th>Questions</th>
                      <th>Status</th>
                      <th>Average score</th>
                      <th>Overall score</th>
                      <th>Report</th>
                    </tr>
                  </thead>

                  <tbody>
                    {allSessionsLoading ? (
                      <tr>
                        <td colSpan={8} className="table-message">
                          Loading sessions…
                        </td>
                      </tr>
                    ) : allSessionsError ? (
                      <tr>
                        <td colSpan={8} className="table-message">
                          Unable to load sessions.
                        </td>
                      </tr>
                    ) : allSessions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="table-message">
                          No sessions found.
                        </td>
                      </tr>
                    ) : (
                      allSessions.map((session) => (
                        <tr key={`${session.user_id}-${session.session_id}`}>
                          <td>
                            <div className="student-identity">
                              <strong>{session.student_name}</strong>
                              <span>{session.student_email ?? "—"}</span>
                            </div>
                          </td>

                          <td>{session.topic}</td>

                          <td>
                            {session.started_at
                              ? new Date(session.started_at).toLocaleDateString()
                              : "—"}
                          </td>

                          <td>
                            {session.questions_answered} / {session.total_questions}
                          </td>

                          <td>
                            <span
                              className={`session-status ${session.status
                                .toLowerCase()
                                .replace(/\s+/g, "-")}`}
                            >
                              {session.status}
                            </span>
                          </td>

                          <td>
                            {session.average_score == null ? "—" : session.average_score.toFixed(2)}
                          </td>

                          <td>
                            {session.overall_score == null ? "—" : session.overall_score.toFixed(2)}
                          </td>

                          <td>
                            <button
                              className="student-details-button"
                              onClick={() => {
                                void loadSessionReport(session.session_id, session.user_id);
                              }}
                            >
                              View report
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeSection === "feedback" && !error && (
            <section className="feedback-page">
              <div className="feedback-toolbar">
                <div>
                  <h2>Feedback &amp; Usability Insights</h2>
                  <p>Understand students’ experiences with IntelliPrep.</p>
                </div>

                <span className="feedback-response-count">
                  {feedbackEntries.length} {feedbackEntries.length === 1 ? "response" : "responses"}
                </span>
              </div>

              {feedbackError && (
                <div className="admin-error" role="alert">
                  {feedbackError}
                  <button onClick={() => void loadFeedback()}>Retry</button>
                </div>
              )}

              <div className="feedback-summary">
                <article className="feedback-summary-card">
                  <div className="feedback-summary-icon responses-icon">
                    <span aria-hidden="true">☷</span>
                  </div>
                  <div>
                    <p>Responses received</p>
                    <strong>{feedbackEntries.length}</strong>
                    <span>Student submissions</span>
                  </div>
                </article>

                <article className="feedback-summary-card">
                  <div className="feedback-summary-icon rating-icon">
                    <span aria-hidden="true">★</span>
                  </div>
                  <div>
                    <p>Average rating</p>
                    <strong>
                      {averageFeedbackRating}
                      <span className="feedback-rating-scale"> / 5</span>
                    </strong>
                    <span>Across submitted responses</span>
                  </div>
                </article>
              </div>

              <div className="feedback-section-heading">
                <div>
                  <h3>Student responses</h3>
                  <p>Individual usability ratings and comments.</p>
                </div>
              </div>

              {feedbackLoading ? (
                <div className="feedback-empty-state">
                  <div className="feedback-empty-icon">◷</div>
                  <h3>Loading feedback</h3>
                  <p>Please wait while responses are retrieved.</p>
                </div>
              ) : feedbackError ? null : feedbackEntries.length === 0 ? (
                <div className="feedback-empty-state">
                  <div className="feedback-empty-icon">☷</div>
                  <h3>No feedback yet</h3>
                  <p>Student submissions will appear here.</p>
                </div>
              ) : (
                <div className="feedback-cards">
                  {feedbackEntries.map((item) => {
                    const suggestion = item.improvements?.trim();
                    const hasSuggestion =
                      suggestion && !["na", "n/a", "none"].includes(suggestion.toLowerCase());

                    return (
                      <article className="feedback-card" key={item.id}>
                        <div className="feedback-card-header">
                          <div className="feedback-student">
                            <div className="feedback-avatar">
                              {(item.student_name || "S").trim().charAt(0).toUpperCase()}
                            </div>

                            <div className="feedback-student-info">
                              <strong>{item.student_name || "Unnamed student"}</strong>
                              <span>
                                {item.submitted_at
                                  ? `Submitted ${new Date(item.submitted_at).toLocaleDateString()}`
                                  : "Submission date unavailable"}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`feedback-rating ${
                              item.rating >= 4
                                ? "rating-positive"
                                : item.rating === 3
                                  ? "rating-neutral"
                                  : "rating-low"
                            }`}
                            aria-label={`Rating ${item.rating} out of 5`}
                          >
                            <span aria-hidden="true">★</span>
                            {item.rating} / 5
                          </div>
                        </div>

                        <div className="feedback-details">
                          <div className="feedback-detail">
                            <div className="feedback-detail-icon ease-icon">✓</div>
                            <div>
                              <span>Ease of use</span>
                              <strong>{item.ease_of_use || "Not provided"}</strong>
                            </div>
                          </div>

                          <div className="feedback-detail">
                            <div className="feedback-detail-icon hint-icon">
                              <span aria-hidden="true">✦</span>
                            </div>
                            <div>
                              <span>Hint usefulness</span>
                              <strong>{item.hint_usefulness || "Not provided"}</strong>
                            </div>
                          </div>

                          <div className="feedback-detail">
                            <div className="feedback-detail-icon recommend-icon">
                              <span aria-hidden="true">↗</span>
                            </div>
                            <div>
                              <span>Would recommend</span>
                              <strong>{item.recommendation || "Not provided"}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="feedback-suggestion">
                          <div className="feedback-suggestion-heading">
                            <span aria-hidden="true">✎</span>
                            <strong>Suggestion for improvement</strong>
                          </div>

                          <p>
                            {hasSuggestion ? suggestion : "No improvement suggestions provided."}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <footer className="admin-footer">
            <span>IntelliPrep Administration</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
