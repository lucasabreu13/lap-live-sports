import { EditorialHome } from "@/components/editorial-home";
import { getCachedLivePayload } from "@/lib/free-live-data";

export default async function Home() {
  const initialPayload = await getCachedLivePayload({ preferCached: true }).catch(() => null);
  return <EditorialHome initialPayload={initialPayload} />;
}
