import { z } from "zod";
import { normalizeTemplate } from "@/lib/llm/promptBuilder";

const emailSchema = z.email().transform((value) => value.trim().toLowerCase());

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .optional()
  .transform((value) => value || undefined);

const passwordSchema = z.string().min(8).max(128);

const idSchema = z.string().trim().min(1).max(128);

const templateSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform((value) => normalizeTemplate(value));

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

