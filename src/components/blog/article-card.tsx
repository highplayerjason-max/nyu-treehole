import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ArticleCardProps {
  article: {
    slug: string;
    title: string;
    excerpt?: string | null;
    author: { displayName: string };
    tags: { tag: { name: string } }[];
    series?: { title: string } | null;
    createdAt: string;
  };
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Link href={`/blog/${article.slug}`}>
      <Card className="h-full transition-shadow hover:shadow-md cursor-pointer">
        <CardContent className="pt-4">
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
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
