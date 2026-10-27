import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import AuthLayout from "../components/auth/authLayout";
import PasswordInput from "../components/auth/passwordInput";
import PrimaryButton from "../components/auth/primaryButton";

import "./resetPasswordPage.css";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("Your reset link is missing its token. Please request a new link.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          new_password: password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to reset your password. Your link may have expired."
        );
      }

      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot connect to the server. Please try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="ACCOUNT RECOVERY"
      title={success ? "Password updated!" : "Create a new password"}
      description={
        success
          ? "Your password has been changed successfully."
          : "Choose a new password to secure your IntelliPrep account."
      }
    >
      {success ? (
        <div className="reset-success" role="status">
          <div className="reset-success-icon" aria-hidden="true">
            ✓
          </div>

          <h3>Password reset successful</h3>

          <p>You can now sign in using your new password.</p>

          <button
            type="button"
            className="reset-login-button"
            onClick={() => navigate("/login", { replace: true })}
          >
            Continue to sign in →
          </button>
        </div>
      ) : !token ? (
        <div className="reset-error-panel" role="alert">
          <p>This reset link is missing its token. Please request a new password-reset email.</p>
          <Link to="/forgot-password" className="reset-text-link">
            Request a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="reset-form">
          <PasswordInput
            id="newPassword"
            label="New password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            maxLength={128}
            required
          />

          <PasswordInput
            id="confirmNewPassword"
            label="Confirm new password"
            placeholder="Enter your password again"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            maxLength={128}
            required
          />

          <p className="reset-hint">
            Use at least 8 characters and choose a password you haven't used elsewhere.
          </p>

          {error && (
            <p className="reset-error" role="alert">
              {error}
            </p>
          )}

          <PrimaryButton loading={loading}>
            {loading ? "Updating password..." : "Reset password"}
          </PrimaryButton>

          <p className="reset-back-link">
            Remember your password?{" "}
            <Link to="/login" className="reset-text-link">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
