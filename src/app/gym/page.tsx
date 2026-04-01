"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { CreatePostForm } from "@/components/treehole/create-post-form";
import { PostCard } from "@/components/treehole/post-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/language-context";

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

  const res = await fetch(`/api/gym?${params}`);
  return res.json();
}

export default function GymPageWrapper() {
  return (
    <Suspense>
      <GymPage />
    </Suspense>
  );
}

function GymPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const hashtag = searchParams.get("hashtag");
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showMine, setShowMine] = useState(false);

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
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="flex gap-8">
        <div className="min-w-0 flex-1">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{t.gym.title}</h1>
              <p className="text-sm text-muted-foreground">{t.gym.subtitle}</p>
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
                  {showMine ? t.gym.allPosts : t.gym.myPosts}
                </Button>
              )}

              {hashtag && (
                <>
                  <Badge variant="secondary">#{hashtag}</Badge>
                  <Link href="/gym">
                    <Button variant="ghost" size="sm">
                      {t.gym.clearFilter}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <CreatePostForm
              onPostCreated={refreshPosts}
              apiPath="/api/gym"
              allowAnonymous={false}
              placeholder={t.gym.placeholder}
              submitLabel={t.gym.post}
            />

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((index) => (
                  <div key={index} className="space-y-3 rounded-lg border p-4">
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
              <div className="py-12 text-center text-muted-foreground">
                <p className="text-lg">{t.gym.noPosts}</p>
                <p className="text-sm">{t.gym.beFirst}</p>
              </div>
            ) : (
              <>
                {posts.map((post) => (
                  <PostCard key={post.id} board="gym" post={post} />
                ))}
                {nextCursor && (
                  <div className="py-4 text-center">
                    <Button
                      variant="outline"
                      onClick={loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? t.gym.loading : t.gym.loadMore}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-20">
            <Sidebar />
          </div>
        </div>
      </div>
    </div>
  );
}
