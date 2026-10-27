import type { ReactNode } from "react";
import BrandLogo from "./brandLogo";
import "./authLayout.css";

type AuthLayoutProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
};

export default function AuthLayout({ children, eyebrow, title, description }: AuthLayoutProps) {
  return (
    <main className="auth-layout">
      <section className="auth-layout-visual">
        <BrandLogo light />

        <div className="auth-layout-message">
          <span className="auth-layout-eyebrow">YOUR PERSONAL AI LEARNING COMPANION</span>

          <h1>
            Prepare smarter.
            <br />
            Learn adaptively.
          </h1>

          <p>
            Develop your technical interview skills through personalised practice, intelligent hints
            and feedback.
          </p>

          <div className="auth-layout-features">
            <p>
              <span>✓</span> Personalised practice sessions
            </p>
            <p>
              <span>✓</span> AI-guided feedback
            </p>
            <p>
              <span>✓</span> Learning at your own pace
            </p>
          </div>
        </div>

        <p className="auth-layout-footer">Learn continuously. Progress confidently.</p>
      </section>

      <section className="auth-layout-panel">
        <div className="auth-layout-mobile-brand">
          <BrandLogo compact />
        </div>

        <div className="auth-layout-card">
          <div className="auth-layout-heading">
            <span className="auth-layout-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}
