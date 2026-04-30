/**
 * `<ErrorMessage>` — `role="alert"` text node used by L1 components.
 * Centralizes the error-display markup so every component renders errors
 * with consistent semantics.
 */

import type { RecurError } from "@recur/sdk";
import * as styles from "../internal/styles.js";

export interface ErrorMessageProps {
  error: RecurError | Error | null;
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  if (!error) return null;
  return (
    <div role="alert" style={styles.errorText}>
      {error.message}
    </div>
  );
}
