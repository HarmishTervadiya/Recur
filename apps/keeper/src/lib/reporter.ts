import { env } from "@recur/config";
import { createLogger } from "@recur/logger";

const logger = createLogger("reporter");

const headers = {
  "Content-Type": "application/json",
  "X-Keeper-Secret": env.KEEPER_SECRET,
};

async function post(
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  const url = `${env.API_URL}/keeper${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.error(
        { url, status: res.status, body: text },
        "Reporter POST failed",
      );
    }
  } catch (err) {
    logger.error({ url, err }, "Reporter network error");
  }
}

export async function reportPaymentResult(data: {
  subscriptionPda: string;
  txSignature: string;
  amountGross: string;
  platformFee: string;
  amountNet: string;
  confirmedAt: string;
}): Promise<void> {
  await post("/payment", data);
}

export async function reportPaymentFailed(data: {
  subscriptionPda: string;
  txSignature: string;
  amountGross: string;
  platformFee: string;
  amountNet: string;
}): Promise<void> {
  await post("/payment-failed", data);
}

export async function reportCancelResult(data: {
  subscriptionPda: string;
  cancelType: "request" | "force" | "finalize";
  confirmedAt: string;
}): Promise<void> {
  await post("/cancel", data);
}
