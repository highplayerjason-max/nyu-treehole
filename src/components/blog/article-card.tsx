import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ArticleCardProps {
  article: {
    slug: string;
    title: string;
    excerpt?: string | null;
    coverImage?: string | null;
    author: { displayName: string };
    tags: { tag: { name: string } }[];
    series?: { title: string } | null;
    _count?: { likes: number };
    createdAt: string;
  };
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Link href={`/blog/${article.slug}`}>
      <Card className="h-full transition-shadow hover:shadow-md cursor-pointer">
        <CardContent className="pt-4">
          {article.coverImage && (
            <div className="mb-4 overflow-hidden rounded-xl border border-border">
              <Image
                src={article.coverImage}
                alt={`${article.title} cover`}
                width={960}
                height={540}
                className="h-48 w-full object-cover"
              />
            </div>
          )}
          {article.series && (
            <p className="text-xs text-blue-500 mb-1">
              {article.series.title}
            </p>
          )}
          <h3 className="font-semibold text-lg mb-2 line-clamp-2">
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
              {article.excerpt}
            </p>
          )}
          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {article.tags.slice(0, 3).map(({ tag }) => (
                <Badge key={tag.name} variant="secondary" className="text-xs">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[10px]">
                {article.author.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span>{article.author.displayName}</span>
            <span>&middot;</span>
            <span>{new Date(article.createdAt).toLocaleDateString("zh-CN")}</span>
            {(article._count?.likes ?? 0) > 0 && (
              <>
                <span>&middot;</span>
                <span className="flex items-center gap-0.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {article._count!.likes}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
