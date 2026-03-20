import { z } from "zod";
import { normalizeTemplate } from "@/lib/llm/promptBuilder";

const emailSchema = z
  .email("Enter a valid email address.")
  .transform((value) => value.trim().toLowerCase());

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .optional()
  .transform((value) => value || undefined);

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.");

const idSchema = z.string().trim().min(1).max(128);

const templateSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform((value) => normalizeTemplate(value));

const relativePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => value.startsWith("/") && !value.startsWith("//"), {
    message: "Expected a relative path",
  });

const actionItemSchema = z.object({
  text: z.string().trim().min(1).max(300),
  priority: z.string().trim().max(20).optional(),
  assignee: z.string().trim().max(120).optional(),
});

const summarySchema = z
  .object({
    decisions: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
    keyPoints: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
    nextSteps: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
    actionItems: z.array(actionItemSchema).max(50).optional(),
  })
  .passthrough();

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});

export const assistantEditSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  summary: summarySchema.default({}),
  provider: z.string().trim().max(40).optional(),
  model: z.string().trim().max(120).optional(),
});

export const assistantChatSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(30),
  summary: summarySchema.default({}),
  provider: z.string().trim().max(40).optional(),
  model: z.string().trim().max(120).optional(),
});

export const transcriptionUpdateSchema = z.object({
  id: idSchema,
  template: templateSchema,
});

export const transcriptionDeleteSchema = z.object({
  id: idSchema,
});

export const transcriptionProcessSchema = z.object({
  transcriptionId: idSchema,
  template: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .optional()
    .transform((value) => (value ? normalizeTemplate(value) : undefined)),
});

export const billingCheckoutSchema = z.discriminatedUnion("purchaseType", [
  z.object({
    purchaseType: z.literal("subscription"),
    plan: z.enum(["starter", "pro", "team"]),
    successPath: relativePathSchema.optional(),
    cancelPath: relativePathSchema.optional(),
  }),
  z.object({
    purchaseType: z.literal("topup"),
    creditPack: z.enum(["pack_100", "pack_500"]),
    successPath: relativePathSchema.optional(),
    cancelPath: relativePathSchema.optional(),
  }),
]);

export const billingPortalSchema = z.object({
  returnPath: relativePathSchema.optional(),
});

export const billingPromoRedeemSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter a promotion code.")
    .max(64, "Promotion code is too long.")
    .transform((value) => value.toUpperCase()),
});

export const adminPromotionCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter a promotion code.")
    .max(64, "Promotion code is too long.")
    .transform((value) => value.toUpperCase()),
  creditsAmount: z.coerce
    .number()
    .int("Credits must be a whole number.")
    .min(1, "Credits must be at least 1.")
    .max(100000, "Credits amount is too large."),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  maxRedemptions: z
    .union([z.coerce.number().int().min(1), z.literal(""), z.undefined()])
    .transform((value) => (value === "" || typeof value === "undefined" ? undefined : value)),
  newUsersOnly: z
    .union([z.boolean(), z.string()])
    .transform((value) => value === true || value === "true" || value === "on"),
});

export const adminPromotionStatusSchema = z.object({
  promotionId: z.string().trim().min(1).max(128),
  status: z.enum(["active", "inactive"]),
});

export const MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);
