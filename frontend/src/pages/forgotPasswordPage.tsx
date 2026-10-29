import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import AuthLayout from "../components/auth/authLayout";
import FormInput from "../components/auth/formInput";
import PrimaryButton from "../components/auth/primaryButton";

import "./forgotPasswordPage.css";
import { apiFetch } from "../services/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiFetch("http://localhost:8000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Unable to process your request. Please try again.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot connect to the server. Please try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow={submitted ? "REQUEST RECEIVED" : "ACCOUNT RECOVERY"}
      title={submitted ? "Check your email" : "Forgot your password?"}
      description={
        submitted
          ? "If an account exists for this email address, you will receive instructions to reset your password."
          : "No worries. Enter the email address associated with your account and we'll help you reset your password."
      }
    >
      {!submitted ? (
        <>
          <form onSubmit={handleSubmit}>
            <FormInput
              id="recoveryEmail"
              label="Email address"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              required
            />

            {error && (
              <p className="forgot-error" role="alert">
                {error}
              </p>
            )}

            <PrimaryButton loading={loading}>
              Send reset link <span aria-hidden="true">→</span>
            </PrimaryButton>
          </form>

          <Link to="/login" className="forgot-back-link">
            <span aria-hidden="true">←</span> Back to sign in
          </Link>
        </>
      ) : (
        <div className="forgot-success" role="status">
          <p>Check your inbox and spam folder for password-reset instructions.</p>

          <Link to="/login" className="forgot-return-link">
            Return to sign in
          </Link>
        </div>
      )}

      <p className="forgot-footer">Keep learning. Keep progressing.</p>
    </AuthLayout>
  );
}
