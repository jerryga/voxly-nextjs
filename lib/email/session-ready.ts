import { sendEmail } from "@/lib/email";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendSessionReadyEmail(input: {
  to: string;
  userName: string | null | undefined;
  fileName: string;
  summarySnippet: string;
  sessionUrl: string;
}): Promise<{ delivered: boolean }> {
  const firstName = input.userName?.trim().split(" ")[0];
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi there,";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your recording is ready</title>
</head>
<body style="margin:0;padding:0;background:#f6f6f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f3;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:24px;">
              <span style="font-size:15px;font-weight:700;color:#111827;letter-spacing:-0.01em;">Voxly</span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:20px;padding:32px 32px 28px;border:1px solid #e5e7eb;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:#f97316;">
                Recording ready
              </p>
              <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">
                ${greeting}
              </h1>
              <p style="margin:0 0 20px;font-size:18px;font-weight:600;color:#0f172a;">
                Your notes are ready.
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;">
                From <strong style="color:#334155;">${escapeHtml(input.fileName)}</strong>
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#1e293b;line-height:1.65;background:#f8fafc;border-left:3px solid #f97316;padding:12px 16px;border-radius:0 8px 8px 0;">
                ${escapeHtml(input.summarySnippet)}
              </p>
              <a href="${escapeHtml(input.sessionUrl)}"
                 style="display:inline-block;background:#111827;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:100px;">
                View in Voxly →
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                You received this because you processed a recording with Voxly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    input.userName?.trim() ? `Hi ${input.userName.trim().split(" ")[0]},` : "Hi there,",
    "",
    `Your recording "${input.fileName}" has been processed.`,
    "",
    input.summarySnippet,
    "",
    `View your session: ${input.sessionUrl}`,
    "",
    "—",
    "Voxly",
  ].join("\n");

  return sendEmail({
    to: input.to,
    subject: `Your recording "${input.fileName}" is ready`,
    html,
    text,
  });
}
