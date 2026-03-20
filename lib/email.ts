type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function getAppOrigin() {
  const baseUrl = process.env.NEXTAUTH_URL?.trim();
  if (!baseUrl) {
    return "http://localhost:3000";
  }

  return baseUrl.replace(/\/+$/, "");
}

export async function sendEmail({ to, subject, html, text }: EmailPayload) {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!resendKey || !from) {
    console.info("Email delivery is not configured. Verification email preview:", {
      to,
      subject,
      html,
      appOrigin: getAppOrigin(),
    });
    return { delivered: false as const };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    const error = new Error(
      `Failed to send email: ${response.status} ${payload}`,
    ) as Error & { statusCode?: number };
    error.statusCode = 502;
    throw error;
  }

  return { delivered: true as const };
}
