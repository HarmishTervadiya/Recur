import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { WalletProvider } from "../components/providers/WalletProvider";
import { AuthProvider } from "../components/providers/AuthProvider";
import { ToastProvider } from "../components/ui/ToastProvider";
import { ErrorBoundary } from "../components/ui/ErrorBoundary";
import { ScrollAnimator } from "../components/ui/ScrollAnimator";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: '--font-mono' });

export const metadata: Metadata = {
  title: "Recur — Recurring Billing on Solana",
  description: "Stripe for Solana — decentralised, automated recurring billing. Permissionless, borderless, USDC direct to treasury.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <WalletProvider>
          <AuthProvider>
            <ToastProvider>
              <ErrorBoundary>
                <ScrollAnimator />
                {children}
              </ErrorBoundary>
            </ToastProvider>
          </AuthProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
