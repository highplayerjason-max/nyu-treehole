"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
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
  imageUrl?: string | null;
  status?: string;
  isAnonymous: boolean;
  author: { id: string; displayName: string } | null;
  hashtags: { hashtag: { id: string; name: string } }[];
  _count: { comments: number; likes: number };
  likedByMe?: boolean;
  createdAt: string;
  comments: {
    id: string;
    content: string;
    imageUrl?: string | null;
    isAnonymous: boolean;
    createdAt: string;
    author: { id: string; displayName: string } | null;
  }[];
}

async function fetchPostsPage(
  hashtag: string | null,
  cursor?: string,
  mine?: boolean
) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (hashtag) params.set("hashtag", hashtag);
  if (mine) params.set("mine", "true");

  const res = await fetch(`/api/treehole?${params}`);
  return res.json();
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
  const { lang, t } = useLanguage();
  const { data: session } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showMine, setShowMine] = useState(false);
  const allPostsLabel = lang === "zh" ? "全部帖子" : "All posts";
  const myPostsLabel = lang === "zh" ? "我的发帖" : "My posts";

  useEffect(() => {
    let active = true;

    async function loadInitial() {
      const data = await fetchPostsPage(hashtag, undefined, showMine);

      if (!active) return;

      setPosts(data.posts || []);
      setNextCursor(data.nextCursor);
      setLoading(false);
    }

    void loadInitial();

    return () => {
      active = false;
    };
  }, [hashtag, showMine]);

  async function refreshPosts() {
    setLoading(true);
    const data = await fetchPostsPage(hashtag, undefined, showMine);
    setPosts(data.posts || []);
    setNextCursor(data.nextCursor);
    setLoading(false);
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchPostsPage(hashtag, nextCursor, showMine);
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
            <div className="flex items-center gap-2">
              {session && (
                <Button
                  variant={showMine ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setLoading(true);
                    setShowMine((prev) => !prev);
                  }}
                >
                  {showMine ? allPostsLabel : myPostsLabel}
                </Button>
              )}
              {hashtag && (
                <>
                  <Badge variant="secondary">#{hashtag}</Badge>
                  <Link href="/treehole">
                    <Button variant="ghost" size="sm">
                      {t.treehole.clearFilter}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <CreatePostForm onPostCreated={refreshPosts} />

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
                  <PostCard key={post.id} board="treehole" post={post} />
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
