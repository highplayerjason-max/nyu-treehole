"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LikeButton } from "@/components/shared/like-button";
import { ReportButton } from "@/components/shared/report-button";
import { useLanguage } from "@/contexts/language-context";
import type { Lang } from "@/lib/i18n";

type CommunityRoute = "treehole" | "gym";

interface CommentPreview {
  id: string;
  content: string;
  imageUrl?: string | null;
  isAnonymous: boolean;
  createdAt: string;
  author: { id: string; displayName: string } | null;
}

interface PostCardProps {
  board?: CommunityRoute;
  post: {
    id: string;
    content: string;
    imageUrl?: string | null;
    status?: string;
    isAnonymous: boolean;
    author: { id: string; displayName: string } | null;
    hashtags: { hashtag: { id: string; name: string } }[];
    _count: { comments: number; likes: number };
    likedByMe?: boolean;
    createdAt: string;
    comments?: CommentPreview[];
  };
}

function formatTime(dateStr: string, lang: Lang) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (lang === "en") {
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString("en-US");
  }

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return date.toLocaleDateString("zh-CN");
}

function renderContentWithHashtags(content: string, board: CommunityRoute) {
  const parts = content.split(/(#[\w\u4e00-\u9fa5]+)/g);
  return parts.map((part, index) => {
    if (!part.startsWith("#")) {
      return <span key={index}>{part}</span>;
    }

    const tag = part.slice(1);
    return (
      <Link
        key={index}
        href={`/${board}?hashtag=${encodeURIComponent(tag)}`}
        className="text-[#7c3aed] hover:underline"
      >
        {part}
      </Link>
    );
  });
}

function statusLabel(status?: string) {
  switch (status) {
    case "FLAGGED":
      return "审核中";
    case "REJECTED":
      return "已拒绝";
    default:
      return null;
  }
}

export function PostCard({ board = "treehole", post }: PostCardProps) {
  const { lang, t } = useLanguage();
  const previewComments = post.comments?.slice(0, 3) ?? [];
  const hasMoreComments = post._count.comments > previewComments.length;
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);

  async function handleTranslate() {
    if (translated !== null) {
      setShowTranslated(!showTranslated);
      return;
    }

    setTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: post.content, targetLang: lang }),
      });
      const data = await res.json();
      setTranslated(data.translated ?? post.content);
      setShowTranslated(true);
    } catch {
      setTranslated(null);
    } finally {
      setTranslating(false);
    }
  }

  const detailHref = `/${board}/${post.id}`;
  const viewAllText =
    lang === "zh"
      ? `${t.treehole.viewAllPrefix} ${post._count.comments} ${t.treehole.viewAllSuffix}`
      : `${t.treehole.viewAllPrefix} ${post._count.comments} ${t.treehole.viewAllSuffix}`;

  const moderationBadge = statusLabel(post.status);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="pt-4">
        <div className="mb-3 flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-[#ddd3f1] text-[#57068c]">
              {post.author
                ? post.author.displayName.charAt(0)
                : lang === "zh"
                ? "匿"
                : "A"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {post.author ? post.author.displayName : t.treehole.anonymousUser}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTime(post.createdAt, lang)}
            </p>
          </div>
          {moderationBadge && (
            <Badge variant="outline" className="text-xs">
              {moderationBadge}
            </Badge>
          )}
        </div>

        <Link href={detailHref} className="block">
          <p className="mb-3 whitespace-pre-wrap break-words text-sm leading-relaxed">
            {renderContentWithHashtags(post.content, board)}
          </p>
          {post.imageUrl && (
            <div className="mb-3">
              <Image
                src={post.imageUrl}
                alt="post image"
                width={480}
                height={320}
                className="max-h-72 w-auto rounded-xl border border-border object-cover"
              />
            </div>
          )}
        </Link>

        {showTranslated && translated && (
          <div className="mb-3 rounded-xl border border-[#ddd3f1] bg-[#f5f0fb] px-3 py-2">
            <p className="mb-1 text-xs font-medium text-[#57068c]">
              {t.translate.translated}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {translated}
            </p>
          </div>
        )}

        {post.hashtags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {post.hashtags.map(({ hashtag }) => (
              <Link
                key={hashtag.id}
                href={`/${board}?hashtag=${encodeURIComponent(hashtag.name)}`}
              >
                <Badge variant="secondary" className="cursor-pointer text-xs">
                  #{hashtag.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        <div className="-ml-2 mb-3 flex items-center gap-1">
          <LikeButton
            apiUrl={`/api/${board}/${post.id}/like`}
            initialCount={post._count.likes}
            initialLiked={post.likedByMe ?? false}
          />
          <Link href={detailHref}>
            <button className="inline-flex h-8 items-center px-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <svg
                className="mr-1 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              {post._count.comments}
            </button>
          </Link>
          <button
            onClick={handleTranslate}
            disabled={translating}
            className="inline-flex h-8 items-center px-2 text-xs text-muted-foreground transition-colors hover:text-[#7c3aed] disabled:opacity-50"
          >
            {translating
              ? t.translate.translating
              : showTranslated
              ? t.translate.showOriginal
              : t.translate.button}
          </button>
          <ReportButton
            contentType="post"
            contentId={post.id}
            apiUrl={`/api/${board}/${post.id}/report`}
          />
        </div>

        {previewComments.length > 0 && (
          <Link href={detailHref} className="block">
            <div className="space-y-1.5 rounded-xl bg-secondary/60 px-3 py-2">
              {previewComments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex min-w-0 gap-1.5 items-baseline"
                >
                  <span className="shrink-0 text-xs font-medium text-[#57068c]">
                    {comment.author
                      ? comment.author.displayName
                      : t.treehole.anonymousShort}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {comment.content || (comment.imageUrl ? "[image]" : "")}
                  </span>
                </div>
              ))}
              {hasMoreComments && (
                <p className="text-xs text-muted-foreground/70">{viewAllText}</p>
              )}
            </div>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
