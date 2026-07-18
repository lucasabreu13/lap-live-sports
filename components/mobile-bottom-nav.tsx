import Link from "next/link";
import styles from "./mobile-bottom-nav.module.css";

const items = [
  { href: "/", icon: "⌂", label: "Início" },
  { href: "/ao-vivo", icon: "●", label: "Ao vivo" },
  { href: "/agenda", icon: "▦", label: "Agenda" },
  { href: "/favoritos", icon: "★", label: "Favoritos" },
  { href: "/cobertura", icon: "◎", label: "Cobertura" },
];

export function MobileBottomNav() {
  return (
    <nav className={styles.nav} aria-label="Navegação principal mobile">
      {items.map((item) => (
        <Link href={item.href} key={item.href}>
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
