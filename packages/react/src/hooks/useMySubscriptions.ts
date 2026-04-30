/**
 * Fetch the authenticated subscriber's subscriptions.
 * Auto-runs on mount once authenticated; exposes `refetch` for manual reloads.
 */

import { unwrap, type SubscriptionInfo } from "@recur/sdk";
import { useRecur } from "./useRecur.js";
import { useAuth } from "./useAuth.js";
import { useQuery, type QueryResult } from "../internal/useQuery.js";

export interface UseMySubscriptionsOptions {
  page?: number;
  limit?: number;
}

export function useMySubscriptions(
  options: UseMySubscriptionsOptions = {},
): QueryResult<SubscriptionInfo[]> {
  const { client } = useRecur();
  const { jwt, isAuthenticated } = useAuth();
  const key = `subs:${jwt ?? ""}:${options.page ?? 1}:${options.limit ?? 50}`;

  return useQuery(
    key,
    async () => {
      if (!jwt) throw new Error("Not authenticated");
      return unwrap<SubscriptionInfo[]>(await client.getMySubscriptions(jwt, options));
    },
    { enabled: isAuthenticated },
  );
}
