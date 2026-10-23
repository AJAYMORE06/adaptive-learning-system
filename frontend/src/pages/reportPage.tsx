
import { useState } from "react";
import { Link } from "react-router-dom";
import "./reportPage.css";
import { useNavigate } from "react-router-dom";


type QuestionResult = {
  id: string;
  difficulty: string;
  question: string;
  score: number;
  answer: string;
  feedback: string;
  strengths: string[];
  improvements: string[];
  hint: string;
};

const MOCK_REPORT = {
  examTitle: "Angular Technical Interview",
  completedAt: "Practice session",
  overallScore: 74,
  questionsCompleted: 10,
  totalQuestions: 10,
};

const QUESTION_RESULTS: QuestionResult[] = [
  {
    id: "angular-01",
    difficulty: "Easy",
    question: "What is Angular, and what are its main advantages?",
    score: 8,
    answer:
      "Angular is a frontend framework used to build web applications. It supports reusable components and provides tools to structure an application.",
    feedback:
      "You demonstrated a good foundational understanding of Angular. Your answer would be stronger with a clearer explanation of its TypeScript foundation, dependency injection, and how its built-in features support maintainability.",
    strengths: [
      "Identified Angular as a frontend framework.",
      "Recognised the importance of reusable components.",
    ],
    improvements: [
      "Explain dependency injection and its benefits.",
      "Discuss how Angular's architecture supports larger applications.",
    ],
    hint:
      "Think about how Angular separates UI components from shared services. How does this help a team maintain a growing application?",
  },
  {
    id: "angular-02",
    difficulty: "Easy",
    question: "What is a component in Angular?",
    score: 9,
    answer:
      "A component controls part of the UI and contains a template and TypeScript logic.",
    feedback:
      "Your answer captures the main idea. To make it more complete, explain how a component's metadata connects its class, template, and styles.",
    strengths: [
      "Explained the role of a component in the UI.",
      "Mentioned the TypeScript logic and template.",
    ],
    improvements: [
      "Describe the role of the @Component decorator.",
      "Explain how component styles and selectors are used.",
    ],
    hint:
      "Consider what information Angular needs to associate a TypeScript class with a particular part of the page.",
  },
  {
    id: "angular-03",
    difficulty: "Easy",
    question: "What is data binding in Angular?",
    score: 6,
    answer:
      "Data binding connects data in the component with the HTML template.",
    feedback:
      "You identified the purpose of data binding, but your explanation needs more detail about the different binding patterns and the direction in which data flows.",
    strengths: [
      "Recognised the connection between component data and the template.",
    ],
    improvements: [
      "Distinguish interpolation, property binding, and event binding.",
      "Explain how two-way binding combines property and event updates.",
    ],
    hint:
      "Think about the difference between displaying a component value, responding to a click, and keeping an input synchronised with component state.",
  },
  {
    id: "angular-04",
    difficulty: "Medium",
    question:
      "What is the difference between a component and a directive?",
    score: 7,
    answer:
      "Components have templates, while directives add behaviour to elements or change how they work.",
    feedback:
      "You described an important distinction. Strengthen your answer by distinguishing components from attribute and structural directives, and explain the role each plays.",
    strengths: [
      "Identified that components provide a template.",
      "Recognised that directives can change element behaviour.",
    ],
    improvements: [
      "Explain attribute directives versus structural directives.",
      "Give a practical example of each.",
    ],
    hint:
      "Consider a directive that changes an element's appearance and another that conditionally displays content. How are these different from a component that renders its own view?",
  },
  {
    id: "angular-05",
    difficulty: "Medium",
    question:
      "What are Angular services and dependency injection?",
    score: 7,
    answer:
      "Services hold shared functionality. Dependency injection provides services to components that need them.",
    feedback:
      "Your answer covers the core relationship. It would benefit from explaining how services help separate business logic from presentation and how providers control availability.",
    strengths: [
      "Identified services as reusable functionality.",
      "Connected dependency injection with supplying dependencies.",
    ],
    improvements: [
      "Explain service providers and their scope.",
      "Describe a practical use case, such as an API service.",
    ],
    hint:
      "Imagine several components need the same API data. Consider how shared functionality can be provided without duplicating the implementation.",
  },
  {
    id: "angular-06",
    difficulty: "Medium",
    question:
      "What is the purpose of RxJS Observables in Angular?",
    score: 7,
    answer:
      "Observables represent asynchronous data that components can subscribe to, such as HTTP responses.",
    feedback:
      "You understand the asynchronous use case. A stronger response would describe streams of values, operators, and subscription lifecycle management.",
    strengths: [
      "Recognised asynchronous data handling.",
      "Provided a relevant HTTP example.",
    ],
    improvements: [
      "Explain how operators transform or combine streams.",
      "Discuss subscription cleanup where applicable.",
    ],
    hint:
      "Think about data that can arrive over time rather than only once. What operations might you need before a component consumes that data?",
  },
  {
    id: "angular-07",
    difficulty: "Hard",
    question: "How does change detection work in Angular?",
    score: 7,
    answer:
      "Angular checks component state and updates the view when bound values change.",
    feedback:
      "Your explanation is a reasonable starting point. Develop it by discussing component trees, change-detection strategies, and how signals or events can trigger updates.",
    strengths: [
      "Connected component state to rendered UI.",
      "Recognised that Angular updates bound values.",
    ],
    improvements: [
      "Explain Default and OnPush strategies.",
      "Discuss performance considerations in large component trees.",
    ],
    hint:
      "Consider what happens when state changes in one part of a component tree. How could limiting unnecessary checks improve performance?",
  },
  {
    id: "angular-08",
    difficulty: "Hard",
    question:
      "How would you optimise the performance of a large Angular application?",
    score: 8,
    answer:
      "I would use lazy loading, avoid unnecessary rendering, and reduce the amount of work performed by components.",
    feedback:
      "You identified relevant optimisation strategies. A stronger answer would connect each technique to a measurable bottleneck and explain how you would verify the improvement.",
    strengths: [
      "Mentioned lazy loading.",
      "Recognised unnecessary rendering as a performance concern.",
    ],
    improvements: [
      "Discuss bundle analysis and route-level code splitting.",
      "Explain profiling, list rendering optimisation, and measurement.",
    ],
    hint:
      "Separate initial load time from runtime rendering. What would you measure first, and which techniques target each type of bottleneck?",
  },
  {
    id: "angular-09",
    difficulty: "Hard",
    question:
      "How would you manage shared state across multiple Angular components?",
    score: 6,
    answer:
      "I would use a shared service to store state and let components access it.",
    feedback:
      "A shared service can be appropriate, but the answer should explain how updates are communicated and when a more structured state-management approach is justified.",
    strengths: [
      "Identified shared services as one option.",
    ],
    improvements: [
      "Explain reactive state using signals or RxJS.",
      "Compare a shared service with NgRx for complex state flows.",
    ],
    hint:
      "Consider the number of components, how frequently state changes, and whether updates need predictable actions and centralised tracking.",
  },
  {
    id: "angular-10",
    difficulty: "Exceptional",
    question:
      "How would you design a scalable Angular application using lazy loading, state management, and modular architecture?",
    score: 9,
    answer:
      "I would split features into modules or feature areas, lazy-load routes, and use shared state management where necessary.",
    feedback:
      "Your answer demonstrates a strong architectural direction. To make it more convincing, discuss boundaries between features, dependency ownership, testing, and how architectural decisions would evolve with team size.",
    strengths: [
      "Connected lazy loading with feature separation.",
      "Recognised the need for deliberate state management.",
    ],
    improvements: [
      "Explain boundaries between feature and shared code.",
      "Include testing, dependency rules, and architecture trade-offs.",
    ],
    hint:
      "Imagine multiple teams developing features independently. Consider how you would minimise coupling while maintaining consistent state and navigation.",
  },
];

function getScoreLabel(score: number) {
  if (score >= 8) return "Strong";
  if (score >= 6) return "Developing";
  return "Needs improvement";
}

export default function ReportPage() {
    const navigate = useNavigate();
    const [completedRetests] = useState(() =>
  Number(sessionStorage.getItem("completedRetests") || "0")
);
  const [expandedHints, setExpandedHints] = useState<string[]>([]);
  const [expandedAnswers, setExpandedAnswers] = useState<string[]>([]);
  const [filter, setFilter] = useState("All");

  const toggleItem = (
    id: string,
    items: string[],
    setItems: (next: string[]) => void
  ) => {
    setItems(
      items.includes(id)
        ? items.filter((item) => item !== id)
        : [...items, id]
    );
  };

  const averageScore =
    QUESTION_RESULTS.reduce((total, item) => total + item.score, 0) /
    QUESTION_RESULTS.length;

  const filteredQuestions =
    filter === "All"
      ? QUESTION_RESULTS
      : QUESTION_RESULTS.filter(
          (item) => item.difficulty === filter
        );

  return (
    <main className="report-page">
      <header className="report-header">
        <Link to="/learning" className="report-back-link">
          <span aria-hidden="true">←</span> Learning Studio
        </Link>

        <p className="report-eyebrow">INTELLIPREP / PERFORMANCE</p>

        <div className="report-title-row">
          <div>
            <h1>Your evaluation report</h1>
            <p>
              Review your answers, understand your knowledge gaps, and
              discover what to practise next.
            </p>
          </div>

          <span className="report-completed-badge">
            <span aria-hidden="true">✓</span> Exam completed
          </span>
        </div>
      </header>

      <section className="report-overview" aria-label="Exam summary">
        <article className="report-score-card report-score-primary">
          <span className="report-stat-label">Overall score</span>
          <div className="report-score-value">
            {MOCK_REPORT.overallScore}
            <span>%</span>
          </div>
          <div
            className="report-progress-track"
            role="progressbar"
            aria-label="Overall score"
            aria-valuenow={MOCK_REPORT.overallScore}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="report-progress-fill"
              style={{ width: `${MOCK_REPORT.overallScore}%` }}
            />
          </div>
          <span className="report-stat-caption">
            Illustrative result
          </span>
        </article>

        <article className="report-stat-card">
          <span className="report-stat-icon" aria-hidden="true">
            ✓
          </span>
          <span className="report-stat-label">Questions reviewed</span>
          <strong>
            {MOCK_REPORT.questionsCompleted}
            <span> / {MOCK_REPORT.totalQuestions}</span>
          </strong>
          <span className="report-stat-caption">Full practice session</span>
        </article>

        <article className="report-stat-card">
          <span className="report-stat-icon" aria-hidden="true">
            ◈
          </span>
          <span className="report-stat-label">Average question score</span>
          <strong>{averageScore.toFixed(1)} / 10</strong>
          <span className="report-stat-caption">Across all questions</span>
        </article>
      </section>

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
              <span className="report-insight-symbol strength-symbol">
                +
              </span>
              <h3>Strengths</h3>
            </div>
            <p>
              You show a good foundation in Angular components, services,
              and application architecture.
            </p>
            <span className="report-insight-note">
              Continue practising with real-world examples.
            </span>
          </article>

          <article className="report-insight-card">
            <div className="report-insight-heading">
              <span className="report-insight-symbol improve-symbol">
                ↗
              </span>
              <h3>Areas to improve</h3>
            </div>
            <p>
              Focus on data binding, shared state management, and explaining
              change detection in more depth.
            </p>
            <span className="report-insight-note">
              Use the hints below to guide revision.
            </span>
          </article>
        </div>
      </section>

      <section className="report-questions">
        <div className="report-section-heading report-question-heading">
          <div>
            <p className="report-eyebrow">DETAILED REVIEW</p>
            <h2>Question-by-question feedback</h2>
            <p className="report-section-description">
              Each score and feedback item is an example until the LLM
              evaluation API is connected.
            </p>
          </div>

          <label className="report-filter">
            <span>Difficulty</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option>All</option>
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
              <option>Exceptional</option>
            </select>
          </label>
        </div>

        <div className="report-question-list">
          {filteredQuestions.map((item, index) => {
            const hintOpen = expandedHints.includes(item.id);
            const answerOpen = expandedAnswers.includes(item.id);

            return (
              <article className="report-question-card" key={item.id}>
                <div className="report-question-topline">
                  <span className="report-question-number">
                    QUESTION{" "}
                    {QUESTION_RESULTS.findIndex(
                      (question) => question.id === item.id
                    ) + 1}
                  </span>

                  <div className="report-question-badges">
                    <span className="report-difficulty">
                      {item.difficulty}
                    </span>
                    <span
                      className={`report-score-badge ${
                        item.score >= 8
                          ? "score-strong"
                          : item.score >= 6
                            ? "score-developing"
                            : "score-low"
                      }`}
                    >
                      {item.score}/10 · {getScoreLabel(item.score)}
                    </span>
                  </div>
                </div>

                <h3 className="report-question-title">{item.question}</h3>

                <div className="report-question-score-track">
                  <div
                    className={`report-question-score-fill ${
                      item.score >= 8
                        ? "fill-strong"
                        : item.score >= 6
                          ? "fill-developing"
                          : "fill-low"
                    }`}
                    style={{ width: `${item.score * 10}%` }}
                  />
                </div>

                <div className="report-answer-section">
                  <button
                    type="button"
                    className="report-disclosure"
                    aria-expanded={answerOpen}
                    onClick={() =>
                      toggleItem(
                        item.id,
                        expandedAnswers,
                        setExpandedAnswers
                      )
                    }
                  >
                    <span>Your submitted answer</span>
                    <span aria-hidden="true">
                      {answerOpen ? "−" : "+"}
                    </span>
                  </button>

                  {answerOpen && (
                    <p className="report-submitted-answer">
                      {item.answer}
                    </p>
                  )}
                </div>

                <div className="report-feedback">
                  <h4>AI feedback</h4>
                  <p>{item.feedback}</p>
                </div>

                <div className="report-feedback-grid">
                  <div>
                    <h4 className="report-strength-title">What went well</h4>
                    <ul>
                      {item.strengths.map((strength) => (
                        <li key={strength}>{strength}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="report-improvement-title">
                      What to improve
                    </h4>
                    <ul>
                      {item.improvements.map((improvement) => (
                        <li key={improvement}>{improvement}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="report-hint">
                  <button
                    type="button"
                    className="report-hint-toggle"
                    aria-expanded={hintOpen}
                    onClick={() =>
                      toggleItem(
                        item.id,
                        expandedHints,
                        setExpandedHints
                      )
                    }
                  >
                    <span className="report-hint-icon" aria-hidden="true">
                      ✦
                    </span>
                    <span className="report-hint-label">
                      <strong>Learning hint</strong>
                      <small>
                        A prompt to help you strengthen your answer
                      </small>
                    </span>
                    <span className="report-hint-action">
                      {hintOpen ? "Hide hint −" : "Show hint +"}
                    </span>
                  </button>

                  {hintOpen && (
                    <p className="report-hint-content">{item.hint}</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      
<footer className="report-footer">
  <div>
    <h2>Ready to practise again?</h2>
    <p>
      Strengthen your answers or share feedback about your
      experience with IntelliPrep.
    </p>
    <p className="retest-status">
      {completedRetests >= 1
        ? "You've completed at least one retest. Feedback is now available."
        : "Complete at least one retest to unlock feedback."}
    </p>
  </div>

  <div className="report-footer-actions">
    <Link to="/learning" className="report-primary-button">
      Practise Again <span aria-hidden="true">→</span>
    </Link>

   {completedRetests >= 2 && (
  <button
    type="button"
    className="report-exit-button"
    onClick={() => navigate("/feedback")}
  >
    Exit & Give Feedback
  </button>
)}
  </div>
</footer>

    </main>
  );
}
