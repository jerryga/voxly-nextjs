import Link from "next/link";
import { verifyEmailToken } from "@/lib/email-verification";

type SearchParams = Promise<{
  email?: string;
  token?: string;
}>;

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const email = params.email?.trim() || "";
  const token = params.token?.trim() || "";

  let title = "Verify your email";
  let message =
    "Open the verification link from your inbox to finish setting up your account.";
  let success = false;

  if (email && token) {
    try {
      await verifyEmailToken({ email, token });
      title = "Email verified";
      message =
        "Your email address has been verified. You can now redeem promotion codes and continue using Voxly.";
      success = true;
    } catch (error) {
      title = "Verification failed";
      message =
        error instanceof Error
          ? error.message
          : "We could not verify this email link.";
    }
  }

  return (
    <div className="min-h-screen bg-[#f4efe7] px-6 pb-16 pt-24 text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.16),transparent_34%),linear-gradient(180deg,#f6f1e8_0%,#f9f7f2_48%,#ffffff_100%)]" />
      <div className="mx-auto w-full max-w-xl rounded-[32px] border border-white/80 bg-white/92 p-8 shadow-[0_30px_80px_-44px_rgba(15,23,42,0.45)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-700">
          Account
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">{message}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={success ? "/auth/sign-in?verified=1" : "/auth/sign-in"}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Go to sign in
          </Link>
          {!success ? (
            <Link
              href={email ? `/auth/verify-email/resend?email=${encodeURIComponent(email)}` : "/auth/verify-email/resend"}
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-[#f8f5ef]"
            >
              Resend verification email
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
