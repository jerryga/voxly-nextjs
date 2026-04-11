"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
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

const defaultBillingPlans = [
  { plan: "starter", displayPrice: "$19", monthlyCredits: 300, billingInterval: "monthly" },
  { plan: "pro", displayPrice: "$49", monthlyCredits: 1200, billingInterval: "monthly" },
  { plan: "team", displayPrice: "$149", monthlyCredits: 4000, billingInterval: "monthly" },
] as const;

const defaultCreditPacks = [
  { key: "pack_100", displayPrice: "$9", credits: 100 },
  { key: "pack_500", displayPrice: "$39", credits: 500 },
] as const;

export function BillingClient() {
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingBusy, setBillingBusy] = useState<string | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistoryEntry[]>(
    [],
  );
  const [billingHistoryLoading, setBillingHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const hasConfiguredPlans =
    billing?.availablePlans.some((plan) => plan.configured) ?? false;
  const hasConfiguredTopUps =
    billing?.availableCreditPacks.some((pack) => pack.configured) ?? false;
  const checkoutState = searchParams.get("checkout");

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
      setBilling(null);
      const message =
        err instanceof Error ? err.message : "Failed to load billing";
      if (message === "Unauthorized" || message === "Forbidden") {
        setError(null);
        return;
      }
      setError(message);
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
      const message =
        err instanceof Error ? err.message : "Failed to load billing history";
      if (message === "Unauthorized" || message === "Forbidden") {
        setBillingHistory([]);
        setError(null);
        return;
      }
      setError(message);
    } finally {
      setBillingHistoryLoading(false);
    }
  }

  useEffect(() => {
    void loadBilling();
  }, []);

  useEffect(() => {
    if (!billing) {
      setBillingHistory([]);
      setBillingHistoryLoading(false);
      return;
    }

    if (billing.canViewBillingHistory) {
      void loadBillingHistory();
      return;
    }

    setBillingHistory([]);
    setBillingHistoryLoading(false);
  }, [billing]);

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
    setPromoError(null);

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
      setPromoError(
        err instanceof Error ? err.message : "Failed to redeem promotion code",
      );
    } finally {
      setPromoBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
        <div className="grid gap-3 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Billing
            </p>
            <h1 className="mt-1.5 text-[1.8rem] font-semibold tracking-tight text-slate-950">
              Workspace billing
            </h1>
            <p className="mt-1.5 max-w-[58rem] text-sm leading-6 text-slate-600">
              Manage the active workspace subscription, buy extra credits, and review how the balance changes over time.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleManageBilling}
              disabled={
                !billing?.hasBillingProfile ||
                !billing?.canManageBilling ||
                billingBusy === "portal"
              }
              className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-[#f8f5ef] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {billingBusy === "portal" ? "Opening..." : "Manage Billing"}
            </button>
            <button
              type="button"
              onClick={() => {
                void loadBilling();
                if (billing?.canViewBillingHistory) {
                  void loadBillingHistory();
                }
              }}
              disabled={billingLoading || (billing?.canViewBillingHistory && billingHistoryLoading)}
              className="cursor-pointer rounded-full border border-slate-200 bg-[#fcfbf8] px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[#f5f1ea] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {billingLoading || (billing?.canViewBillingHistory && billingHistoryLoading)
                ? "Refreshing..."
                : "Refresh Billing"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mx-6 mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">
            {error}
          </div>
        ) : null}

        {checkoutState === "success" ? (
          <div className="mx-6 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
            Checkout completed. Billing updates may take a moment to sync into this workspace.
          </div>
        ) : null}

        {checkoutState === "canceled" ? (
          <div className="mx-6 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
            Checkout was canceled. No workspace billing changes were made.
          </div>
        ) : null}

        {billingLoading ? (
          <p className="mx-6 mt-4 text-sm text-slate-500">Loading billing details...</p>
        ) : billing ? (
          <>
            {!hasConfiguredPlans && !hasConfiguredTopUps ? (
              <div className="mx-6 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900">
                Billing is not fully configured yet. Add your Stripe price IDs
                and secret keys in the environment before customers can choose a
                plan or buy credits.
              </div>
            ) : null}

            <div className="mx-6 mt-5 border-t border-slate-200 pt-4">
              <div className="grid gap-5 md:grid-cols-3">
                <div className="border-b border-slate-200 pb-4 md:border-b-0 md:pb-0">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Active Workspace
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {billing.workspace.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {billing.workspace.isPersonal ? "Personal workspace" : "Shared workspace"} · your role {billing.workspace.viewerRole}
                  </p>
                </div>
                <div className="border-b border-slate-200 pb-4 md:border-b-0 md:pb-0">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Billing Owner
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {billing.billingOwner.name?.trim() || billing.billingOwner.email}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {billing.billingScope === "personal"
                      ? "This workspace bills through your account."
                      : "This workspace currently bills through the workspace owner account."}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Access
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {billing.canManageBilling ? "Billing manager" : "Read only"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {billing.canManageBilling
                      ? "You can open the portal, change plans, buy credits, and redeem codes."
                      : "Only workspace owners and admins can manage billing for this workspace."}
                  </p>
                </div>
              </div>
            </div>

            {!billing.canManageBilling ? (
              <div className="mx-6 mt-5 border-t border-slate-200 pt-4">
                <h2 className="text-lg font-semibold text-slate-950">
                  Need a billing change?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This workspace is billed through{" "}
                  <span className="font-semibold text-slate-900">
                    {billing.billingOwner.name?.trim() || billing.billingOwner.email}
                  </span>
                  . Ask the workspace owner or an admin to update the plan, buy credits, or redeem codes.
                </p>
              </div>
            ) : null}

            <div className="mx-6 mt-5 border-t border-slate-200 pt-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-[20px] border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Current Plan
                  </p>
                <p className="mt-2 text-2xl font-semibold capitalize text-slate-950">
                  {billing.plan}
                </p>
                <p className="mt-1 text-sm text-slate-500 capitalize">
                  {billing.status}
                </p>
              </div>
                <div className="rounded-[20px] border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Available Credits
                  </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {billing.creditsRemaining}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Available right now
                </p>
              </div>
                <div className="rounded-[20px] border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Plan Credits
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
                <div className="rounded-[20px] border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Bonus Credits
                  </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {billing.topUpCreditsRemaining}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Promo and purchased credits remaining
                </p>
              </div>
              </div>
            </div>

            <div className="mx-6 mt-5 grid gap-6 border-t border-slate-200 pt-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div id="billing-plans">
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
                        className={`rounded-[18px] border p-4 ${
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
                            billing.plan === plan.plan ||
                            !billing.canManageBilling
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
                    <div className="rounded-[18px] border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500 md:col-span-3">
                      No subscription prices are configured yet.
                    </div>
                  ) : null}
                </div>
              </div>

              <div id="billing-credits">
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
                        className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-white p-4"
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
                          disabled={
                            billingBusy === `topup:${pack.key}` ||
                            !billing.canManageBilling
                          }
                          className="cursor-pointer rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {billingBusy === `topup:${pack.key}`
                            ? "Redirecting..."
                            : "Buy"}
                        </button>
                      </div>
                    ))}
                  {!hasConfiguredTopUps ? (
                    <div className="rounded-[18px] border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
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

            <div className="mx-6 mt-5 border-t border-slate-200 pt-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
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
                  disabled={promoBusy || !billing.canManageBilling}
                  className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium uppercase tracking-[0.12em] text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={!promoCode.trim() || promoBusy || !billing.canManageBilling}
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
              {promoError ? (
                <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {promoError}
                </p>
              ) : null}
              {!billing.canManageBilling ? (
                <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Billing actions are limited to workspace owners and admins.
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="mx-6 mt-4 space-y-5 pb-6">
            <p className="text-sm text-slate-500">
              Billing details are not available yet.
            </p>

            <div className="grid gap-6 border-t border-slate-200 pt-5 xl:grid-cols-[1.1fr_0.9fr]">
              <div id="billing-plans">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Subscription plans
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Preview the monthly plans available in Voxly.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {defaultBillingPlans.map((plan) => (
                    <div
                      key={plan.plan}
                      className={`rounded-[18px] border p-4 ${
                        plan.plan === "pro"
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-950"
                      }`}
                    >
                      <p className="text-sm font-semibold capitalize">{plan.plan}</p>
                      <p
                        className={`mt-2 text-2xl font-semibold ${
                          plan.plan === "pro" ? "text-white" : "text-slate-950"
                        }`}
                      >
                        {plan.displayPrice}
                      </p>
                      <p
                        className={`mt-1 text-sm ${
                          plan.plan === "pro" ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        / {plan.billingInterval}
                      </p>
                      <p
                        className={`mt-1 text-sm ${
                          plan.plan === "pro" ? "text-slate-200" : "text-slate-700"
                        }`}
                      >
                        {plan.monthlyCredits} credits included
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = "/contact";
                        }}
                        className={`mt-4 w-full cursor-pointer rounded-full px-4 py-2.5 text-sm font-semibold ${
                          plan.plan === "pro"
                            ? "bg-white/12 text-white"
                            : "bg-[#f97316] text-white hover:bg-[#ea580c]"
                        }`}
                      >
                        Contact Sales
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div id="billing-credits">
                <h2 className="text-lg font-semibold text-slate-950">
                  Buy more credits
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add more processing capacity without changing your plan.
                </p>
                <div className="mt-4 space-y-3">
                  {defaultCreditPacks.map((pack) => (
                    <div
                      key={pack.key}
                      className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-white p-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {pack.credits} credit pack
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {pack.displayPrice} for roughly {pack.credits} minutes of audio
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = "/contact";
                        }}
                        className="cursor-pointer rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        Contact Sales
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {billing ? <div className="pb-6" /> : null}
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-6">
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
            disabled={billingHistoryLoading || !billing?.canViewBillingHistory}
            className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[#f8f5ef] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {billingHistoryLoading ? "Loading..." : "Refresh History"}
          </button>
        </div>

        {!billing?.canViewBillingHistory ? (
          <p className="mt-4 text-sm text-slate-500">
            Credit history is only visible to workspace owners and admins.
          </p>
        ) : billingHistoryLoading ? (
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
