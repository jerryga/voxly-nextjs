"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type {
  BillingHistoryEntry,
  BillingHistoryResponse,
  BillingInfo,
  PromoRedeemResponse,
  BillingResponse,
} from "@/lib/billing-types";

function formatBillingEntryType(type: string) {
  switch (type) {
    case "monthly_refill":
      return "Monthly refill";
    case "top_up":
      return "Top-up purchase";
    case "usage":
      return "Usage charge";
    case "usage_refund":
      return "Usage refund";
    case "promo_credit":
      return "Promotion credit";
    default:
      return type.replaceAll("_", " ");
  }
}

export function BillingClient() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingBusy, setBillingBusy] = useState<string | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistoryEntry[]>(
    [],
  );
  const [billingHistoryLoading, setBillingHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const hasConfiguredPlans =
    billing?.availablePlans.some((plan) => plan.configured) ?? false;
  const hasConfiguredTopUps =
    billing?.availableCreditPacks.some((pack) => pack.configured) ?? false;

  async function loadBilling() {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/billing/subscription");
      const payload = (await res.json()) as BillingResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load billing");
      }

      setBilling(payload.billing || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setBillingLoading(false);
    }
  }

  async function loadBillingHistory() {
    setBillingHistoryLoading(true);
    try {
      const res = await fetch("/api/billing/history?limit=30");
      const payload = (await res.json()) as BillingHistoryResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load billing history");
      }

      setBillingHistory(payload.history || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load billing history",
      );
    } finally {
      setBillingHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadBilling();
    loadBillingHistory();
  }, []);

  async function handleStartSubscription(plan: "starter" | "pro" | "team") {
    setBillingBusy(`plan:${plan}`);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseType: "subscription",
          plan,
          successPath: "/billing?checkout=success",
          cancelPath: "/billing?checkout=canceled",
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to start checkout");
      }
      if (!payload?.url) {
        throw new Error("Missing checkout URL");
      }

      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setBillingBusy(null);
    }
  }

  async function handleBuyCredits(creditPack: "pack_100" | "pack_500") {
    setBillingBusy(`topup:${creditPack}`);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseType: "topup",
          creditPack,
          successPath: "/billing?checkout=success",
          cancelPath: "/billing?checkout=canceled",
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to start top-up checkout");
      }
      if (!payload?.url) {
        throw new Error("Missing checkout URL");
      }

      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to buy credits");
    } finally {
      setBillingBusy(null);
    }
  }

  async function handleManageBilling() {
    setBillingBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnPath: "/billing",
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to open billing portal");
      }
      if (!payload?.url) {
        throw new Error("Missing billing portal URL");
      }

      window.location.href = payload.url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to open billing portal",
      );
    } finally {
      setBillingBusy(null);
    }
  }

  async function handleRedeemPromo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPromoBusy(true);
    setPromoMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/billing/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode }),
      });
      const payload = (await res.json()) as PromoRedeemResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to redeem promotion code");
      }

      setPromoCode("");
      setPromoMessage(
        `${payload.creditsGranted || 0} free credits were added from code ${payload.code}.`,
      );
      await loadBilling();
      await loadBillingHistory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to redeem promotion code",
      );
    } finally {
      setPromoBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/80 bg-white/88 p-8 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-700">
              Billing
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Plans, credits, and payment controls
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              Manage your subscription, buy extra credits, and review how your
              balance changes over time.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleManageBilling}
              disabled={!billing?.hasBillingProfile || billingBusy === "portal"}
              className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-[#f8f5ef] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {billingBusy === "portal" ? "Opening..." : "Manage Billing"}
            </button>
            <button
              type="button"
              onClick={() => {
                void loadBilling();
                void loadBillingHistory();
              }}
              disabled={billingLoading || billingHistoryLoading}
              className="cursor-pointer rounded-full border border-slate-200 bg-[#fcfbf8] px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[#f5f1ea] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {billingLoading || billingHistoryLoading
                ? "Refreshing..."
                : "Refresh Billing"}
            </button>
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-200 bg-[#fff7ed] px-5 py-2.5 text-sm font-semibold text-orange-700 hover:border-orange-300 hover:bg-orange-50"
            >
              Back to Workspace
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800 shadow-sm">
            {error}
          </div>
        ) : null}

        {billingLoading ? (
          <p className="mt-6 text-sm text-slate-500">Loading billing details...</p>
        ) : billing ? (
          <>
            {!hasConfiguredPlans && !hasConfiguredTopUps ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900 shadow-sm">
                Billing is not fully configured yet. Add your Stripe price IDs
                and secret keys in the environment before customers can choose a
                plan or buy credits.
              </div>
            ) : null}

            <div className="mt-6 rounded-[26px] border border-slate-200 bg-[#fffdf9] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Promotion code
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Redeem a time-limited code for free credits. Each code can
                    only be used once per user.
                  </p>
                </div>
                <div className="text-sm text-slate-500">
                  Eligibility is verified after you submit a code.
                </div>
              </div>
              <form
                onSubmit={handleRedeemPromo}
                className="mt-4 flex flex-col gap-3 sm:flex-row"
              >
                <input
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                  placeholder="Enter promo code"
                  disabled={promoBusy}
                  className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium uppercase tracking-[0.12em] text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={!promoCode.trim() || promoBusy}
                  className="cursor-pointer rounded-full bg-[#f97316] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_-18px_rgba(249,115,22,0.9)] hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {promoBusy ? "Applying..." : "Apply Code"}
                </button>
              </form>
              {promoMessage ? (
                <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {promoMessage}
                </p>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-[24px] border border-slate-200 bg-[#fffdf9] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Current Plan
                </p>
                <p className="mt-2 text-2xl font-semibold capitalize text-slate-950">
                  {billing.plan}
                </p>
                <p className="mt-1 text-sm text-slate-500 capitalize">
                  {billing.status}
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-[#fffdf9] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Total Credits
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {billing.creditsRemaining}
                  <span className="ml-1 text-sm font-medium text-slate-500">
                    / {billing.creditsTotal}
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Available right now
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-[#fffdf9] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Monthly Bucket
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {billing.monthlyCreditsRemaining}
                  <span className="ml-1 text-sm font-medium text-slate-500">
                    / {billing.monthlyCreditsTotal}
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Included with your plan
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-[#fffdf9] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Top-up Credits
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {billing.topUpCreditsRemaining}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Purchased separately
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[26px] border border-slate-200 bg-[#fffdf9] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Subscription plans
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Choose a monthly plan with included credits.
                    </p>
                  </div>
                  {billing.stripeCurrentPeriodEnd ? (
                    <p className="text-sm text-slate-500">
                      Renews{" "}
                      {new Date(
                        billing.stripeCurrentPeriodEnd,
                      ).toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {billing.availablePlans
                    .filter((plan) => plan.configured)
                    .map((plan) => (
                      <div
                        key={plan.plan}
                        className={`rounded-[22px] border p-4 ${
                          billing.plan === plan.plan
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-950"
                        }`}
                      >
                        <p className="text-sm font-semibold capitalize">
                          {plan.plan}
                        </p>
                        <p
                          className={`mt-2 text-2xl font-semibold ${
                            billing.plan === plan.plan
                              ? "text-white"
                              : "text-slate-950"
                          }`}
                        >
                          {plan.displayPrice}
                        </p>
                        <p
                          className={`mt-1 text-sm ${
                            billing.plan === plan.plan
                              ? "text-slate-300"
                              : "text-slate-500"
                          }`}
                        >
                          / {plan.billingInterval}
                        </p>
                        <p
                          className={`mt-1 text-sm ${
                            billing.plan === plan.plan
                              ? "text-slate-200"
                              : "text-slate-700"
                          }`}
                        >
                          {plan.monthlyCredits} credits included
                        </p>
                        <button
                          type="button"
                          onClick={() => handleStartSubscription(plan.plan)}
                          disabled={
                            billingBusy === `plan:${plan.plan}` ||
                            billing.plan === plan.plan
                          }
                          className={`mt-4 w-full cursor-pointer rounded-full px-4 py-2.5 text-sm font-semibold ${
                            billing.plan === plan.plan
                              ? "bg-white/12 text-white"
                              : "bg-[#f97316] text-white hover:bg-[#ea580c]"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {billing.plan === plan.plan
                            ? "Current Plan"
                            : billingBusy === `plan:${plan.plan}`
                              ? "Redirecting..."
                              : "Choose Plan"}
                        </button>
                      </div>
                    ))}
                  {!hasConfiguredPlans ? (
                    <div className="rounded-[22px] border border-dashed border-slate-300 bg-[#fcfbf8] p-4 text-sm text-slate-500 md:col-span-3">
                      No subscription prices are configured yet.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[26px] border border-slate-200 bg-[#fffdf9] p-5">
                <h2 className="text-lg font-semibold text-slate-950">
                  Buy more credits
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add extra minutes without changing your current plan.
                </p>
                <div className="mt-4 space-y-3">
                  {billing.availableCreditPacks
                    .filter((pack) => pack.configured)
                    .map((pack) => (
                      <div
                        key={pack.key}
                        className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-white p-4"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {pack.credits} credit pack
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {pack.displayPrice} for roughly {pack.credits} minutes of
                            audio
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleBuyCredits(pack.key)}
                          disabled={billingBusy === `topup:${pack.key}`}
                          className="cursor-pointer rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {billingBusy === `topup:${pack.key}`
                            ? "Redirecting..."
                            : "Buy"}
                        </button>
                      </div>
                    ))}
                  {!hasConfiguredTopUps ? (
                    <div className="rounded-[22px] border border-dashed border-slate-300 bg-[#fcfbf8] p-4 text-sm text-slate-500">
                      No top-up credit packs are configured yet.
                    </div>
                  ) : null}
                </div>
                {billing.cancelAtPeriodEnd ? (
                  <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Your subscription is set to cancel at the end of the
                    current billing period.
                  </p>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <p className="mt-6 text-sm text-slate-500">
            Billing details are not available yet.
          </p>
        )}
      </section>

      <section className="rounded-[30px] border border-white/80 bg-white/88 p-8 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Credit history
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              See how your balance changes over time.
            </p>
          </div>
          <button
            type="button"
            onClick={loadBillingHistory}
            disabled={billingHistoryLoading}
            className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[#f8f5ef] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {billingHistoryLoading ? "Loading..." : "Refresh History"}
          </button>
        </div>

        {billingHistoryLoading ? (
          <p className="mt-4 text-sm text-slate-500">
            Loading credit history...
          </p>
        ) : billingHistory.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-3 font-semibold">Date</th>
                  <th className="px-3 py-3 font-semibold">Type</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Balance</th>
                  <th className="px-3 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {billingHistory.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-slate-100 align-top"
                  >
                    <td className="px-3 py-3 text-slate-600">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-slate-900">
                      {formatBillingEntryType(entry.type)}
                    </td>
                    <td
                      className={`px-3 py-3 font-semibold ${
                        entry.amount >= 0 ? "text-emerald-700" : "text-slate-900"
                      }`}
                    >
                      {entry.amount >= 0 ? "+" : ""}
                      {entry.amount}
                    </td>
                    <td className="px-3 py-3 text-slate-900">
                      {entry.balanceAfter}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <div className="space-y-1">
                        {entry.note ? <p>{entry.note}</p> : null}
                        {entry.transcriptionId ? (
                          <p className="text-xs text-slate-500">
                            Transcription: {entry.transcriptionId}
                          </p>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No billing history yet.</p>
        )}
      </section>
    </div>
  );
}
