export interface AuthPayload {
  walletAddress: string;
  role: "merchant" | "subscriber";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
