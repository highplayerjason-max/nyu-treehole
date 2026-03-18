"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LikeButton } from "@/components/shared/like-button";
import { ReportButton } from "@/components/shared/report-button";
import { useLanguage } from "@/contexts/language-context";
import type { Lang } from "@/lib/i18n";

interface CommentPreview {
  id: string;
  content: string;
  isAnonymous: boolean;
  createdAt: string;
  author: { id: string; displayName: string } | null;
}

interface PostCardProps {
  post: {
    id: string;
    content: string;
    imageUrl?: string | null;
    isAnonymous: boolean;
    author: { id: string; displayName: string; avatarUrl?: string | null } | null;
    hashtags: { hashtag: { id: string; name: string } }[];
    _count: { comments: number; likes: number };
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

function renderContentWithHashtags(content: string) {
  const parts = content.split(/(#[\w\u4e00-\u9fa5]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("#")) {
      const tag = part.slice(1);
      return (
        <Link
          key={i}
          href={`/treehole?hashtag=${encodeURIComponent(tag)}`}
          className="text-[#7c3aed] hover:underline"
        >
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function PostCard({ post }: PostCardProps) {
  const { lang, t } = useLanguage();
  const previewComments = post.comments?.slice(0, 3) ?? [];
  const hasMoreComments = post._count.comments > previewComments.length;

  // Translation state
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

  const viewAllText =
    lang === "zh"
      ? `${t.treehole.viewAllPrefix} ${post._count.comments} ${t.treehole.viewAllSuffix}`
      : `${t.treehole.viewAllPrefix} ${post._count.comments} ${t.treehole.viewAllSuffix}`;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="pt-4">
        {/* Author info */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-[#ddd3f1] text-[#57068c]">
              {post.author ? post.author.displayName.charAt(0) : (lang === "zh" ? "匿" : "A")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {post.author ? post.author.displayName : t.treehole.anonymousUser}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTime(post.createdAt, lang)}
            </p>
          </div>
        </div>

        {/* Content */}
        <Link href={`/treehole/${post.id}`} className="block">
          <p className="text-sm whitespace-pre-wrap break-words mb-3 leading-relaxed">
            {renderContentWithHashtags(post.content)}
          </p>
          {post.imageUrl && (
            <div className="mb-3">
              <Image
                src={post.imageUrl}
                alt="post image"
                width={480}
                height={320}
                className="rounded-xl object-cover max-h-72 w-auto border border-border"
              />
            </div>
          )}
        </Link>

        {/* Translated content */}
        {showTranslated && translated && (
          <div className="mb-3 rounded-xl border border-[#ddd3f1] bg-[#f5f0fb] px-3 py-2">
            <p className="text-xs text-[#57068c] font-medium mb-1">
              {t.translate.translated}
            </p>
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {translated}
            </p>
          </div>
        )}

        {/* Hashtags */}
        {post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {post.hashtags.map(({ hashtag }) => (
              <Link
                key={hashtag.id}
                href={`/treehole?hashtag=${encodeURIComponent(hashtag.name)}`}
              >
                <Badge variant="secondary" className="text-xs cursor-pointer">
                  #{hashtag.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 -ml-2 mb-3">
          <LikeButton postId={post.id} initialCount={post._count.likes} />
          <Link href={`/treehole/${post.id}`}>
            <button className="inline-flex items-center h-8 px-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {post._count.comments}
            </button>
          </Link>
          {/* Translate button */}
          <button
            onClick={handleTranslate}
            disabled={translating}
            className="inline-flex items-center h-8 px-2 text-xs text-muted-foreground hover:text-[#7c3aed] transition-colors disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            {translating
              ? t.translate.translating
              : showTranslated
              ? t.translate.showOriginal
              : t.translate.button}
          </button>
          <ReportButton contentType="post" contentId={post.id} />
        </div>

        {/* Comment preview */}
        {previewComments.length > 0 && (
          <Link href={`/treehole/${post.id}`} className="block">
            <div className="rounded-xl bg-secondary/60 px-3 py-2 space-y-1.5">
              {previewComments.map((c) => (
                <div key={c.id} className="flex gap-1.5 items-baseline min-w-0">
                  <span className="text-xs font-medium text-[#57068c] shrink-0">
                    {c.author ? c.author.displayName : t.treehole.anonymousShort}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {c.content}
                  </span>
                </div>
              ))}
              {hasMoreComments && (
                <p className="text-xs text-muted-foreground/70">
                  {viewAllText}
                </p>
              )}
            </div>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
