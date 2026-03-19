"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/language-context";

interface TrendingTag {
  name: string;
  count: number;
}

export function Sidebar() {
  const { t } = useLanguage();
  const [tags, setTags] = useState<TrendingTag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hashtags/trending")
      .then((r) => r.json())
      .then((data) => {
        setTags(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const navLinks = [
    { href: "/", label: t.sidebar.home },
    { href: "/treehole", label: t.nav.treehole },
    { href: "/blog", label: t.nav.blog },
    { href: "/courses", label: t.nav.courses },
  ];

  return (
    <aside className="space-y-5">
      {/* Navigation */}
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          {t.sidebar.navigation}
        </h3>
        <nav className="space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Trending hashtags */}
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          {t.sidebar.trending}
        </h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-7 rounded-full bg-secondary animate-pulse"
              />
            ))}
          </div>
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.sidebar.noTags}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Link
                key={tag.name}
                href={`/treehole?hashtag=${encodeURIComponent(tag.name)}`}
              >
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-[#ddd3f1] transition-colors text-xs"
                >
                  #{tag.name}
                  <span className="ml-1 text-muted-foreground">
                    {tag.count}
                  </span>
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* About */}
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          {t.sidebar.about}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t.sidebar.aboutDesc}
        </p>
      </div>
    </aside>
  );
}
