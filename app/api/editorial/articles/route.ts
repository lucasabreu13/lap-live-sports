import { canArchive, canPublish, getEditorialRole } from "@/lib/editorial-auth";
import { createEditorialArticle, getEditorialArticlesForAdmin, updateEditorialArticle, type CreateEditorialArticleInput, type EditorialArticleStatus } from "@/lib/editorial-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function unauthorized() { return Response.json({ error: "Acesso editorial não autorizado." }, { status: 401 }); }

function allowedStatus(role: NonNullable<ReturnType<typeof getEditorialRole>>, status: EditorialArticleStatus | undefined) {
  if (!status) return true;
  if (status === "archived") return canArchive(role);
  if (status === "published" || status === "scheduled") return canPublish(role);
  return true;
}

export async function GET(request: Request) {
  const role = getEditorialRole(request);
  if (!role) return unauthorized();
  const articles = await getEditorialArticlesForAdmin(80);
  return Response.json({ role, articles }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const role = getEditorialRole(request);
  if (!role) return unauthorized();
  try {
    const body = await request.json() as CreateEditorialArticleInput;
    if (!allowedStatus(role, body.status)) return Response.json({ error: "Seu perfil não pode publicar ou agendar matérias." }, { status: 403 });
    const article = await createEditorialArticle({ ...body, status: role === "writer" && (body.status === "published" || body.status === "scheduled") ? "in_review" : body.status });
    return Response.json({ article }, { status: 201, headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a matéria." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const role = getEditorialRole(request);
  if (!role) return unauthorized();
  try {
    const body = await request.json() as { id?: string; status?: EditorialArticleStatus; [key: string]: unknown };
    if (!body.id) return Response.json({ error: "Informe a matéria a atualizar." }, { status: 400 });
    if (!allowedStatus(role, body.status)) return Response.json({ error: "Seu perfil não pode executar esta alteração." }, { status: 403 });
    const article = await updateEditorialArticle(body as Parameters<typeof updateEditorialArticle>[0]);
    return Response.json({ article }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível atualizar a matéria." }, { status: 400 });
  }
}
