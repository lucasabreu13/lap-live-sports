import { LAP_SHELL_VERSION } from "@/lib/app-version";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    app: "lap-live-sports",
    shell: LAP_SHELL_VERSION,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
