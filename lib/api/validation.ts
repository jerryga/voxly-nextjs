import { z } from "zod";
import { normalizeTemplate } from "@/lib/llm/promptBuilder";
import { normalizeTemplateSelection } from "@/lib/templates";

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
const slackWebhookSchema = z
  .string()
  .trim()
  .url("Enter a valid Slack webhook URL.")
  .refine((value) => /^https:\/\/hooks\.slack\.com\/services\//.test(value), {
    message: "Enter a valid Slack incoming webhook URL.",
  });

const notionTokenSchema = z.string().trim().min(20).max(200);

function extractNotionPageId(value: string) {
  const trimmed = value.trim();
  const matches = [
    ...trimmed.matchAll(
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{32}/gi,
    ),
  ];

  return matches.at(-1)?.[0] || trimmed;
}

const notionPageIdSchema = z
  .string()
  .trim()
  .min(20)
  .max(300)
  .transform((value) => extractNotionPageId(value))
  .refine(
    (value) =>
      /^[a-f0-9]{32}$/i.test(value) ||
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value),
    "Enter a valid Notion page ID or Notion page URL.",
  );

const templateSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .transform((value) => normalizeTemplateSelection(value));

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
  transcriptionId: idSchema,
  messages: z.array(chatMessageSchema).min(1).max(30),
  summary: summarySchema.default({}),
  provider: z.string().trim().max(40).optional(),
  model: z.string().trim().max(120).optional(),
});

export const projectIntelligenceQuerySchema = z.object({
  projectId: idSchema,
  transcriptionIds: z.array(idSchema).max(20).optional(),
  question: z.string().trim().min(1).max(4000),
  provider: z.string().trim().max(40).optional(),
  model: z.string().trim().max(120).optional(),
});

export const workspaceIntelligenceQuerySchema = z.object({
  question: z.string().trim().min(1).max(4000),
  projectIds: z.array(idSchema).max(12).optional(),
  provider: z.string().trim().max(40).optional(),
  model: z.string().trim().max(120).optional(),
});

export const projectInsightCreateSchema = z.object({
  projectId: idSchema,
  title: z.string().trim().min(1).max(120),
  question: z.string().trim().min(1).max(4000),
  answer: z.string().trim().min(1).max(20000),
  confidenceNote: z.union([z.string().trim().max(4000), z.literal(""), z.null()]).optional(),
  sources: z
    .array(
      z.object({
        sourceId: z.string().trim().min(1).max(200),
        transcriptionId: idSchema,
        fileName: z.string().trim().min(1).max(300),
        excerpt: z.string().trim().min(1).max(6000),
      }),
    )
    .max(20),
});

export const projectInsightDeleteSchema = z.object({
  id: idSchema,
});

export const projectInsightUpdateSchema = z.object({
  id: idSchema,
  isPinned: z.boolean().optional(),
  archived: z.boolean().optional(),
}).refine((value) => typeof value.isPinned === "boolean" || typeof value.archived === "boolean", {
  message: "Provide at least one project insight update",
});

export const workspaceInsightCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  question: z.string().trim().min(1).max(4000),
  answer: z.string().trim().min(1).max(20000),
  confidenceNote: z.union([z.string().trim().max(4000), z.literal(""), z.null()]).optional(),
  projectIds: z.array(idSchema).max(12).optional(),
  sources: z
    .array(
      z.object({
        sourceId: z.string().trim().min(1).max(200),
        transcriptionId: idSchema,
        fileName: z.string().trim().min(1).max(300),
        excerpt: z.string().trim().min(1).max(6000),
      }),
    )
    .max(20),
});

export const workspaceInsightUpdateSchema = z.object({
  id: idSchema,
  isPinned: z.boolean().optional(),
  archived: z.boolean().optional(),
}).refine((value) => typeof value.isPinned === "boolean" || typeof value.archived === "boolean", {
  message: "Provide at least one workspace insight update",
});

export const workspaceInsightDeleteSchema = z.object({
  id: idSchema,
});

export const transcriptionUpdateSchema = z.object({
  id: idSchema,
  template: templateSchema.optional(),
  projectId: z.union([idSchema, z.null()]).optional(),
  actionItems: z.array(actionItemSchema.extend({ completed: z.boolean().optional() })).optional(),
});

export const transcriptionDeleteSchema = z.object({
  id: idSchema,
});

export const actionTaskCreateSchema = z.object({
  transcriptionId: idSchema,
  title: z.string().trim().min(1).max(300),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assignee: z.union([z.string().trim().max(120), z.literal(""), z.null()]).optional(),
  dueDate: z.union([z.coerce.date(), z.literal(""), z.null()]).optional(),
  sourceActionIndex: z.coerce.number().int().min(0).max(999).optional(),
});

export const actionTaskUpdateSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(300).optional(),
  status: z.enum(["open", "in_progress", "done"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assignee: z.union([z.string().trim().max(120), z.literal(""), z.null()]).optional(),
  dueDate: z.union([z.coerce.date(), z.literal(""), z.null()]).optional(),
});

export const actionTaskDeleteSchema = z.object({
  id: idSchema,
});

export const commentCreateSchema = z
  .object({
    content: z.string().trim().min(1).max(4000),
    transcriptionId: idSchema.optional(),
    taskId: idSchema.optional(),
    projectInsightId: idSchema.optional(),
    workspaceInsightId: idSchema.optional(),
  })
  .refine(
    (value) =>
      Boolean(
        value.transcriptionId ||
          value.taskId ||
          value.projectInsightId ||
          value.workspaceInsightId,
      ),
    {
      message:
        "transcriptionId, taskId, projectInsightId, or workspaceInsightId is required",
    },
  )
  .refine(
    (value) =>
      [
        value.transcriptionId,
        value.taskId,
        value.projectInsightId,
        value.workspaceInsightId,
      ].filter(Boolean)
        .length === 1,
    {
      message: "Provide exactly one comment target",
    },
  );

export const commentUpdateSchema = z.object({
  id: idSchema,
  content: z.string().trim().min(1).max(4000),
});

export const commentDeleteSchema = z.object({
  id: idSchema,
});

export const workspaceInviteCreateSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  role: z.enum(["admin", "member", "viewer"]).optional(),
});

export const workspaceMemberUpdateSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]),
});

export const workspaceOwnerTransferSchema = z.object({
  memberId: idSchema,
});

export const workspaceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const workspaceCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const workspaceDigestUpdateSchema = z.object({
  enabled: z.boolean(),
  cadence: z.enum(["weekly", "monthly"]),
  reportType: z.enum(["summary", "new_insights", "open_tasks", "risk_watch"]),
  weekday: z.number().int().min(0).max(6),
  dayOfMonth: z.number().int().min(1).max(28),
  hourLocal: z.number().int().min(0).max(23),
  timezone: z.string().trim().min(1).max(100),
  recipientScope: z.enum(["managers", "all_members"]),
  sendEmail: z.boolean(),
  sendSlack: z.boolean(),
  slackDestinationId: z.union([idSchema, z.literal(""), z.null(), z.undefined()]).optional(),
});

export const projectDigestUpdateSchema = z.object({
  enabled: z.boolean(),
  cadence: z.enum(["weekly", "monthly"]),
  reportType: z.enum(["summary", "new_insights", "open_tasks", "risk_watch"]),
  weekday: z.number().int().min(0).max(6),
  dayOfMonth: z.number().int().min(1).max(28),
  hourLocal: z.number().int().min(0).max(23),
  timezone: z.string().trim().min(1).max(100),
  recipientScope: z.enum(["managers", "all_members"]),
  sendEmail: z.boolean(),
  sendSlack: z.boolean(),
  slackDestinationId: z.union([idSchema, z.literal(""), z.null(), z.undefined()]).optional(),
});

export const recurringReportTemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  targetScope: z.enum(["workspace", "project"]),
  cadence: z.enum(["weekly", "monthly"]),
  reportType: z.enum(["summary", "new_insights", "open_tasks", "risk_watch"]),
  weekday: z.number().int().min(0).max(6),
  dayOfMonth: z.number().int().min(1).max(28),
  hourLocal: z.number().int().min(0).max(23),
  timezone: z.string().trim().min(1).max(100),
  recipientScope: z.enum(["managers", "all_members"]),
  sendEmail: z.boolean(),
  sendSlack: z.boolean(),
  slackDestinationId: z.union([idSchema, z.literal(""), z.null(), z.undefined()]).optional(),
});

export const workspaceSlackDestinationCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  webhookUrl: slackWebhookSchema,
});

export const workspaceSlackUpdateSchema = z.object({
  enabled: z.boolean(),
  sendDigests: z.boolean(),
  webhookUrl: z.union([slackWebhookSchema, z.literal(""), z.undefined()]).optional(),
});

export const workspaceNotionUpdateSchema = z.object({
  enabled: z.boolean(),
  apiToken: z.union([notionTokenSchema, z.literal(""), z.undefined()]).optional(),
  parentPageId: z.union([notionPageIdSchema, z.literal(""), z.undefined()]).optional(),
});

export const insightSlackShareSchema = z.object({
  note: z.union([z.string().trim().max(500), z.literal(""), z.undefined()]).optional(),
});

export const userNotificationPreferencesUpdateSchema = z.object({
  mentionEmailEnabled: z.boolean(),
  mentionInAppEnabled: z.boolean(),
  digestEmailEnabled: z.boolean(),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  color: z.string().trim().max(32).optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.union([z.string().trim().max(500), z.literal(""), z.null()]).optional(),
  color: z.union([z.string().trim().max(32), z.literal(""), z.null()]).optional(),
});

export const transcriptionProcessSchema = z.object({
  transcriptionId: idSchema,
  template: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .optional()
    .transform((value) => (value ? normalizeTemplateSelection(value) : undefined)),
});

export const summaryTemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  baseTemplate: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((value) => normalizeTemplate(value)),
  promptInstructions: z.string().trim().min(1).max(5000),
});

export const summaryTemplateUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  baseTemplate: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .optional()
    .transform((value) => (value ? normalizeTemplate(value) : undefined)),
  promptInstructions: z.string().trim().min(1).max(5000).optional(),
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
