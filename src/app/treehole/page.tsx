"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { CreatePostForm } from "@/components/treehole/create-post-form";
import { PostCard } from "@/components/treehole/post-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

interface Post {
  id: string;
  content: string;
  isAnonymous: boolean;
  author: { id: string; displayName: string; avatarUrl?: string | null } | null;
  hashtags: { hashtag: { id: string; name: string } }[];
  _count: { comments: number; likes: number };
  createdAt: string;
}

export default function TreeholePageWrapper() {
  return (
    <Suspense>
      <TreeholePage />
    </Suspense>
  );
}

function TreeholePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const hashtag = searchParams.get("hashtag");
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingHashtag, setDeletingHashtag] = useState(false);

  const fetchPosts = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (hashtag) params.set("hashtag", hashtag);

      const res = await fetch(`/api/treehole?${params}`);
      const data = await res.json();
      return data;
    },
    [hashtag]
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    const data = await fetchPosts();
    setPosts(data.posts || []);
    setNextCursor(data.nextCursor);
    setLoading(false);
  }, [fetchPosts]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchPosts(nextCursor);
    setPosts((prev) => [...prev, ...(data.posts || [])]);
    setNextCursor(data.nextCursor);
    setLoadingMore(false);
  }

  async function handleDeleteHashtag() {
    if (!hashtag || session?.user?.role !== "ADMIN") return;
    if (!window.confirm(`确认全站删除话题 #${hashtag} 吗？`)) return;

    setDeletingHashtag(true);
    try {
      const res = await fetch(
        `/api/treehole/hashtags/${encodeURIComponent(hashtag)}`,
        { method: "DELETE" }
      );
      const data = await res.json();

      if (!res.ok) {
        window.alert(data.error || "删除标签失败");
        return;
      }

      router.push("/treehole");
    } finally {
      setDeletingHashtag(false);
    }
  }

  return (
    <div className="container mx-auto max-w-2xl py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">树洞</h1>
          <p className="text-sm text-muted-foreground">
            说出你想说的，可以选择匿名
          </p>
        </div>
        {hashtag && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">#{hashtag}</Badge>
            {session?.user?.role === "ADMIN" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteHashtag}
                disabled={deletingHashtag}
              >
                {deletingHashtag ? "删除中..." : "删除标签"}
              </Button>
            )}
            <Link href="/treehole">
              <Button variant="ghost" size="sm">
                清除筛选
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <CreatePostForm onPostCreated={loadInitial} />

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">还没有人发帖</p>
            <p className="text-sm">成为第一个发言的人吧</p>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {nextCursor && (
              <div className="text-center py-4">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "加载中..." : "加载更多"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
