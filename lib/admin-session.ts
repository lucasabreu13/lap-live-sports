import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { EditorialRole } from "@/lib/editorial-store";
import { getAdminCredential } from "@/lib/admin-credential-store";

export const ADMIN_SESSION_COOKIE = "__Host-lap_admin_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

type AdminSessionPayload = {
  role: "admin";
  expiresAt: number;
};

function safeEqual(expected: string, provided: string) {
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function sessionSecret() {
  const explicit = process.env.LAP_ADMIN_SESSION_SECRET || process.env.LAP_ADMIN_TOKEN;
  if (explicit) return explicit;
  const fallbackMaterial = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!fallbackMaterial) return "";
  return createHash("sha256").update(`lap-admin-session:v1:${fallbackMaterial}`).digest("hex");
}

function encodePayload(payload: AdminSessionPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signPayload(encodedPayload: string) {
  const secret = sessionSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createAdminSessionToken() {
  if (!sessionSecret()) throw new Error("Segredo de sessão administrativa não configurado.");
  const encodedPayload = encodePayload({ role: "admin", expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 });
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyAdminSessionToken(token: string | null | undefined): EditorialRole | null {
  if (!token || !sessionSecret()) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  const expectedSignature = signPayload(encodedPayload);
  if (!safeEqual(expectedSignature, signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AdminSessionPayload;
    if (payload.role !== "admin" || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return null;
    return "admin";
  } catch {
    return null;
  }
}

export function getAdminRoleFromCookieHeader(cookieHeader: string | null | undefined): EditorialRole | null {
  if (!cookieHeader) return null;
  const cookiesMap = new Map(cookieHeader.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index === -1) return [part.trim(), ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
  return verifyAdminSessionToken(cookiesMap.get(ADMIN_SESSION_COOKIE));
}

export async function hasAdminSession() {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value) === "admin";
}

export async function requireAdminSession() {
  if (!(await hasAdminSession())) redirect("/admin/login");
  const credential = await getAdminCredential().catch(() => null);
  if (credential?.must_change_password) redirect("/admin/password");
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
