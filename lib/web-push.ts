import { createHash } from "node:crypto";
import webPush from "web-push";
import type { PushSubscriptionRecord } from "@/lib/push-store";

export type WebPushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  eventKey?: string;
  eventType?: string;
  timestamp?: number;
  renotify?: boolean;
};

type WebPushDeliveryProfile = {
  TTL: number;
  urgency: "very-low" | "low" | "normal" | "high";
  topic: string;
  timeout: number;
};

type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

let configuredSignature: string | null = null;

function getVapidConfig(): VapidConfig {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@example.com";
  if (!publicKey || !privateKey) throw new Error("VAPID não configurado.");
  return { publicKey, privateKey, subject };
}

export function isWebPushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function getConfiguredWebPush() {
  const config = getVapidConfig();
  const signature = `${config.subject}:${config.publicKey}:${config.privateKey}`;
  if (signature !== configuredSignature) {
    webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configuredSignature = signature;
  }
  return webPush;
}

export function webPushDeliveryProfile(payload: WebPushPayload): WebPushDeliveryProfile {
  const liveTypes = new Set(["start", "score", "halftime", "resume"]);
  const eventType = payload.eventType || "update";
  const topicSeed = `${payload.eventKey || payload.url}:${eventType === "score" ? "live" : eventType}`;
  const topic = createHash("sha256").update(topicSeed).digest("base64url").slice(0, 24);

  if (liveTypes.has(eventType)) return { TTL: 120, urgency: "high", topic, timeout: 8_000 };
  if (eventType === "final") return { TTL: 10 * 60, urgency: "high", topic, timeout: 8_000 };
  if (eventType === "lineup") return { TTL: 30 * 60, urgency: "normal", topic, timeout: 8_000 };
  return { TTL: 15 * 60, urgency: "high", topic, timeout: 8_000 };
}

export async function sendWebPush(subscription: PushSubscriptionRecord, payload: WebPushPayload) {
  try {
    await getConfiguredWebPush().sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify({ ...payload, timestamp: payload.timestamp || Date.now() }),
      webPushDeliveryProfile(payload),
    );
    return { ok: true, expired: false, statusCode: 201 as number };
  } catch (error) {
    const statusCode = typeof (error as { statusCode?: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 0;
    return {
      ok: false,
      expired: statusCode === 404 || statusCode === 410,
      statusCode,
      errorMessage: error instanceof Error ? error.message : "Falha ao enviar Web Push.",
    };
  }
}
