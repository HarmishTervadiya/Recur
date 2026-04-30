/**
 * Shared query hook: fetches data on mount + when `key` changes, exposes
 * `{ data, isLoading, error, refetch }`. No external state library required.
 *
 * Used by every read hook (`useMySubscriptions`, `usePlan`, `usePlans`).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { mapError, RecurError } from "@recur/sdk";

export interface QueryState<T> {
  data: T | null;
  isLoading: boolean;
  error: RecurError | null;
}

export interface QueryResult<T> extends QueryState<T> {
  refetch: () => Promise<void>;
}

export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { enabled?: boolean } = {},
): QueryResult<T> {
  const enabled = options.enabled !== false;
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    isLoading: enabled,
    error: null,
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      setState({ data, isLoading: false, error: null });
    } catch (err) {
      setState({ data: null, isLoading: false, error: mapError(err) });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void run();
  }, [key, enabled, run]);

  return { ...state, refetch: run };
}
