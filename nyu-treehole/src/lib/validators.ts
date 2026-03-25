import { z } from "zod";
import { isAcceptedImageUrl } from "./uploads";

export const nyuEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("请输入有效的邮箱地址")
  .endsWith("@nyu.edu", "仅支持 NYU 邮箱（@nyu.edu）注册");

const optionalImageReferenceSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || isAcceptedImageUrl(value),
    "图片地址必须是 /uploads/... 或 http/https 链接"
  );

export const registerSchema = z.object({
  email: nyuEmailSchema,
  password: z.string().min(6, "密码至少 6 个字符"),
  displayName: z.string().min(2, "昵称至少 2 个字符").max(20, "昵称最多 20 个字符"),
});

export const resendVerificationSchema = z.object({
  email: nyuEmailSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("请输入有效的邮箱地址"),
  password: z.string().min(1, "请输入密码"),
});

export const treeholePostSchema = z.object({
  content: z.string().min(1, "内容不能为空").max(2000, "内容最多 2000 个字符"),
  imageUrl: optionalImageReferenceSchema.optional().or(z.literal("")),
  isAnonymous: z.boolean().default(false),
});

export const treeholeCommentSchema = z.object({
  content: z.string().min(1, "评论不能为空").max(500, "评论最多 500 个字符"),
  isAnonymous: z.boolean().default(false),
  parentId: z.string().optional(),
});

export const blogArticleSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200, "标题最多 200 个字符"),
  content: z.string().min(1, "内容不能为空"),
  excerpt: z.string().max(500, "摘要最多 500 个字符").optional(),
  coverImage: optionalImageReferenceSchema.optional().or(z.literal("")),
  isDraft: z.boolean().default(true),
  tags: z.array(z.string()).max(10, "最多 10 个标签").default([]),
  seriesId: z.string().optional(),
  seriesOrder: z.number().int().positive().optional(),
});

export const reportSchema = z.object({
  reason: z.string().max(500, "举报原因最多 500 个字符").optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type TreeholePostInput = z.infer<typeof treeholePostSchema>;
export type TreeholeCommentInput = z.infer<typeof treeholeCommentSchema>;
export type BlogArticleInput = z.infer<typeof blogArticleSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
