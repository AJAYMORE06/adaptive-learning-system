import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./feedbackPage.css";

export default function FeedbackPage() {
  const navigate = useNavigate();

  const [rating, setRating] = useState(0);
  const [easeOfUse, setEaseOfUse] = useState("");
  const [hintUsefulness, setHintUsefulness] = useState("");
  const [improvements, setImprovements] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!rating || !easeOfUse || !hintUsefulness || !recommendation) {
      return;
    }

    const token = sessionStorage.getItem("access_token");
    const API_BASE_URL = "http://localhost:8000";

    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating,
          ease_of_use: easeOfUse,
          hint_usefulness: hintUsefulness,
          improvements: improvements.trim() || null,
          recommendation,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.detail || "Unable to save your feedback. Please try again.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong while submitting feedback."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="feedback-page">
        <section className="feedback-success">
          <div className="feedback-success-icon">✓</div>
          <p className="feedback-eyebrow">INTELLIPREP · FEEDBACK</p>
          <h1>Thank you for your feedback!</h1>
          <p>
            Your responses will help us improve the personalised interview preparation experience.
          </p>
          <button className="feedback-submit" onClick={() => navigate("/dashboard")}>
            Return to Home
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="feedback-page">
      <div className="feedback-container">
        <header className="feedback-header">
          <Link to="/dashboard" className="report-back-link">
            <span aria-hidden="true">←</span> Dashboard
          </Link>

          <p className="feedback-eyebrow">INTELLIPREP · YOUR EXPERIENCE</p>
          <h1>Help us improve IntelliPrep</h1>
          <p className="feedback-intro">
            Tell us what worked, what could be better, and how useful the experience was for you.
          </p>
          <p className="feedback-time">Takes approximately 2–3 minutes</p>
        </header>

        <form className="feedback-form" onSubmit={handleSubmit}>
          <section className="feedback-section">
            <span className="feedback-number">01</span>
            <div className="feedback-question">
              <h2>How would you rate your overall experience?</h2>
              <p>Choose a rating from 1 (poor) to 5 (excellent).</p>

              <div className="rating-options">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`rating-option ${rating === value ? "selected" : ""}`}
                    aria-pressed={rating === value}
                    onClick={() => setRating(value)}
                  >
                    <span className="rating-star">{rating >= value ? "★" : "☆"}</span>
                    <span>{value}</span>
                  </button>
                ))}
              </div>
              <div className="rating-labels">
                <span>Poor</span>
                <span>Excellent</span>
              </div>
            </div>
          </section>

          <section className="feedback-section">
            <span className="feedback-number">02</span>
            <div className="feedback-question">
              <h2>How easy was IntelliPrep to use?</h2>
              <p>Consider navigation, answering questions, and moving between stages.</p>

              <div className="feedback-radio-list">
                {[
                  "Very easy",
                  "Easy",
                  "Neither easy nor difficult",
                  "Difficult",
                  "Very difficult",
                ].map((option) => (
                  <label key={option} className="feedback-radio">
                    <input
                      type="radio"
                      name="easeOfUse"
                      value={option}
                      checked={easeOfUse === option}
                      onChange={(event) => setEaseOfUse(event.target.value)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="feedback-section">
            <span className="feedback-number">03</span>
            <div className="feedback-question">
              <h2>How useful were the AI hints?</h2>
              <p>Did the hints help you think through an answer without simply giving it away?</p>

              <div className="feedback-radio-list">
                {[
                  "Extremely useful",
                  "Useful",
                  "Somewhat useful",
                  "Not very useful",
                  "I did not use the hints",
                ].map((option) => (
                  <label key={option} className="feedback-radio">
                    <input
                      type="radio"
                      name="hintUsefulness"
                      value={option}
                      checked={hintUsefulness === option}
                      onChange={(event) => setHintUsefulness(event.target.value)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="feedback-section">
            <span className="feedback-number">04</span>
            <div className="feedback-question">
              <h2>Would you use IntelliPrep again?</h2>
              <p>Think about preparing for a real technical interview.</p>

              <div className="feedback-radio-list">
                {["Definitely", "Probably", "Not sure", "Probably not", "Definitely not"].map(
                  (option) => (
                    <label key={option} className="feedback-radio">
                      <input
                        type="radio"
                        name="recommendation"
                        value={option}
                        checked={recommendation === option}
                        onChange={(event) => setRecommendation(event.target.value)}
                      />
                      <span>{option}</span>
                    </label>
                  )
                )}
              </div>
            </div>
          </section>

          <section className="feedback-section">
            <span className="feedback-number">05</span>
            <div className="feedback-question">
              <h2>What would you change or improve?</h2>
              <p>
                Share any suggestions about the questions, hints, feedback, difficulty progression,
                or overall experience. This is optional.
              </p>

              <textarea
                value={improvements}
                onChange={(event) => setImprovements(event.target.value)}
                placeholder="For example, I would find it helpful if..."
                rows={5}
                maxLength={1500}
              />
              <div className="feedback-character-count">{improvements.length}/1500</div>
            </div>
          </section>

          <div className="feedback-privacy-note">
            <strong>Before you submit</strong>
            <p>
              Please do not include your name or other identifying information in your written
              comments. This prototype stores your responses only in the current browser session;
              they are not yet saved to the research database.
            </p>
          </div>
          {error && (
            <p role="alert" className="feedback-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="feedback-submit"
            disabled={submitting || !rating || !easeOfUse || !hintUsefulness || !recommendation}
          >
            {submitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </form>
      </div>
    </main>
  );
}
