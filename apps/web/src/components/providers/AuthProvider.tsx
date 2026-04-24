"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { apiClient, setTokens, clearTokens } from "../../lib/api-client";

interface AuthContextType {
  walletAddress: string | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isSigningIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  walletAddress: null,
  isAuthenticated: false,
  isAuthLoading: true,
  isSigningIn: false,
  signIn: async () => {},
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { publicKey, signMessage, disconnect, connected } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Check for existing token on mount — validate JWT expiry
  useEffect(() => {
    const token = localStorage.getItem("recur_access_token");
    if (token && connected) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.exp && payload.exp * 1000 > Date.now()) {
          setIsAuthenticated(true);
        } else {
          // Token expired — clear it
          clearTokens();
          setIsAuthenticated(false);
        }
      } catch {
        clearTokens();
        setIsAuthenticated(false);
      }
    } else {
      setIsAuthenticated(false);
    }
    setIsAuthLoading(false);
  }, [connected]);

  // If wallet disconnects, clear auth
  useEffect(() => {
    if (!connected) {
      setIsAuthenticated(false);
    }
  }, [connected]);

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) return;
    setIsSigningIn(true);

    try {
      const walletAddress = publicKey.toBase58();

      // 1. Request nonce
      const nonceRes = await apiClient<{
        nonce: string;
        message: string;
        expiresAt: string;
      }>("/auth/nonce", {
        method: "POST",
        body: JSON.stringify({ walletAddress, role: "merchant" }),
      });

      if (!nonceRes.success || !nonceRes.data) {
        throw new Error(nonceRes.error?.message || "Failed to get nonce");
      }

      // 2. Sign the message
      const messageBytes = new TextEncoder().encode(nonceRes.data.message);
      const signature = await signMessage(messageBytes);
      const signatureB58 = bs58.encode(signature);

      // 3. Verify signature
      const verifyRes = await apiClient<{
        accessToken: string;
        refreshToken: string;
      }>("/auth/verify", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          role: "merchant",
          nonce: nonceRes.data.nonce,
          signature: signatureB58,
        }),
      });

      if (!verifyRes.success || !verifyRes.data) {
        throw new Error(verifyRes.error?.message || "Verification failed");
      }

      // 4. Store tokens
      setTokens(verifyRes.data.accessToken, verifyRes.data.refreshToken);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Sign in failed:", error);
      clearTokens();
      setIsAuthenticated(false);
    } finally {
      setIsSigningIn(false);
    }
  }, [publicKey, signMessage]);

  const signOut = useCallback(() => {
    clearTokens();
    setIsAuthenticated(false);
    disconnect();
  }, [disconnect]);

  const walletAddress = publicKey?.toBase58() ?? null;

  return (
    <AuthContext.Provider
      value={{ walletAddress, isAuthenticated, isAuthLoading, isSigningIn, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
