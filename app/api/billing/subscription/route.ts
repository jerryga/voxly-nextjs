import { NextResponse } from "next/server";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { getBillingSnapshotForUser } from "@/lib/billing";
import { requireWorkspaceBillingContext } from "@/lib/workspace-billing";

export const runtime = "nodejs";

export async function GET() {
  try {
    const billingContext = await requireWorkspaceBillingContext();
    if (!billingContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await getBillingSnapshotForUser(billingContext.billingUserId);
    const billing = {
      ...snapshot,
      workspace: {
        id: billingContext.workspace.id,
        name: billingContext.workspace.name,
        isPersonal: billingContext.workspace.isPersonal,
        viewerRole: billingContext.context.role,
      },
      billingOwner: {
        userId: billingContext.billingOwner.id,
        email: billingContext.billingOwner.email,
        name: billingContext.billingOwner.name,
      },
      billingScope: billingContext.billingScope,
      canManageBilling: billingContext.canManageBilling,
      canViewBillingHistory: billingContext.canViewBillingHistory,
    };

    return NextResponse.json({ ok: true, billing });
  } catch (error) {
    return NextResponse.json(
      { error: getApiErrorMessage(error) },
      { status: getApiErrorStatus(error) },
    );
  }
}
