import type { NewsItem } from "@/lib/live-data";

function newsKey(item: NewsItem) {
  return item.slug || item.id;
}

export function curateHomepageNews(items: NewsItem[]) {
  const unique = Array.from(new Map(items.map((item) => [newsKey(item), item])).values());
  if (unique.length <= 1) return unique;

  const selected: NewsItem[] = [unique[0]];
  const used = new Set([newsKey(unique[0])]);
  const sportCounts = new Map<string, number>([[unique[0].sportId, 1]]);

  const take = (limitPerSport: number, target: number) => {
    for (const item of unique) {
      if (selected.length >= target) break;
      if (used.has(newsKey(item))) continue;
      const current = sportCounts.get(item.sportId) || 0;
      if (current >= limitPerSport) continue;
      selected.push(item);
      used.add(newsKey(item));
      sportCounts.set(item.sportId, current + 1);
    }
  };

  // Manchete + quatro secundárias: no máximo duas do mesmo esporte.
  take(2, 5);
  // Grade seguinte: permite até três do mesmo esporte.
  take(3, 13);

  // Se não houver variedade suficiente, completa pela ordem editorial original.
  for (const item of unique) {
    if (selected.length >= 13) break;
    if (used.has(newsKey(item))) continue;
    selected.push(item);
    used.add(newsKey(item));
  }

  return selected;
}
