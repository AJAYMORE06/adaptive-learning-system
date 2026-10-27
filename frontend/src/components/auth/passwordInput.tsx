import { useState, type InputHTMLAttributes } from "react";
import "./authComponent.css";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  id: string;
  label: string;
  error?: string;
};

export default function PasswordInput({
  id,
  label,
  error,
  className = "",
  ...inputProps
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>
        {label}
      </label>

      <div className="auth-password-wrapper">
        <input
          {...inputProps}
          id={id}
          type={visible ? "text" : "password"}
          className={`auth-input auth-password-input ${
            error ? "auth-input-error" : ""
          } ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />

        <button
          type="button"
          className="auth-password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>

      {error && (
        <span id={`${id}-error`} className="auth-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
