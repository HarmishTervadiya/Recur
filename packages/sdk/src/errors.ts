/**
 * Typed error classes for Recur SDK.
 *
 * All public SDK methods throw these instead of generic `Error`s so
 * merchants can `instanceof`-check and render targeted UI.
 */

export class RecurError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = "RecurError";
    this.code = code;
    this.cause = cause;
  }
}

export class WalletRejectedError extends RecurError {
  constructor(cause?: unknown) {
    super("WALLET_REJECTED", "Wallet rejected the request", cause);
    this.name = "WalletRejectedError";
  }
}

export class InsufficientFundsError extends RecurError {
  readonly required?: bigint;
  constructor(message = "Insufficient funds", required?: bigint, cause?: unknown) {
    super("INSUFFICIENT_FUNDS", message, cause);
    this.name = "InsufficientFundsError";
    this.required = required;
  }
}

export class DelegationExhaustedError extends RecurError {
  constructor(cause?: unknown) {
    super(
      "DELEGATION_EXHAUSTED",
      "Subscription delegation is exhausted; re-approve required",
      cause,
    );
    this.name = "DelegationExhaustedError";
  }
}

export class PlanInactiveError extends RecurError {
  constructor(planId: string, cause?: unknown) {
    super("PLAN_INACTIVE", `Plan ${planId} is not active`, cause);
    this.name = "PlanInactiveError";
  }
}

export class SubscriptionAlreadyExistsError extends RecurError {
  constructor(cause?: unknown) {
    super(
      "SUBSCRIPTION_EXISTS",
      "An active subscription for this plan already exists",
      cause,
    );
    this.name = "SubscriptionAlreadyExistsError";
  }
}

export class NetworkError extends RecurError {
  constructor(message = "Network request failed", cause?: unknown) {
    super("NETWORK_ERROR", message, cause);
    this.name = "NetworkError";
  }
}

export class AuthError extends RecurError {
  constructor(message = "Authentication failed", cause?: unknown) {
    super("AUTH_ERROR", message, cause);
    this.name = "AuthError";
  }
}

/**
 * Map an arbitrary thrown value (RPC error, fetch error, API envelope error)
 * into a typed `RecurError` subclass. Falls back to `RecurError` if no match.
 */
export function mapError(err: unknown, fallbackMessage = "Unknown error"): RecurError {
  if (err instanceof RecurError) return err;

  const msg = errorMessage(err).toLowerCase();

  if (msg.includes("user rejected") || msg.includes("user denied")) {
    return new WalletRejectedError(err);
  }
  if (msg.includes("insufficient") && (msg.includes("fund") || msg.includes("lamport"))) {
    return new InsufficientFundsError(undefined, undefined, err);
  }
  if (msg.includes("delegated amount") || msg.includes("delegation")) {
    return new DelegationExhaustedError(err);
  }
  if (msg.includes("plan_inactive") || msg.includes("plan inactive")) {
    return new PlanInactiveError("unknown", err);
  }
  if (msg.includes("subscription_exists") || msg.includes("already exists")) {
    return new SubscriptionAlreadyExistsError(err);
  }
  if (msg.includes("network") || msg.includes("fetch failed")) {
    return new NetworkError(undefined, err);
  }
  if (msg.includes("unauthorized") || msg.includes("auth")) {
    return new AuthError(undefined, err);
  }

  return new RecurError("UNKNOWN", fallbackMessage, err);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "";
}
