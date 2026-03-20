"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArticleCard } from "@/components/blog/article-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sidebar } from "@/components/layout/sidebar";
import { useLanguage } from "@/contexts/language-context";

interface Article {
  slug: string;
  title: string;
  excerpt?: string | null;
  author: { id: string; displayName: string; avatarUrl?: string | null };
  tags: { tag: { name: string } }[];
  series?: { title: string } | null;
  createdAt: string;
}

async function fetchArticlesPage(
  page: number,
  search: string,
  tagFilter: string | null
) {
  const params = new URLSearchParams({ page: page.toString() });
  if (search) params.set("search", search);
  if (tagFilter) params.set("tag", tagFilter);

  const res = await fetch(`/api/blog?${params}`);
  return res.json();
}

export default function BlogPageWrapper() {
  return (
    <Suspense>
      <BlogPage />
    </Suspense>
  );
}

function BlogPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const tagFilter = searchParams.get("tag");
  const { t } = useLanguage();
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadArticles() {
      const data = await fetchArticlesPage(page, search, tagFilter);

      if (!active) return;

      setArticles(data.articles || []);
      setTotalPages(data.pages || 1);
      setLoading(false);
    }

    void loadArticles();

    return () => {
      active = false;
    };
  }, [page, search, tagFilter]);

  return (
    <div className="container mx-auto max-w-6xl py-6 px-4">
      <div className="flex gap-8">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">{t.blog.title}</h1>
              <p className="text-sm text-muted-foreground">{t.blog.subtitle}</p>
            </div>
            {session && (
              <Button nativeButton={false} render={<Link href="/blog/new" />}>
                {t.blog.newArticle}
              </Button>
            )}
          </div>

          <div className="flex gap-2 mb-6">
            <Input
              placeholder={t.blog.searchPlaceholder}
              value={search}
              onChange={(e) => {
                setLoading(true);
                setSearch(e.target.value);
                setPage(1);
              }}
              className="max-w-sm"
            />
            {tagFilter && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{tagFilter}</Badge>
                <Link href="/blog">
                  <Button variant="ghost" size="sm">
                    {t.blog.clearFilter}
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="space-y-3 p-4 border rounded-lg">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">{t.blog.noContent}</p>
              {session && (
                <p className="text-sm mt-1">
                  <Link href="/blog/new" className="text-primary hover:underline">
                    {t.blog.writeFirst}
                  </Link>
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {articles.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => {
                      setLoading(true);
                      setPage(page - 1);
                    }}
                  >
                    {t.blog.prevPage}
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => {
                      setLoading(true);
                      setPage(page + 1);
                    }}
                  >
                    {t.blog.nextPage}
                  </Button>
                </div>
              )}
            </>
          )}
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
