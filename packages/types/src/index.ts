import { z } from "zod";

export const SubscriptionStatusSchema = z.enum(["ACTIVE", "CANCELLED", "PAST_DUE"]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const EventTypeSchema = z.enum([
  "PAYMENT_SUCCESS",
  "PAYMENT_FAILED",
  "INSUFFICIENT_FUNDS",
  "SUBSCRIPTION_CANCELLED",
]);
export type EventType = z.infer<typeof EventTypeSchema>;
