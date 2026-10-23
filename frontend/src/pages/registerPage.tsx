
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "../components/auth/authLayout";
import FormInput from "../components/auth/formInput";
import PasswordInput from "../components/auth/passwordInput";
import PrimaryButton from "../components/auth/primaryButton";

import "./registerPage.css";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    if (!acceptedPrivacy) {
      setError("Please acknowledge the privacy notice to continue.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:8000/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim(),
            password,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to create your account. Please try again."
        );
      }

      navigate("/login", {
        replace: true,
        state: {
          message: "Account created successfully. Please sign in.",
        },
      });
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
      eyebrow="GET STARTED FOR FREE"
      title="Create your account"
      description="Enter your details to start your learning journey."
    >
      <form onSubmit={handleSubmit}>
        <FormInput
          id="fullName"
          label="Full name"
          type="text"
          placeholder="Enter your name"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          minLength={2}
          maxLength={100}
          required
        />

        <FormInput
          id="registerEmail"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          required
        />

        <PasswordInput
          id="registerPassword"
          label="Password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          maxLength={128}
          required
        />

        <p className="register-hint">
          Use at least 8 characters.
        </p>

        <PasswordInput
          id="confirmPassword"
          label="Confirm password"
          placeholder="Re-enter your password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          maxLength={128}
          required
        />

        <label className="register-privacy">
          <input
            type="checkbox"
            checked={acceptedPrivacy}
            onChange={(event) => setAcceptedPrivacy(event.target.checked)}
          />
          <span>
            I have read the{" "}
            <Link to="/privacy" className="register-text-link">
              privacy notice
            </Link>{" "}
            and understand how my information will be used.
          </span>
        </label>

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        <PrimaryButton loading={loading}>
          Create account <span aria-hidden="true">→</span>
        </PrimaryButton>
      </form>

      <p className="register-signin">
        Already have an account?{" "}
        <Link to="/login" className="register-text-link">
          Sign in
        </Link>
      </p>

      <p className="register-footer">
        Your learning journey, tailored to you.
      </p>
    </AuthLayout>
  );
}
