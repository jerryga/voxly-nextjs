import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { SignOutButton } from "@/app/dashboard/SignOutButton";
import { PromotionsAdminClient } from "./PromotionsAdminClient";

export default async function PromotionsAdminPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim();

  if (!email) {
    redirect("/auth/sign-in");
  }

  if (!isAdminEmail(email)) {
    redirect("/dashboard");
  }

  const displayName =
    session?.user?.name?.trim() || email.split("@")[0] || "Admin";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f4efe7] text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.14),transparent_32%),linear-gradient(180deg,#f6f1e8_0%,#f8f4ee_48%,#fcfbf8_100%)]" />
      <header className="sticky top-0 z-40 px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-400 items-center gap-3 rounded-full border border-white/70 bg-white/82 px-5 py-3 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
          <a href="/dashboard" className="inline-flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-xs font-bold text-white">
              V
            </span>
            <span>
              <span className="block text-sm font-bold tracking-tight text-slate-900">
                Voxly
              </span>
              <span className="block text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Admin
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-[#f8f5ef] p-1 md:flex">
            {[
              { label: "Workspace", href: "/dashboard" },
              { label: "Billing", href: "/billing" },
              { label: "Promotions", href: "/admin/promotions" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  item.label === "Promotions"
                    ? "bg-white text-slate-900"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-2.5 py-1.5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] sm:flex">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f97316] text-xs font-bold text-white">
                {initial}
              </span>
              <div className="leading-tight">
                <p className="max-w-36 truncate text-sm font-semibold text-slate-900">
                  {displayName}
                </p>
                <p className="max-w-36 truncate text-xs text-slate-500">
                  {email}
                </p>
              </div>
            </div>

            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-400 px-4 pb-10 pt-2 sm:px-6 sm:pb-12 sm:pt-3">
        <PromotionsAdminClient />
      </div>
    </div>
  );
}
