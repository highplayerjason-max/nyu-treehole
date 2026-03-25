import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CoursesPage() {
  return (
    <div className="container mx-auto max-w-2xl py-12 px-4">
      <div className="text-center">
        <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
          Coming Soon
        </Badge>
        <h1 className="text-3xl font-bold mb-4">课程评价</h1>
        <p className="text-muted-foreground mb-8">
          课评功能正在开发中，敬请期待
        </p>

        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="space-y-4 text-left text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-blue-600 text-xs font-bold">1</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">课程搜索</p>
                  <p>快速查找你想了解的课程</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <span className="text-green-600 text-xs font-bold">2</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">真实评价</p>
                  <p>来自同学们的真实课程体验</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <span className="text-purple-600 text-xs font-bold">3</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">评分系统</p>
                  <p>多维度评分帮你做出选择</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
