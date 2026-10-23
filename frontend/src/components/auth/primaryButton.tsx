
import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./authComponent.css";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  children: ReactNode;
};

export default function PrimaryButton({
  loading = false,
  disabled,
  children,
  className = "",
  type = "submit",
  ...buttonProps
}: PrimaryButtonProps) {
  return (
    <button
      {...buttonProps}
      type={type}
      className={`auth-primary-button ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading ? "Please wait..." : children}
    </button>
  );
}
