import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/app/dashboard/DashboardShell";

const contactOptions = [
  {
    title: "General support",
    value: "support@voxly.ai",
    description: "Questions about uploads, notes, or day-to-day product use.",
  },
  {
    title: "Sales and team onboarding",
    value: "sales@voxly.ai",
    description: "Talk about shared workspaces, rollout planning, or custom setup.",
  },
  {
    title: "Integrations and technical help",
    value: "engineering@voxly.ai",
    description: "Get help with Slack, Notion, digests, or API-related workflows.",
  },
];

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
            Reach the right Voxly team quickly
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Use the contact path that matches your need so we can route your
            request faster and keep your workspace moving.
          </p>
        </section>

        <section className="space-y-4 pt-8">
          {contactOptions.map((option) => (
            <div
              key={option.title}
              className="rounded-[22px] border border-slate-200 bg-white px-6 py-5 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.18)]"
            >
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{option.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {option.description}
                  </p>
                </div>
                <a
                  href={`mailto:${option.value}`}
                  className="rounded-full border border-slate-200 bg-[#fcfbf8] px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-300"
                >
                  {option.value}
                </a>
              </div>
            </div>
          ))}
        </section>
      </div>
    </DashboardShell>
  );
}
