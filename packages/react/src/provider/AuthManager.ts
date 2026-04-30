/**
 * AuthManager — JWT cache + nonce-sign-verify flow for `<RecurProvider>`.
 *
 * Storage strategy:
 *   - sessionStorage keyed by wallet pubkey (cleared on tab close)
 *   - Token TTL parsed from JWT `exp`; we refresh when <60s remain
 */

import bs58 from "bs58";
import { AuthError, mapError, NetworkError, type RecurWallet } from "@recur/sdk";

const STORAGE_PREFIX = "recur:auth:";

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  walletAddress: string;
  expiresAt: number;
}

export interface AuthManagerOptions {
  apiBaseUrl: string;
  role?: "subscriber" | "merchant";
}

export class AuthManager {
  private readonly apiBaseUrl: string;
  private readonly role: "subscriber" | "merchant";

  constructor(options: AuthManagerOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, "");
    this.role = options.role ?? "subscriber";
  }

  /** Read cached session from sessionStorage if still valid. */
  load(walletAddress: string): AuthSession | null {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + walletAddress);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as AuthSession;
      if (session.walletAddress !== walletAddress) return null;
      if (session.expiresAt - 60_000 < Date.now()) return null;
      return session;
    } catch {
      return null;
    }
  }

  save(session: AuthSession): void {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      STORAGE_PREFIX + session.walletAddress,
      JSON.stringify(session),
    );
  }

  clear(walletAddress?: string): void {
    if (typeof window === "undefined") return;
    if (walletAddress) {
      window.sessionStorage.removeItem(STORAGE_PREFIX + walletAddress);
    } else {
      for (const key of Object.keys(window.sessionStorage)) {
        if (key.startsWith(STORAGE_PREFIX)) window.sessionStorage.removeItem(key);
      }
    }
  }

  /**
   * Run the full nonce -> sign -> verify flow against the Recur API and
   * return a fresh session. Caller is responsible for caching via `save`.
   */
  async signIn(wallet: RecurWallet): Promise<AuthSession> {
    const walletAddress = wallet.publicKey.toBase58();

    const nonceRes = await this.post<{
      nonce: string;
      message: string;
      expiresAt: string;
    }>("/auth/nonce", { walletAddress, role: this.role });

    const messageBytes = new TextEncoder().encode(nonceRes.message);
    let signature: Uint8Array;
    try {
      signature = await wallet.signMessage(messageBytes);
    } catch (err) {
      throw mapError(err, "Wallet rejected sign-in");
    }

    const verifyRes = await this.post<{
      accessToken: string;
      refreshToken: string;
    }>("/auth/verify", {
      walletAddress,
      role: this.role,
      nonce: nonceRes.nonce,
      signature: bs58.encode(signature),
    });

    return {
      walletAddress,
      accessToken: verifyRes.accessToken,
      refreshToken: verifyRes.refreshToken,
      expiresAt: parseJwtExp(verifyRes.accessToken),
    };
  }

  async refresh(session: AuthSession): Promise<AuthSession> {
    const res = await this.post<{ accessToken: string; refreshToken: string }>(
      "/auth/refresh",
      { refreshToken: session.refreshToken },
    );
    return {
      ...session,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      expiresAt: parseJwtExp(res.accessToken),
    };
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.apiBaseUrl + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new NetworkError("Failed to reach Recur API", err);
    }

    const json = (await res.json()) as {
      success: boolean;
      data: T | null;
      error?: { code: string; message: string } | null;
    };

    if (!json.success || json.data === null) {
      throw new AuthError(json.error?.message ?? "Authentication failed");
    }
    return json.data;
  }
}

function parseJwtExp(token: string): number {
  try {
    const part = token.split(".")[1];
    if (!part) return Date.now() + 15 * 60 * 1000;
    const payload = JSON.parse(atob(part));
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {
    // fall through
  }
  return Date.now() + 15 * 60 * 1000;
}
