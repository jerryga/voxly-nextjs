import { NextResponse } from "next/server";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { getBillingHistoryForUser } from "@/lib/billing";
import { requireWorkspaceBillingContext } from "@/lib/workspace-billing";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const billingContext = await requireWorkspaceBillingContext();
    if (!billingContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!billingContext.canViewBillingHistory) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") || "25");
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 100)
        : 25;

    const history = await getBillingHistoryForUser(billingContext.billingUserId, limit);
    return NextResponse.json({ ok: true, history });
  } catch (error) {
    return NextResponse.json(
      { error: getApiErrorMessage(error) },
      { status: getApiErrorStatus(error) },
    );
  }
}
