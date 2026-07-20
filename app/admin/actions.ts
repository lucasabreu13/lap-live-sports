"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { clearAdminSession, hasAdminSession, setAdminSession } from "@/lib/admin-session";
import { ADMIN_PASSWORD_SHA256 } from "@/lib/admin-password-hash";
import { saveAdminPassword, verifyStoredAdminPassword } from "@/lib/admin-credential-store";

function matchesBootstrapPassword(password: string) {
  const candidate = createHash("sha256").update(password.trim()).digest("hex");
  const expected = Buffer.from(ADMIN_PASSWORD_SHA256);
  const provided = Buffer.from(candidate);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export async function loginAdmin(formData: FormData) {
  const password = String(formData.get("password") || "");
  const stored = await verifyStoredAdminPassword(password);

  if (!stored.configured) {
    if (!matchesBootstrapPassword(password)) redirect("/admin/login?error=1");
    await saveAdminPassword(password, true);
    await setAdminSession();
    redirect("/admin/password");
  }

  if (!stored.valid) redirect("/admin/login?error=1");
  await setAdminSession();
  redirect(stored.mustChangePassword ? "/admin/password" : "/admin");
}

export async function changeAdminPassword(formData: FormData) {
  if (!(await hasAdminSession())) redirect("/admin/login");

  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  if (password.length < 10) redirect("/admin/password?error=length");
  if (password !== confirmPassword) redirect("/admin/password?error=match");

  await saveAdminPassword(password, false);
  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin/login");
}
