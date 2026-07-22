import { EditorialHome } from "@/components/editorial-home";
import { getCachedLivePayload } from "@/lib/free-live-data";
import { toPublicLivePayload } from "@/lib/public-sports";

export default async function Home() {
  const rawPayload = await getCachedLivePayload({ preferCached: true }).catch(() => null);
  const initialPayload = rawPayload ? toPublicLivePayload(rawPayload) : null;
  return <EditorialHome initialPayload={initialPayload} />;
}
