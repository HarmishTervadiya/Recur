/**
 * Client-side import guard.
 *
 * `@recur/server` is Node-only. If a bundler resolves this file (because the
 * environment is not Node), throw a clear error instead of producing a
 * confusing runtime crash on `crypto.createHmac` or similar Node APIs.
 */

throw new Error(
  "@recur/server is server-only. Do not import it from client code (browser, React component, etc).",
);

export {};
