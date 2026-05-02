/**
 * Browser polyfills for Solana SDK compatibility.
 *
 * Next.js (webpack 5) no longer auto-polyfills Node.js globals.
 * The @recur/sdk uses Buffer.writeBigUInt64LE() which requires the
 * full Buffer implementation to be available as a global.
 *
 * This file MUST be imported before any Solana/SDK code runs.
 */

import { Buffer } from "buffer";

if (typeof globalThis !== "undefined" && !globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

if (typeof window !== "undefined" && !window.Buffer) {
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}
