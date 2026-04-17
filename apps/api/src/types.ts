import type { Request } from "express";

/** JWT payload shape — attached to req.user after authentication. */
export interface AuthPayload {
  walletAddress: string;
  role: "merchant" | "subscriber";
}

/** Augment Express Request with optional authenticated user. */
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
