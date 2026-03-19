"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { CreatePostForm } from "@/components/treehole/create-post-form";
import { PostCard } from "@/components/treehole/post-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sidebar } from "@/components/layout/sidebar";
import { useLanguage } from "@/contexts/language-context";
import Link from "next/link";

interface Post {
  id: string;
  content: string;
  isAnonymous: boolean;
  author: { id: string; displayName: string; avatarUrl?: string | null } | null;
  hashtags: { hashtag: { id: string; name: string } }[];
  _count: { comments: number; likes: number };
  createdAt: string;
  comments: {
    id: string;
    content: string;
    isAnonymous: boolean;
    createdAt: string;
    author: { id: string; displayName: string } | null;
  }[];
}

export default function TreeholePageWrapper() {
  return (
    <Suspense>
      <TreeholePage />
    </Suspense>
  );
}

function TreeholePage() {
  const searchParams = useSearchParams();
  const hashtag = searchParams.get("hashtag");
  const { t } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

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

  return (
    <div className="container mx-auto max-w-5xl py-6 px-4">
      <div className="flex gap-8">
        {/* Main feed */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">{t.treehole.title}</h1>
              <p className="text-sm text-muted-foreground">
                {t.treehole.subtitle}
              </p>
            </div>
            {hashtag && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">#{hashtag}</Badge>
                <Link href="/treehole">
                  <Button variant="ghost" size="sm">
                    {t.treehole.clearFilter}
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
                <p className="text-lg">{t.treehole.noPosts}</p>
                <p className="text-sm">{t.treehole.beFirst}</p>
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
                      {loadingMore ? t.treehole.loading : t.treehole.loadMore}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* PC sidebar */}
        <div className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-20">
            <Sidebar />
          </div>
        </div>
      </div>
    </div>
  );
}
