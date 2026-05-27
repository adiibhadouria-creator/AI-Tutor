import { z } from "zod";

const Email = z.string().email().max(254).transform((s) => s.toLowerCase());
const Password = z.string().min(10).max(256);
const Turnstile = z.string().min(1).max(2048);

export const SignupSchema = z.object({
  email: Email,
  password: Password,
  turnstile_token: Turnstile,
});
export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: Email,
  password: z.string().min(1).max(256),
  turnstile_token: Turnstile,
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const PasswordChangeSchema = z.object({
  current_password: z.string().min(1).max(256),
  new_password: Password,
});

export const ProfileUpdateSchema = z.object({
  display_name: z.string().min(1).max(80).optional(),
});

export const ChatCreateSchema = z.object({
  topic: z.string().min(1).max(500),
  image_key: z.string().max(256).optional(),
});
export type ChatCreateInput = z.infer<typeof ChatCreateSchema>;

export const ChatPatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  status: z.enum(["active", "completed", "abandoned"]).optional(),
});

export const ChatSendSchema = z
  .object({
    text: z.string().min(0).max(8000),
    image_key: z.string().max(256).optional(),
  })
  .refine((v) => v.text.trim().length > 0 || v.image_key !== undefined, {
    message: "text or image_key required",
  });

export const AssessmentAnswerSchema = z.object({
  question_id: z.number().int().nonnegative(),
  option_index: z.number().int().nonnegative().max(10),
});

export const ReportRegenerateSchema = z.object({
  kind: z.enum(["assessment", "progress", "completion"]),
});

export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
