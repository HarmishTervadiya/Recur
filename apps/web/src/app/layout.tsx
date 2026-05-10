import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { WalletProvider } from "../components/providers/WalletProvider";
import { AuthProvider } from "../components/providers/AuthProvider";
import { ThemeProvider } from "../components/providers/ThemeProvider";
import { ToastProvider } from "../components/ui/ToastProvider";
import { ErrorBoundary } from "../components/ui/ErrorBoundary";
import { ScrollAnimator } from "../components/ui/ScrollAnimator";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

// export const metadata: Metadata = {
//   title: "Recur — Recurring Billing on Solana",
//   description:
//     "Stripe for Solana — decentralised, automated recurring billing. Permissionless, borderless, USDC direct to treasury.",
// };

export const metadata: Metadata = {
  metadataBase: new URL("https://recur-web.vercel.app"),

  title: "Recur - Recurring Billing on Solana",

  description:
    "Stripe for Solana — decentralised, automated recurring billing. Permissionless, borderless, USDC direct to treasury.",

  keywords: [
    "solana",
    "recurring billing",
    "crypto subscriptions",
    "usdc payments",
    "solana sdk",
    "web3 payments",
    "on-chain billing",
    "recur",
  ],

  authors: [{ name: "Recur" }],

  creator: "Recur",

  publisher: "Recur",

  applicationName: "Recur",

  alternates: {
    canonical: "/",
  },

  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },

  openGraph: {
    type: "website",
    url: "https://recur-web.vercel.app",
    siteName: "Recur",

    title: "Recur — On-chain Recurring Billing for Solana",

    description:
      "Users sign once, keepers collect automatically, merchants get USDC direct to wallet. No bank, no KYC, no EVM.",

    images: [
      {
        url: "/banner.jpg",
        width: 1200,
        height: 630,
        alt: "Recur Banner",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    site: "@RecurSolana",
    creator: "@RecurSolana",

    title: "Recur — On-chain Recurring Billing for Solana",

    description:
      "Users sign once, keepers collect automatically, merchants get USDC direct to wallet. No bank, no KYC, no EVM.",

    images: ["/banner.jpg"],
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <WalletProvider>
          <AuthProvider>
            <ThemeProvider>
              <ToastProvider>
                <ErrorBoundary>
                  <ScrollAnimator />
                  {children}
                </ErrorBoundary>
              </ToastProvider>
            </ThemeProvider>
          </AuthProvider>
        </WalletProvider>

        <Analytics />
      </body>
    </html>
  );
}
