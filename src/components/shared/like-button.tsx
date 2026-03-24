"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface LikeButtonProps {
  /** @deprecated Use apiUrl instead for new integrations */
  postId?: string;
  /** Full API path for the like toggle endpoint, e.g. "/api/blog/my-slug/like" */
  apiUrl?: string;
  initialCount: number;
  initialLiked?: boolean;
}

export function LikeButton({
  postId,
  apiUrl,
  initialCount,
  initialLiked = false,
}: LikeButtonProps) {
  const { data: session } = useSession();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setLiked(initialLiked);
    setCount(initialCount);
  }, [initialLiked, initialCount]);

  async function handleLike() {
    if (!session) {
      toast.error("请先登录");
      return;
    }
    if (pending) return;

    try {
      setPending(true);
      const endpoint = apiUrl || `/api/treehole/${postId}/like`;
      const res = await fetch(endpoint, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "操作失败");
        return;
      }
      setLiked(Boolean(data.liked));
      setCount(typeof data.count === "number" ? data.count : count);
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLike}
      disabled={pending}
      className={`h-8 px-2 ${liked ? "text-red-500" : "text-muted-foreground"}`}
    >
      <svg
        className="w-4 h-4 mr-1"
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      {count}
    </Button>
  );
}
