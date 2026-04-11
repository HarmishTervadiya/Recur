import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recur — AutoPay Protocol",
  description: "Stripe for Solana — decentralised, automated recurring billing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
