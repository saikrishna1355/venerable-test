export const runtime = 'nodejs';

import { getStore } from '@/lib/store';

export async function GET() {
  const store = getStore();

  let unsubscribe: (() => void) | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const finalize = () => {
        if (closed) return;
        closed = true;
        if (unsubscribe) {
          try { unsubscribe(); } catch {}
          unsubscribe = null;
        }
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
      };
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          finalize();
        }
      };

      const send = (event: unknown) => {
        safeEnqueue(`data: ${JSON.stringify(event)}\n\n`);
      };

      unsubscribe = store.subscribe((evt) => send(evt));
      // ping to keep-alive
      intervalId = setInterval(() => { if (!closed) safeEnqueue(': ping\n\n'); }, 15000);
      // send initial noop
      send({ type: 'hello' });
    },
    cancel() {
      closed = true;
      if (unsubscribe) { try { unsubscribe(); } catch {} unsubscribe = null; }
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
