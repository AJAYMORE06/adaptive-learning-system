
import type { InputHTMLAttributes } from "react";
import "./authComponent.css";

type FormInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id"
> & {
  id: string;
  label: string;
  error?: string;
};

export default function FormInput({
  id,
  label,
  error,
  className = "",
  ...inputProps
}: FormInputProps) {
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>
        {label}
      </label>

      <input
        {...inputProps}
        id={id}
        className={`auth-input ${error ? "auth-input-error" : ""} ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />

      {error && (
        <span id={`${id}-error`} className="auth-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
