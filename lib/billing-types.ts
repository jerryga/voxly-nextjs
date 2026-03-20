export type BillingInfo = {
  plan: string;
  status: string;
  billingInterval: string;
  creditsRemaining: number;
  creditsTotal: number;
  monthlyCreditsRemaining: number;
  monthlyCreditsTotal: number;
  topUpCreditsRemaining: number;
  cancelAtPeriodEnd: boolean;
  stripeCurrentPeriodEnd: string | null;
  hasBillingProfile: boolean;
  hasActiveSubscription: boolean;
  availablePlans: Array<{
    plan: "starter" | "pro" | "team";
    displayPrice: string;
    monthlyCredits: number;
    billingInterval: "monthly";
    configured: boolean;
  }>;
  availableCreditPacks: Array<{
    key: "pack_100" | "pack_500";
    displayPrice: string;
    credits: number;
    configured: boolean;
  }>;
};

export type BillingResponse = {
  ok?: boolean;
  billing?: BillingInfo;
  error?: string;
};

export type BillingHistoryEntry = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  monthlyAfter: number | null;
  topUpAfter: number | null;
  note: string | null;
  transcriptionId: string | null;
  stripeInvoiceId: string | null;
  stripeSessionId: string | null;
  createdAt: string;
};

export type BillingHistoryResponse = {
  ok?: boolean;
  history?: BillingHistoryEntry[];
  error?: string;
};
