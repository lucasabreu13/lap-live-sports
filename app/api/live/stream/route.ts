import { getCachedLivePayload } from "@/lib/free-live-data";
import { subscribeToLiveEvents } from "@/lib/live-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const encoder = new TextEncoder();

function formatEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = () => {
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        if (timeout) clearTimeout(timeout);
        try { controller.close(); } catch { /* Stream já encerrado. */ }
      };

      request.signal.addEventListener("abort", close, { once: true });
      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      try {
        const payload = await getCachedLivePayload();
        controller.enqueue(formatEvent("snapshot", payload));
      } catch {
        controller.enqueue(encoder.encode("event: heartbeat\ndata: {\"status\":\"waiting\"}\n\n"));
      }

      unsubscribe = subscribeToLiveEvents((event) => {
        try {
          if (event.type === "score") controller.enqueue(formatEvent("score", event.patch));
          if (event.type === "snapshot") controller.enqueue(formatEvent("snapshot", event.payload));
        } catch {
          close();
        }
      });

      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`)); } catch { close(); }
      }, 12_000);

      // Conexões SSE curtas evitam conexões presas em plataformas serverless; o navegador reconecta automaticamente.
      timeout = setTimeout(close, 50_000);
    },
    cancel() {
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
      if (timeout) clearTimeout(timeout);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
