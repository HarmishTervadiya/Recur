/**
 * Inline style tokens shared by all distributed L1 components.
 *
 * Distributed packages can't ship Tailwind, so we centralize the small set
 * of inline style objects here. Merchants opt into branded look via
 * `import "@recur/react/styles.css"`, which overrides via class names.
 */

import type { CSSProperties } from "react";

export const button: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "10px 16px",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: 1.2,
  border: "1px solid transparent",
  borderRadius: "8px",
  cursor: "pointer",
  backgroundColor: "#7c3aed",
  color: "#ffffff",
  transition: "opacity 120ms ease",
};

export const buttonDisabled: CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};

export const buttonSecondary: CSSProperties = {
  ...button,
  backgroundColor: "transparent",
  color: "#7c3aed",
  borderColor: "#7c3aed",
};

export const card: CSSProperties = {
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: "12px",
  padding: "16px",
  backgroundColor: "#ffffff",
  color: "#0f0f0f",
};

export const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 0",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
};

export const errorText: CSSProperties = {
  color: "#dc2626",
  fontSize: "13px",
  marginTop: "8px",
};

export const modalBackdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

export const modal: CSSProperties = {
  ...card,
  width: "min(420px, 92vw)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
};
