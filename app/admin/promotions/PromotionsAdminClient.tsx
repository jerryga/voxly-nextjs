"use client";

import { useEffect, useState, type FormEvent } from "react";

type PromotionItem = {
  id: string;
  code: string;
  status: string;
  creditsAmount: number;
  startsAt: string;
  endsAt: string;
  maxRedemptions: number | null;
  newUsersOnly: boolean;
  redemptionCount: number;
  createdAt: string;
};

type PromotionsResponse = {
  ok?: boolean;
  promotions?: PromotionItem[];
  error?: string;
};

function toDateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function PromotionsAdminClient() {
  const [promotions, setPromotions] = useState<PromotionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    creditsAmount: "100",
    startsAt: toDateTimeLocalValue(new Date()),
    endsAt: toDateTimeLocalValue(
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    ),
    maxRedemptions: "",
    newUsersOnly: true,
  });

  async function loadPromotions() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promotions");
      const payload = (await res.json()) as PromotionsResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load promotions");
      }
      setPromotions(payload.promotions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load promotions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPromotions();
  }, []);

  async function handleCreatePromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to create promotion");
      }

      setSuccess(`Promotion code ${payload.promotion?.code} created.`);
      setForm((current) => ({
        ...current,
        code: "",
        maxRedemptions: "",
      }));
      await loadPromotions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create promotion");
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleStatus(promotionId: string, nextStatus: string) {
    setBusy(`status:${promotionId}`);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/promotions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promotionId,
          status: nextStatus,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update promotion status");
      }

      setSuccess("Promotion status updated.");
      await loadPromotions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update promotion status",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/80 bg-white/88 p-8 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-700">
            Admin
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Promotion code manager
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-600">
            Create free-credit promotion codes, define their active window, and
            turn them on or off without touching SQL.
          </p>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
            {success}
          </div>
        ) : null}

        <form
          onSubmit={handleCreatePromotion}
          className="mt-6 grid gap-4 md:grid-cols-2"
        >
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Code</span>
            <input
              value={form.code}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  code: event.target.value.toUpperCase(),
                }))
              }
              placeholder="WELCOME100"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              required
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Credits granted
            </span>
            <input
              type="number"
              min={1}
              value={form.creditsAmount}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  creditsAmount: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              required
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Starts at</span>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  startsAt: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              required
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Ends at</span>
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  endsAt: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              required
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Max redemptions
            </span>
            <input
              type="number"
              min={1}
              value={form.maxRedemptions}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  maxRedemptions: event.target.value,
                }))
              }
              placeholder="Optional"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={form.newUsersOnly}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  newUsersOnly: event.target.checked,
                }))
              }
              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-orange-600 focus:ring-orange-400"
            />
            <span className="text-sm font-medium text-slate-700">
              Restrict to users with no prior purchases
            </span>
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={busy === "create"}
              className="cursor-pointer rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "create" ? "Creating..." : "Create Promotion"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[30px] border border-white/80 bg-white/88 p-8 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Existing promotions
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Review active windows, redemption counts, and toggle a code on or
              off.
            </p>
          </div>
          <button
            type="button"
            onClick={loadPromotions}
            disabled={loading}
            className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[#f8f5ef] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading promotions...</p>
        ) : promotions.length ? (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-3 font-semibold">Code</th>
                  <th className="px-3 py-3 font-semibold">Credits</th>
                  <th className="px-3 py-3 font-semibold">Restriction</th>
                  <th className="px-3 py-3 font-semibold">Window</th>
                  <th className="px-3 py-3 font-semibold">Redemptions</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((promotion) => (
                  <tr
                    key={promotion.id}
                    className="border-b border-slate-100 align-top"
                  >
                    <td className="px-3 py-3">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {promotion.code}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-900">
                      {promotion.creditsAmount}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          promotion.newUsersOnly
                            ? "bg-amber-100 text-amber-800"
                            : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {promotion.newUsersOnly
                          ? "No prior purchases"
                          : "No purchase restriction"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <p>{new Date(promotion.startsAt).toLocaleString()}</p>
                      <p className="mt-1">{new Date(promotion.endsAt).toLocaleString()}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {promotion.redemptionCount}
                      {typeof promotion.maxRedemptions === "number"
                        ? ` / ${promotion.maxRedemptions}`
                        : ""}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          promotion.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {promotion.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleStatus(
                            promotion.id,
                            promotion.status === "active" ? "inactive" : "active",
                          )
                        }
                        disabled={busy === `status:${promotion.id}`}
                        className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-[#f8f5ef] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy === `status:${promotion.id}`
                          ? "Saving..."
                          : promotion.status === "active"
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-500">
            No promotion codes created yet.
          </p>
        )}
      </section>
    </div>
  );
}
