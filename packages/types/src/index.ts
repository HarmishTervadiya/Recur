import { z } from "zod";

// Must match Prisma enum SubscriptionStatus
export const SubscriptionStatusSchema = z.enum([
  "active",
  "past_due",
  "cancelled",
  "expired",
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

// Must match Prisma enum EventType
export const EventTypeSchema = z.enum([
  "subscription_created",
  "payment_success",
  "payment_failed",
  "cancel_requested",
  "cancel_finalized",
  "cancel_forced",
  "delegation_revoked",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

// Must match Prisma enum WebhookDeliveryStatus
export const WebhookDeliveryStatusSchema = z.enum([
  "pending",
  "delivered",
  "failed",
  "abandoned",
]);
export type WebhookDeliveryStatus = z.infer<typeof WebhookDeliveryStatusSchema>;

// Must match Prisma enum SuperAdminRole
export const SuperAdminRoleSchema = z.enum(["owner", "admin", "viewer"]);
export type SuperAdminRole = z.infer<typeof SuperAdminRoleSchema>;
