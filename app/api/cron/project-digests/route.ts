import { NextResponse } from "next/server";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { sendDueProjectDigests } from "@/lib/project-digests";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.PROJECT_DIGEST_CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization")?.trim();
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : request.headers.get("x-cron-secret")?.trim();

  return token === secret;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await sendDueProjectDigests();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
