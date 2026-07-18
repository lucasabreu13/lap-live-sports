import type { EspnStandingEntry, EspnStandingGroup } from "@/lib/providers/espn-provider";
import styles from "./standing-groups.module.css";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LAP";
}

function columns(entries: EspnStandingEntry[]) {
  const result = new Map<string, string>();
  for (const entry of entries) {
    for (const value of entry.values) {
      if (value.key === "rank" || value.key === "playoffseed") continue;
      if (!result.has(value.key)) result.set(value.key, value.label);
      if (result.size >= 5) return [...result.entries()];
    }
  }
  return [...result.entries()];
}

function valueFor(entry: EspnStandingEntry, key: string) {
  return entry.values.find((value) => value.key === key)?.value ?? "—";
}

export function StandingGroups({ groups, limit = 16 }: { groups: EspnStandingGroup[]; limit?: number }) {
  return (
    <div className={styles.groups}>
      {groups.map((group) => {
        const visible = group.entries.slice(0, limit);
        const visibleColumns = columns(visible);
        return (
          <article className={styles.group} key={group.id}>
            <header><h3>{group.name}</h3><span>{group.entries.length} participantes</span></header>
            <div className={styles.scroll}>
              <table>
                <thead><tr><th>Pos.</th><th>Equipe ou atleta</th>{visibleColumns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
                <tbody>{visible.map((entry, index) => <tr key={entry.id}><td>{entry.position ?? index + 1}</td><td><span className={styles.mark}>{entry.logo ? <img src={entry.logo} alt="" width="26" height="26" loading="lazy" /> : <span>{initials(entry.name)}</span>}</span><strong>{entry.shortName || entry.name}</strong></td>{visibleColumns.map(([key]) => <td key={key}>{valueFor(entry, key)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </article>
        );
      })}
    </div>
  );
}
