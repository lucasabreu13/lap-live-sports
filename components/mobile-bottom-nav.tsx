"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./mobile-bottom-nav.module.css";

const items = [
  { href: "/", icon: "⌂", label: "Início" },
  { href: "/ao-vivo", icon: "●", label: "Ao vivo" },
  { href: "/agenda", icon: "▦", label: "Agenda" },
  { href: "/favoritos", icon: "★", label: "Favoritos" },
  { href: "/cobertura", icon: "◎", label: "Cobertura" },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Navegação principal mobile">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <Link href={item.href} key={item.href} aria-current={active ? "page" : undefined} className={active ? styles.active : undefined}>
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </Link>;
      })}
    </nav>
  );
}
