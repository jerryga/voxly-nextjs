import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BrandLink } from "@/app/components/BrandLink";
import { authOptions } from "@/lib/auth";

const pricingTiers = [
  {
    name: "Starter",
    price: "$12",
    cadence: "/month",
    description: "For solo creators and lightweight weekly recording workflows.",
    features: [
      "Structured notes and summaries",
      "History and transcript review",
      "Basic project organization",
    ],
  },
  {
    name: "Pro",
    price: "$29",
    cadence: "/month",
    description: "For deeper intelligence, reusable insights, and team-ready workflows.",
    features: [
      "Workspace intelligence and saved insights",
      "Comments, mentions, and notifications",
      "Recurring reports and exports",
    ],
  },
  {
    name: "Team",
    price: "Custom",
    cadence: "",
    description: "For shared workspaces with admin controls, delivery, and integrations.",
    features: [
      "Shared workspaces and member roles",
      "Slack and Notion publishing",
      "Priority onboarding and support",
    ],
  },
] as const;

export default async function PricingPage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/billing");
  }

  return (
    <div className="min-h-screen bg-[#f6f6f3] text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.06),transparent_28%),linear-gradient(180deg,#f8f8f5_0%,#f6f6f3_40%,#f3f4f6_100%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 xl:px-8 xl:py-7">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-white/92 px-5 py-4 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.25)] backdrop-blur">
          <BrandLink href="/" subtitle="Knowledge Workspace" />
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/contact"
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[#f7f7f3]"
            >
              Contact
            </Link>
            <Link
              href="/auth/sign-in"
              className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Sign in
            </Link>
          </div>
        </header>

        <main className="flex-1 py-8">
          <section className="border-b border-slate-200 pb-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Pricing
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-[3.25rem]">
              Plans that scale with your recording workflow
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              Choose the right Voxly plan for solo note capture, deeper intelligence,
              or shared team workflows. When you sign in, billing lives directly inside
              your workspace.
            </p>
          </section>

          <section className="grid gap-5 pt-8 lg:grid-cols-3">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.2)]"
              >
                <p className="text-sm font-semibold text-slate-950">{tier.name}</p>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-3xl font-semibold tracking-tight text-slate-950">
                    {tier.price}
                  </span>
                  {tier.cadence ? (
                    <span className="pb-1 text-sm text-slate-500">{tier.cadence}</span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {tier.description}
                </p>
                <ul className="mt-5 space-y-3 border-t border-slate-200 pt-5">
                  {tier.features.map((feature) => (
                    <li key={feature} className="text-sm text-slate-700">
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.name === "Team" ? "/contact" : "/auth/sign-in"}
                  className={`mt-6 inline-flex rounded-full px-4 py-2.5 text-sm font-semibold ${
                    tier.name === "Pro"
                      ? "bg-slate-950 text-white hover:bg-slate-800"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-[#f7f7f3]"
                  }`}
                >
                  {tier.name === "Team" ? "Talk to sales" : "Get started"}
                </Link>
              </div>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}
