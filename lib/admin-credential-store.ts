import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

type CredentialRow = {
  id: string;
  password_salt: string;
  password_hash: string;
  must_change_password: boolean;
  updated_at: string;
};

type SupabaseConfig = { url: string; serviceRoleKey: string };

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

async function request(path: string, init?: RequestInit) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Banco de credenciais administrativas não configurado.");

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha no cofre administrativo (${response.status}): ${detail}`);
  }

  return response;
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function deriveHash(password: string, salt: Buffer) {
  return scryptSync(password, salt, 64);
}

export async function getAdminCredential(): Promise<CredentialRow | null> {
  const params = new URLSearchParams({
    select: "id,password_salt,password_hash,must_change_password,updated_at",
    id: "eq.primary",
    limit: "1",
  });
  const response = await request(`lap_admin_credentials?${params.toString()}`);
  const rows = (await response.json()) as CredentialRow[];
  return rows[0] ?? null;
}

export async function verifyStoredAdminPassword(password: string) {
  const credential = await getAdminCredential();
  if (!credential) return { valid: false, mustChangePassword: false, configured: false };

  const salt = decodeBase64Url(credential.password_salt);
  const expected = decodeBase64Url(credential.password_hash);
  const actual = deriveHash(password, salt);
  const valid = expected.length === actual.length && timingSafeEqual(expected, actual);

  return {
    valid,
    mustChangePassword: valid && credential.must_change_password,
    configured: true,
  };
}

export async function saveAdminPassword(password: string, mustChangePassword = false) {
  const salt = randomBytes(16);
  const hash = deriveHash(password, salt);
  const payload = {
    id: "primary",
    password_salt: salt.toString("base64url"),
    password_hash: hash.toString("base64url"),
    must_change_password: mustChangePassword,
    updated_at: new Date().toISOString(),
  };

  const response = await request("lap_admin_credentials?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload),
  });

  const rows = (await response.json()) as CredentialRow[];
  if (!rows[0]) throw new Error("O banco não confirmou a atualização da senha.");
  return rows[0];
}
