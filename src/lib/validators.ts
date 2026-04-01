import { z } from "zod";
import { isAcceptedImageUrl } from "./uploads";
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
} from "./display-name";

export const nyuEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("\u8bf7\u8f93\u5165\u6709\u6548\u7684\u90ae\u7bb1\u5730\u5740")
  .endsWith(
    "@nyu.edu",
    "\u4ec5\u652f\u6301 NYU \u90ae\u7bb1\uff08@nyu.edu\uff09\u6ce8\u518c"
  );

const optionalImageReferenceSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || isAcceptedImageUrl(value),
    "\u56fe\u7247\u5730\u5740\u5fc5\u987b\u662f /uploads/... \u6216 http/https \u94fe\u63a5"
  );

export const displayNameSchema = z
  .string()
  .trim()
  .min(
    DISPLAY_NAME_MIN_LENGTH,
    `\u6635\u79f0\u81f3\u5c11 ${DISPLAY_NAME_MIN_LENGTH} \u4e2a\u5b57\u7b26`
  )
  .max(
    DISPLAY_NAME_MAX_LENGTH,
    `\u6635\u79f0\u6700\u591a ${DISPLAY_NAME_MAX_LENGTH} \u4e2a\u5b57\u7b26`
  );

export const registerSchema = z.object({
  email: nyuEmailSchema,
  password: z
    .string()
    .min(6, "\u5bc6\u7801\u81f3\u5c11 6 \u4e2a\u5b57\u7b26"),
  displayName: displayNameSchema,
});

export const resendVerificationSchema = z.object({
  email: nyuEmailSchema,
});

export const updateDisplayNameSchema = z.object({
  displayName: displayNameSchema,
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("\u8bf7\u8f93\u5165\u6709\u6548\u7684\u90ae\u7bb1\u5730\u5740"),
  password: z.string().min(1, "\u8bf7\u8f93\u5165\u5bc6\u7801"),
});

export const treeholePostSchema = z.object({
  content: z
    .string()
    .trim()
    .max(2000, "\u5185\u5bb9\u6700\u591a 2000 \u4e2a\u5b57\u7b26")
    .default(""),
  imageUrl: optionalImageReferenceSchema.optional().or(z.literal("")),
  isAnonymous: z.boolean().default(false),
}).refine(
  (value) => value.content.length > 0 || Boolean(value.imageUrl),
  {
    message: "\u5185\u5bb9\u6216\u56fe\u7247\u81f3\u5c11\u586b\u5199\u4e00\u9879",
    path: ["content"],
  }
);

export const treeholeCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .max(500, "\u8bc4\u8bba\u6700\u591a 500 \u4e2a\u5b57\u7b26")
    .default(""),
  imageUrl: optionalImageReferenceSchema.optional().or(z.literal("")),
  isAnonymous: z.boolean().default(false),
  parentId: z.string().optional(),
}).refine(
  (value) => value.content.length > 0 || Boolean(value.imageUrl),
  {
    message: "\u8bc4\u8bba\u6587\u5b57\u6216\u56fe\u7247\u81f3\u5c11\u586b\u5199\u4e00\u9879",
    path: ["content"],
  }
);

export const blogArticleSchema = z.object({
  title: z
    .string()
    .min(1, "\u6807\u9898\u4e0d\u80fd\u4e3a\u7a7a")
    .max(200, "\u6807\u9898\u6700\u591a 200 \u4e2a\u5b57\u7b26"),
  content: z.string().min(1, "\u5185\u5bb9\u4e0d\u80fd\u4e3a\u7a7a"),
  excerpt: z
    .string()
    .max(500, "\u6458\u8981\u6700\u591a 500 \u4e2a\u5b57\u7b26")
    .optional(),
  coverImage: optionalImageReferenceSchema.optional().or(z.literal("")),
  isDraft: z.boolean().default(true),
  tags: z
    .array(z.string())
    .max(10, "\u6700\u591a 10 \u4e2a\u6807\u7b7e")
    .default([]),
  seriesId: z.string().optional(),
  seriesOrder: z.number().int().positive().optional(),
});

export const reportSchema = z.object({
  reason: z
    .string()
    .max(500, "\u4e3e\u62a5\u539f\u56e0\u6700\u591a 500 \u4e2a\u5b57\u7b26")
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>;
export type TreeholePostInput = z.infer<typeof treeholePostSchema>;
export type TreeholeCommentInput = z.infer<typeof treeholeCommentSchema>;
export type BlogArticleInput = z.infer<typeof blogArticleSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
