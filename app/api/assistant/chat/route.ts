import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyAssistantChat } from "@/lib/llm/agent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const summary = typeof body?.summary === "object" ? body.summary : {};
  const provider =
    typeof body?.provider === "string" ? body.provider : undefined;
  const model = typeof body?.model === "string" ? body.model : undefined;

  const message = await applyAssistantChat({
    messages,
    summary,
    provider,
    model,
  });

  return NextResponse.json({ ok: true, message });
}
