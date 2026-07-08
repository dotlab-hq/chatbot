import Redis from "ioredis";

import { isProductionEnvironment } from "@/lib/constants";
import { ChatbotError } from "@/lib/errors";

const MAX_MESSAGES = 10;
const TTL_SECONDS = 60 * 60;

let client: Redis | null = null;

function getClient() {
  if (!client && process.env.REDIS_URL) {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    client.on("error", () => undefined);
    client.connect().catch(() => {
      client = null;
    });
  }
  return client;
}

export async function checkIpRateLimit(ip: string | undefined) {
  if (!isProductionEnvironment || !ip) {
    return;
  }

  const redis = getClient();
  if (redis?.status !== "ready") {
    return;
  }

  try {
    const key = `ip-rate-limit:${ip}`;
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, TTL_SECONDS, "NX");
    const results = await pipeline.exec();
    if (!results) {
      return;
    }
    const [, count] = results[0] ?? [];
    if (typeof count === "number" && count > MAX_MESSAGES) {
      throw new ChatbotError("rate_limit:chat");
    }
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
  }
}
