import Link from "next/link";

type SearchParams = Promise<{
  email?: string;
}>;

export default async function CheckInboxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const email = params.email?.trim() || "";

  return (
    <div className="min-h-screen bg-[#f4efe7] px-6 pb-16 pt-24 text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.16),transparent_34%),linear-gradient(180deg,#f6f1e8_0%,#f9f7f2_48%,#ffffff_100%)]" />
      <div className="mx-auto w-full max-w-xl rounded-[32px] border border-white/80 bg-white/92 p-8 shadow-[0_30px_80px_-44px_rgba(15,23,42,0.45)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-700">
          Verify Email
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">
          Check your inbox
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          We sent a verification link
          {email ? (
            <>
              {" "}
              to <span className="font-semibold text-slate-900">{email}</span>
            </>
          ) : null}
          . You’ll need to verify your email before signing in.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          If you do not see the message, check your spam folder or request a new
          verification email.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={
              email
                ? `/auth/verify-email/resend?email=${encodeURIComponent(email)}`
                : "/auth/verify-email/resend"
            }
            className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Resend verification email
          </Link>
          <Link
            href="/auth/sign-in"
            className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-[#f8f5ef]"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
