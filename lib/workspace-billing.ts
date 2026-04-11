import { prisma } from "@/lib/prisma";
import { canManageWorkspace, requireWorkspaceContext } from "@/lib/workspaces";

export async function requireWorkspaceBillingContext() {
  const context = await requireWorkspaceContext();
  if (!context) {
    return null;
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: context.activeWorkspace.id },
    select: {
      id: true,
      name: true,
      isPersonal: true,
      ownerUserId: true,
      owner: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!workspace) {
    return null;
  }

  const canManageBilling = canManageWorkspace(context.role);

  return {
    context,
    workspace,
    billingOwner: workspace.owner,
    billingUserId: workspace.ownerUserId,
    billingScope:
      workspace.ownerUserId === context.user.id ? "personal" : "workspace_owner",
    canManageBilling,
    canViewBillingHistory: canManageBilling,
  };
}
