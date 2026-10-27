import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "../components/auth/authLayout";
import FormInput from "../components/auth/formInput";
import PasswordInput from "../components/auth/passwordInput";
import PrimaryButton from "../components/auth/primaryButton";

import "./loginPage.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Invalid username or password, please check your credentials."
            : data.detail || "Unable to sign in. Please try again."
        );
      }

      if (!data.access_token) {
        throw new Error("Login response did not include an access token.");
      }

      const role = String(data.user?.role ?? data.role ?? "")
        .trim()
        .toLowerCase();

      if (!role) {
        throw new Error(
          "User role is missing from the login response. Please contact the support team."
        );
      }

      sessionStorage.setItem("access_token", data.access_token);
      sessionStorage.setItem("user_role", role);

      navigate(role === "admin" ? "/admin" : "/dashboard", {
        replace: true,
      });

      navigate("/dashboard");
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
      eyebrow="WELCOME BACK"
      title="Sign in to your account"
      description="Continue your personalised learning journey."
    >
      <form onSubmit={handleSubmit}>
        <FormInput
          id="email"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <div className="login-password-heading">
          <Link to="/forgot-password" className="login-text-link">
            Forgot password?
          </Link>
        </div>

        <PasswordInput
          id="password"
          label="Password"
          placeholder="Enter your password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <PrimaryButton loading={loading}>
          Sign in <span aria-hidden="true">→</span>
        </PrimaryButton>
      </form>

      <p className="login-signup-prompt">
        Don't have an account?{" "}
        <Link to="/register" className="login-text-link">
          Create account
        </Link>
      </p>

      <p className="login-privacy-note">
        By signing in, you agree to use the platform in accordance with its privacy notice.
      </p>
    </AuthLayout>
  );
}
