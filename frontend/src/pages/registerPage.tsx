import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "../components/auth/authLayout";
import FormInput from "../components/auth/formInput";
import PasswordInput from "../components/auth/passwordInput";
import PrimaryButton from "../components/auth/primaryButton";

import "./registerPage.css";
import { apiFetch } from "../services/api";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [activeLegal, setActiveLegal] = useState<"privacy" | "terms" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
  if (!activeLegal) return;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setActiveLegal(null);
    }
  };

  document.addEventListener("keydown", handleKeyDown);
  document.body.style.overflow = "hidden";

  return () => {
    document.removeEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "";
  };
}, [activeLegal]);

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

    if (!acceptedTerms) {
  setError("Please agree to the Terms & Conditions to continue.");
  return;
}

    setLoading(true);

    try {
      const response = await apiFetch("http://localhost:8000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Unable to create your account. Please try again.");
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

        <p className="register-hint">Use at least 8 characters.</p>

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
    checked={acceptedTerms}
    onChange={(event) => setAcceptedTerms(event.target.checked)}
    required
  />

  <span>
    I agree to the{" "}
    <button
      type="button"
      className="register-text-link register-legal-trigger"
      onClick={() => setActiveLegal("terms")}
    >
      Terms &amp; Conditions
    </button>{" "}
    and acknowledge that I have read the{" "}
    <button
      type="button"
      className="register-text-link register-legal-trigger"
      onClick={() => setActiveLegal("privacy")}
    >
      Privacy Policy
    </button>
    .
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

      <p className="register-footer">Your learning journey, tailored to you.</p>

      {activeLegal && (
  <div
    className="legal-modal-backdrop"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        setActiveLegal(null);
      }
    }}
  >
    <section
      className="legal-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <header className="legal-modal-header">
        <div className="legal-modal-heading">
          <span className="legal-modal-icon" aria-hidden="true">
            {activeLegal === "privacy" ? "♧" : "▤"}
          </span>

          <div>
            <h2 id="legal-modal-title">
              {activeLegal === "privacy"
                ? "Privacy Policy"
                : "Terms & Conditions"}
            </h2>

            <p>
              {activeLegal === "privacy"
                ? "How IntelliPrep handles your information"
                : "Rules for using IntelliPrep"}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="legal-modal-close"
          aria-label="Close dialog"
          onClick={() => setActiveLegal(null)}
        >
          ×
        </button>
      </header>

      <div className="legal-modal-content">
        {activeLegal === "privacy" ? (
          <>
            <section>
              <h3>1. Information we collect</h3>
              <p>
                IntelliPrep may collect your name, email address,
                assessment answers, learning progress and feedback
                you submit while using the platform.
              </p>
            </section>

            <section>
              <h3>2. How we use your information</h3>
              <p>
                We use this information to provide interview practice,
                evaluate responses, generate learning feedback and
                track your progress.
              </p>
            </section>

            <section>
              <h3>3. AI processing</h3>
              <p>
                Assessment answers may be processed by the AI service
                configured for IntelliPrep to generate evaluations
                and hints. The final policy should identify the
                actual provider and explain its role in processing data.
              </p>
            </section>

            <section>
              <h3>4. Storage and security</h3>
              <p>
                Explain where account and assessment data are stored,
                who can access them, and the technical and
                organisational safeguards used to protect them.
              </p>
            </section>

            <section>
              <h3>5. Data retention and your rights</h3>
              <p>
                Explain how long information is retained and how
                users can request access, correction or deletion,
                where applicable.
              </p>
            </section>

            <section>
              <h3>6. Contact</h3>
              <p>
                Provide the appropriate contact details for privacy
                questions or requests.
              </p>
            </section>
          </>
        ) : (
          <>
            <section>
              <h3>1. Using IntelliPrep</h3>
              <p>
                Use IntelliPrep for its intended interview preparation
                and learning purposes. Do not misuse the platform or
                attempt to access other users' information.
              </p>
            </section>

            <section>
              <h3>2. Your account</h3>
              <p>
                Provide accurate registration information and take
                reasonable steps to protect your account credentials.
              </p>
            </section>

            <section>
              <h3>3. AI-generated feedback</h3>
              <p>
                AI-generated evaluations and hints may be incomplete
                or inaccurate. They are intended to support learning
                and should not be treated as guaranteed assessments
                of your abilities.
              </p>
            </section>

            <section>
              <h3>4. Acceptable use</h3>
              <p>
                Do not use the platform unlawfully, interfere with
                its operation or attempt to compromise its security.
              </p>
            </section>

            <section>
              <h3>5. Service availability</h3>
              <p>
                Features may change as IntelliPrep is developed.
                The platform is provided subject to the applicable
                terms and limitations described in the final policy.
              </p>
            </section>

            <section>
              <h3>6. Questions</h3>
              <p>
                Provide a contact method for questions about these
                terms.
              </p>
            </section>
          </>
        )}
      </div>

      <footer className="legal-modal-footer">
        <button
          type="button"
          className="legal-modal-done"
          onClick={() => setActiveLegal(null)}
        >
          Close
        </button>
      </footer>
    </section>
  </div>
)}
    </AuthLayout>
  );
}
