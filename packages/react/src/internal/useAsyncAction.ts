/**
 * Shared async-action hook: wraps a `Promise`-returning function and exposes
 * `{ isLoading, error, run, reset }`.
 *
 * Used by every action hook (`useSubscribe`, `useCancelSubscription`, etc.)
 * so we never reimplement loading/error state per hook.
 */

import { useCallback, useRef, useState } from "react";
import { mapError, RecurError } from "@recur/sdk";

export interface AsyncActionState<TResult> {
  data: TResult | null;
  isLoading: boolean;
  error: RecurError | null;
}

export interface AsyncAction<TArgs extends unknown[], TResult> extends AsyncActionState<TResult> {
  run: (...args: TArgs) => Promise<TResult>;
  reset: () => void;
}

export function useAsyncAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): AsyncAction<TArgs, TResult> {
  const [state, setState] = useState<AsyncActionState<TResult>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args: TArgs): Promise<TResult> => {
    setState({ data: null, isLoading: true, error: null });
    try {
      const data = await fnRef.current(...args);
      setState({ data, isLoading: false, error: null });
      return data;
    } catch (err) {
      const mapped = mapError(err);
      setState({ data: null, isLoading: false, error: mapped });
      throw mapped;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return { ...state, run, reset };
}
