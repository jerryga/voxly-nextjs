import { prisma } from "@/lib/prisma";
import { requireWorkspaceContext, activeWorkspaceResourceWhere } from "@/lib/workspaces";

export const runtime = "nodejs";

const POLL_INTERVAL_MS = 3000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireWorkspaceContext();
  if (!context) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { id } = await params;
  const where = activeWorkspaceResourceWhere(context);

  const encoder = new TextEncoder();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      async function poll() {
        if (request.signal.aborted) {
          controller.close();
          return;
        }

        try {
          const tx = await prisma.transcription.findFirst({
            where: { id, ...where },
            select: {
              id: true,
              status: true,
              fileName: true,
              template: true,
              projectId: true,
              duration: true,
              transcript: true,
              decisions: true,
              keyPoints: true,
              nextSteps: true,
              actionItems: true,
              createdAt: true,
              updatedAt: true,
            },
          });

          if (!tx) {
            send({ error: "not_found" });
            controller.close();
            return;
          }

          send(tx);

          if (tx.status === "done" || tx.status === "error") {
            controller.close();
            return;
          }
        } catch {
          // DB error — keep stream open and retry next tick
        }

        if (!request.signal.aborted) {
          timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }

      await poll();
    },
    cancel() {
      if (timeoutId !== null) clearTimeout(timeoutId);
    },
  });

  request.signal.addEventListener("abort", () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx/proxy buffering
    },
  });
}
