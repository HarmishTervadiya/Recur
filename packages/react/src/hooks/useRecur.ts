/**
 * Access the active `RecurClient` and provider config.
 * Throws if called outside `<RecurProvider>`.
 */

import { useContext } from "react";
import { RecurContext, type RecurContextValue } from "../provider/RecurProvider.js";
import { RecurError } from "@recur/sdk";

export function useRecur(): RecurContextValue {
  const ctx = useContext(RecurContext);
  if (!ctx) {
    throw new RecurError(
      "PROVIDER_MISSING",
      "useRecur() called outside <RecurProvider>. Wrap your app in <RecurProvider apiBaseUrl=... cluster=...>.",
    );
  }
  return ctx;
}
