import { timingSafeEqual } from "node:crypto";
import { getAdminRoleFromCookieHeader } from "@/lib/admin-session";
import type { EditorialRole } from "@/lib/editorial-store";

function matches(expected: string | undefined, provided: string) {
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export function getEditorialRole(request: Request): EditorialRole | null {
  const sessionRole = getAdminRoleFromCookieHeader(request.headers.get("cookie"));
  if (sessionRole) return sessionRole;

  // Bearer tokens remain available for trusted server-to-server integrations only.
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (matches(process.env.LAP_ADMIN_TOKEN, token)) return "admin";
  if (matches(process.env.LAP_EDITOR_TOKEN, token)) return "editor";
  if (matches(process.env.LAP_WRITER_TOKEN, token)) return "writer";
  return null;
}

export function canPublish(role: EditorialRole) { return role === "admin" || role === "editor"; }
export function canArchive(role: EditorialRole) { return role === "admin"; }
