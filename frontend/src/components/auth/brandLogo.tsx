import "./authComponent.css";

type BrandLogoProps = {
  light?: boolean;
  compact?: boolean;
};

export default function BrandLogo({ light = false, compact = false }: BrandLogoProps) {
  return (
    <div
      className={`brand-logo ${light ? "brand-logo-light" : ""} ${
        compact ? "brand-logo-compact" : ""
      }`}
    >
      <span className="brand-logo-icon" aria-hidden="true">
        ✦
      </span>
      <span>IntelliPrep</span>
    </div>
  );
}
