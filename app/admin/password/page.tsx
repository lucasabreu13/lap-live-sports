import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { changeAdminPassword } from "@/app/admin/actions";
import { getAdminCredential } from "@/lib/admin-credential-store";
import { hasAdminSession } from "@/lib/admin-session";

export const metadata: Metadata = {
  title: "Definir senha administrativa | LAP",
  robots: { index: false, follow: false, nocache: true },
};

type PageProps = { searchParams: Promise<{ error?: string }> };

export default async function AdminPasswordPage({ searchParams }: PageProps) {
  if (!(await hasAdminSession())) redirect("/admin/login");
  const credential = await getAdminCredential();
  if (!credential?.must_change_password) redirect("/admin");
  const { error } = await searchParams;

  return (
    <main className="admin-page">
      <div className="shell" style={{ maxWidth: 560, paddingTop: 80, paddingBottom: 80 }}>
        <section className="editorial-desk__intro">
          <p>Primeiro acesso</p>
          <h1>Crie sua senha administrativa</h1>
          <span>Escolha uma senha exclusiva para a LAP. Ela será armazenada no banco somente como hash com salt e substituirá o acesso temporário.</span>
          <form action={changeAdminPassword} className="editorial-login" style={{ marginTop: 24, display: "grid", gap: 12 }}>
            <input type="password" name="password" autoComplete="new-password" placeholder="Nova senha" minLength={10} required />
            <input type="password" name="confirmPassword" autoComplete="new-password" placeholder="Confirme a nova senha" minLength={10} required />
            <button type="submit">Salvar nova senha</button>
          </form>
          {error === "length" ? <p className="editorial-message editorial-message--error">Use pelo menos 10 caracteres.</p> : null}
          {error === "match" ? <p className="editorial-message editorial-message--error">As senhas não coincidem.</p> : null}
        </section>
      </div>
    </main>
  );
}
