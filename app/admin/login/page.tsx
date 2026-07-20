import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginAdmin } from "@/app/admin/actions";
import { hasAdminSession } from "@/lib/admin-session";

export const metadata: Metadata = {
  title: "Acesso administrativo | LAP",
  robots: { index: false, follow: false, nocache: true },
};

type PageProps = { searchParams: Promise<{ error?: string }> };

export default async function AdminLoginPage({ searchParams }: PageProps) {
  if (await hasAdminSession()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <main className="admin-page">
      <div className="shell" style={{ maxWidth: 520, paddingTop: 80, paddingBottom: 80 }}>
        <section className="editorial-desk__intro">
          <p>Área restrita</p>
          <h1>Acesso administrativo da LAP</h1>
          <span>Entre com a senha administrativa. A autenticação acontece somente no servidor e a sessão é armazenada em cookie HttpOnly.</span>
          <form action={loginAdmin} className="editorial-login" style={{ marginTop: 24 }}>
            <input type="password" name="password" autoComplete="current-password" placeholder="Senha administrativa" required />
            <button type="submit">Entrar</button>
          </form>
          {error ? <p className="editorial-message editorial-message--error">Senha inválida.</p> : null}
        </section>
      </div>
    </main>
  );
}
