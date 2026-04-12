import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/app/dashboard/DashboardShell";

const supportEmail = "support@chason.app";

export default async function ContactPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const displayName =
    session.user.name?.trim() || session.user.email?.split("@")[0] || "User";

  return (
    <DashboardShell
      displayName={displayName}
      email={session.user.email}
      activePath="contact"
    >
      <div className="mx-auto w-full max-w-5xl">
        <section className="border-b border-slate-200 pb-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Contact
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Contact support
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Send product questions, billing issues, workspace access problems,
            or integration support requests to the same inbox.
          </p>
        </section>

        <section className="pt-8">
          <div className="rounded-[22px] border border-slate-200 bg-white px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Support inbox
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  We keep support in one place so every request goes through the
                  same queue and gets tracked clearly.
                </p>
              </div>
              <a
                href={`mailto:${supportEmail}`}
                className="inline-flex w-fit items-center rounded-full border border-orange-200 bg-orange-50 px-5 py-2.5 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100"
              >
                {supportEmail}
              </a>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
