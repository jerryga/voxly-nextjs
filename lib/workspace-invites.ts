import { randomBytes } from "node:crypto";
import { sendEmail } from "@/lib/email";

export function createWorkspaceInviteToken() {
  return randomBytes(24).toString("hex");
}

export function getWorkspaceInviteExpiration(days = 7) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt;
}

export async function sendWorkspaceInviteEmail(input: {
  to: string;
  workspaceName: string;
  invitedByName: string;
  token: string;
  expiresInDays?: number;
}) {
  const appOrigin = (process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
  const inviteUrl = `${appOrigin}/invite/${encodeURIComponent(input.token)}`;
  const expiresInDays = input.expiresInDays || 7;

  return sendEmail({
    to: input.to,
    subject: `You have been invited to ${input.workspaceName} on Voxly`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h2 style="margin-bottom: 12px;">Workspace invitation</h2>
        <p><strong>${input.invitedByName}</strong> invited you to join <strong>${input.workspaceName}</strong> on Voxly.</p>
        <p>Use the button below to accept the invitation:</p>
        <p style="margin: 20px 0;">
          <a href="${inviteUrl}" style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #0f172a; color: white; text-decoration: none; font-weight: 700;">Accept invite</a>
        </p>
        <p>If the button does not work, open this link:</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
        <p>This invitation expires in ${expiresInDays} days.</p>
      </div>
    `,
    text: `${input.invitedByName} invited you to join ${input.workspaceName} on Voxly. Accept here: ${inviteUrl}. This invitation expires in ${expiresInDays} days.`,
  });
}
