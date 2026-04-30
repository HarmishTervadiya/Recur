/**
 * Public plan queries.
 *
 * - `usePlan(appId, planId)` — single plan with merchant info
 * - `usePlans(appId)` — all active plans for an app
 *
 * Both unauthenticated; safe to render on landing pages.
 */

import { unwrap, type PlanInfo } from "@recur/sdk";
import { useRecur } from "./useRecur.js";
import { useQuery, type QueryResult } from "../internal/useQuery.js";

export function usePlan(appId: string, planId: string): QueryResult<PlanInfo> {
  const { client } = useRecur();
  return useQuery(`plan:${appId}:${planId}`, async () =>
    unwrap<PlanInfo>(await client.getPlan(appId, planId)),
  );
}

export function usePlans(appId: string): QueryResult<PlanInfo[]> {
  const { client } = useRecur();
  return useQuery(`plans:${appId}`, async () =>
    unwrap<PlanInfo[]>(await client.getPlans(appId)),
  );
}
