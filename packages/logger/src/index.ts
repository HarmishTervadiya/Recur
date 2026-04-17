import pino from "pino";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogMeta {
  [key: string]: unknown;
}

const isProd = process.env["NODE_ENV"] === "production";

function createBaseLogger(name: string, level?: LogLevel): pino.Logger {
  return pino({
    name,
    level: level ?? process.env["LOG_LEVEL"] ?? "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    ...(isProd
      ? {}
      : {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "yyyy-mm-dd HH:MM:ss.l",
              ignore: "pid,hostname",
            },
          },
        }),
  });
}

export function createLogger(name: string, level?: LogLevel): pino.Logger {
  return createBaseLogger(name, level);
}

export const logger = createLogger("recur");
