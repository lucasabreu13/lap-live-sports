import { logoutAdmin } from "@/app/admin/actions";

export function AdminLogoutButton() {
  return (
    <form action={logoutAdmin}>
      <button type="submit" className="section-link">Sair</button>
    </form>
  );
}
