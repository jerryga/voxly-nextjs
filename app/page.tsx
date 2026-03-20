import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const productHighlights = [
  {
    title: "Fast, accurate transcripts",
    description:
      "Upload calls, interviews, and podcasts, then get structured transcripts without hand-cleaning every recording.",
  },
  {
    title: "AI summaries that are actually useful",
    description:
      "Turn long recordings into action items, highlights, and searchable takeaways your team can use right away.",
  },
  {
    title: "Built for a real workflow",
    description:
      "Capture audio, review transcripts, ask follow-up questions, and keep everything in one workspace.",
  },
];

const useCases = [
  {
    title: "Podcasters",
    description:
      "Pull show notes, clips, titles, and key moments from every episode faster.",
  },
  {
    title: "Client teams",
    description:
      "Turn meetings and calls into follow-ups, summaries, and searchable knowledge.",
  },
  {
    title: "Researchers",
    description:
      "Organize interviews, preserve context, and surface patterns without losing the raw transcript.",
  },
];

const pricingTiers = [
  {
    name: "Starter",
    price: "$19",
    audience: "For solo creators and early workflows",
    features: [
      "5 hours of transcription per month",
      "AI summaries and key takeaways",
      "Upload and transcript history",
    ],
  },
  {
    name: "Pro",
    price: "$49",
    audience: "For teams shipping content every week",
    features: [
      "25 hours of transcription per month",
      "Shared workspace and assistant tools",
      "Priority processing and richer exports",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    audience: "For high-volume and multi-team operations",
    features: [
      "Custom usage limits",
      "Support, onboarding, and tailored workflows",
      "Security and compliance review",
    ],
  },
];

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isAuthenticated = Boolean(session?.user);
  const navItems = isAuthenticated
    ? [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Upload", href: "/dashboard#upload" },
        { label: "Transcriptions", href: "/dashboard#transcriptions" },
        { label: "Assistant", href: "/dashboard#assistant" },
        { label: "Pricing", href: "#pricing" },
        { label: "Contact", href: "#contact" },
      ]
    : [
        { label: "Product", href: "#product" },
        { label: "Pricing", href: "#pricing" },
        { label: "Use Cases", href: "#use-cases" },
        { label: "Contact", href: "#contact" },
      ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4efe7] text-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_34%),linear-gradient(180deg,#f6f1e8_0%,#f9f7f2_48%,#ffffff_100%)]" />

      <header className="sticky top-0 z-50 px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 rounded-full border border-white/70 bg-white/80 px-5 py-3 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f172a] text-sm font-semibold text-white">
              V
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight text-slate-950">
                Voxly
              </span>
              <span className="block text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Voice Intelligence
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-[#f8f5ef] p-1 md:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-950"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="rounded-full bg-[#f97316] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_30px_-18px_rgba(249,115,22,0.9)] hover:bg-[#ea580c]"
              >
                Open Workspace
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/sign-in"
                  className="text-sm font-medium text-slate-700 hover:text-slate-950"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/sign-up"
                  className="rounded-full bg-[#f97316] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_30px_-18px_rgba(249,115,22,0.9)] hover:bg-[#ea580c]"
                >
                  Start Free
                </Link>
              </>
            )}
          </div>

          <details className="group relative md:hidden">
            <summary className="flex list-none items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 marker:content-none">
              Menu
            </summary>
            <div className="absolute right-0 top-14 w-72 rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.5)]">
              <div className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3">
                {isAuthenticated ? (
                  <Link
                    href="/dashboard"
                    className="rounded-2xl bg-[#f97316] px-4 py-3 text-center text-sm font-semibold text-white"
                  >
                    Open Workspace
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/auth/sign-in"
                      className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/auth/sign-up"
                      className="rounded-2xl bg-[#f97316] px-4 py-3 text-center text-sm font-semibold text-white"
                    >
                      Start Free
                    </Link>
                  </>
                )}
              </div>
            </div>
          </details>
        </div>
      </header>

      <section className="px-4 pb-18 pt-8 sm:px-6 sm:pb-24 sm:pt-12">
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
              Production-ready transcription workspace
            </div>
            <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-balance text-slate-950 sm:text-6xl">
              Turn long recordings into searchable insight your team can act on.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              Voxly helps teams upload audio, generate transcripts, and use AI
              to pull summaries, action items, and answers from every
              conversation.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {isAuthenticated ? (
                <>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Go to Dashboard
                  </Link>
                  <a
                    href="/dashboard#upload"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:border-slate-400"
                  >
                    Upload Audio
                  </a>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/sign-up"
                    className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Start Free
                  </Link>
                  <a
                    href="#pricing"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:border-slate-400"
                  >
                    See Pricing
                  </a>
                </>
              )}
            </div>
            <div className="mt-10 grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
                <p className="text-2xl font-semibold text-slate-950">3x</p>
                <p className="mt-1">Faster post-call notes and recap creation</p>
              </div>
              <div className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
                <p className="text-2xl font-semibold text-slate-950">1 hub</p>
                <p className="mt-1">Uploads, transcripts, and assistant answers in one place</p>
              </div>
              <div className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
                <p className="text-2xl font-semibold text-slate-950">0 guesswork</p>
                <p className="mt-1">Clear transcripts and summaries without digging through audio</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 top-10 hidden h-32 w-32 rounded-full bg-sky-200/40 blur-3xl sm:block" />
            <div className="absolute -right-2 bottom-0 hidden h-36 w-36 rounded-full bg-orange-200/40 blur-3xl sm:block" />
            <div className="relative rounded-[32px] border border-slate-200/70 bg-[#fffdf9] p-5 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.45)] sm:p-6">
              <div className="rounded-[28px] bg-slate-950 p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      New upload
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      Client strategy sync.mp3
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-300">
                    Transcript ready
                  </span>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-white/8 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Summary
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                      Team aligned on launch timeline, ownership gaps, and two
                      open risks before Monday.
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white/8 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Assistant
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                      Asked: &quot;What decisions were made?&quot; Returned the launch
                      owner, due dates, and unresolved blockers.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[26px] border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Transcript timeline
                  </p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        00:03 Product kickoff
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Defined launch window, recording owner, and review loop.
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        14:28 Risks
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Flagged missing approvals and late asset delivery.
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        26:12 Next steps
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Assigned recap, content draft, and follow-up review date.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[26px] border border-slate-200 bg-[#f8f5ef] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Output
                  </p>
                  <ul className="mt-4 space-y-3 text-sm text-slate-700">
                    <li className="rounded-2xl bg-white px-4 py-3">
                      Action items extracted automatically
                    </li>
                    <li className="rounded-2xl bg-white px-4 py-3">
                      Searchable transcript history
                    </li>
                    <li className="rounded-2xl bg-white px-4 py-3">
                      One-click follow-up prompts
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="px-4 py-18 sm:px-6 sm:py-24">
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">
              Product
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              A simple workflow from raw audio to usable insight
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Every part of the experience should help a team move from
              recording to clarity without opening five different tools.
            </p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {productHighlights.map((item) => (
              <article
                key={item.title}
                className="rounded-[28px] border border-slate-200 bg-white/85 p-7 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.45)]"
              >
                <h3 className="text-xl font-semibold text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-[#f8f5ef] px-4 py-18 sm:px-6 sm:py-24">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-700">
                Pricing
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Clear plans that map to real usage
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Start with a small workflow, then scale when your team needs
                more hours, collaboration, or support.
              </p>
            </div>
            <Link
              href={isAuthenticated ? "/dashboard" : "/auth/sign-up"}
              className="inline-flex w-fit items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:border-slate-400"
            >
              {isAuthenticated ? "Open Workspace" : "Start Free"}
            </Link>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {pricingTiers.map((tier) => (
              <article
                key={tier.name}
                className={`rounded-[30px] border p-7 ${
                  tier.featured
                    ? "border-slate-950 bg-slate-950 text-white shadow-[0_24px_70px_-34px_rgba(15,23,42,0.8)]"
                    : "border-slate-200 bg-white text-slate-950 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold">{tier.name}</h3>
                    <p
                      className={`mt-2 text-sm ${
                        tier.featured ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {tier.audience}
                    </p>
                  </div>
                  {tier.featured ? (
                    <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-200">
                      Most Popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-8 text-4xl font-semibold tracking-tight">
                  {tier.price}
                  {tier.price.startsWith("$") ? (
                    <span
                      className={`ml-1 text-base font-medium ${
                        tier.featured ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      /mo
                    </span>
                  ) : null}
                </p>
                <ul
                  className={`mt-8 space-y-3 text-sm ${
                    tier.featured ? "text-slate-200" : "text-slate-700"
                  }`}
                >
                  {tier.features.map((feature) => (
                    <li key={feature} className="rounded-2xl bg-white/8 px-4 py-3">
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="use-cases" className="px-4 py-18 sm:px-6 sm:py-24">
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-700">
              Use Cases
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Built for the teams who rely on voice-heavy work
            </h2>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {useCases.map((item) => (
              <article
                key={item.title}
                className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]"
              >
                <h3 className="text-xl font-semibold text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="px-4 pb-18 pt-8 sm:px-6 sm:pb-24">
        <div className="mx-auto grid w-full max-w-7xl gap-6 rounded-[34px] bg-slate-950 px-6 py-8 text-white shadow-[0_30px_90px_-48px_rgba(15,23,42,0.9)] sm:px-8 sm:py-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-300">
              Contact
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Want a demo, partnership, or enterprise setup?
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
              Reach out for onboarding help, custom plans, or a walkthrough of
              how Voxly can fit your workflow.
            </p>
          </div>
          <div className="rounded-[28px] bg-white/8 p-6">
            <p className="text-sm font-medium text-slate-300">Best next step</p>
            <p className="mt-2 text-xl font-semibold">Talk to the Voxly team</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Email{" "}
              <a
                href="mailto:hello@voxly.ai"
                className="font-semibold text-white underline decoration-white/30 underline-offset-4"
              >
                hello@voxly.ai
              </a>{" "}
              or start free and explore the workspace right away.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="mailto:hello@voxly.ai"
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950"
              >
                Contact Sales
              </a>
              <Link
                href={isAuthenticated ? "/dashboard" : "/auth/sign-up"}
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/8"
              >
                {isAuthenticated ? "Open Workspace" : "Start Free"}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
