"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/language-context";

const featureColors = [
  "from-[#57068c] to-[#7c3aed]",
  "from-[#7c3aed] to-[#a78bfa]",
  "from-[#a78bfa] to-[#ddd3f1]",
];
const featureHrefs = ["/treehole", "/blog", "/courses"];
const featureAvailable = [true, true, false];

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-24 px-4 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-5 tracking-tight">
          <span className="bg-gradient-to-r from-[#57068c] to-[#7c3aed] bg-clip-text text-transparent">
            {t.home.title}
          </span>
        </h1>
        <p className="text-lg text-muted-foreground mb-10 max-w-md mx-auto leading-relaxed">
          {t.home.subtitle}
          <br />
          <span className="text-sm">{t.home.tagline}</span>
        </p>
        <div className="flex justify-center gap-3">
          <Button
            size="lg"
            className="bg-gradient-to-r from-[#57068c] to-[#7c3aed] hover:opacity-90 transition-opacity border-0"
            nativeButton={false}
            render={<Link href="/treehole" />}
          >
            {t.home.enterTreehole}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-[#ddd3f1] hover:bg-secondary"
            nativeButton={false}
            render={<Link href="/blog" />}
          >
            {t.home.browseBlog}
          </Button>
        </div>
      </section>

      {/* Intro strip */}
      <section className="py-12 px-4 bg-secondary/40">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-xl font-bold mb-3">{t.home.introHeading}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mb-5">
            {t.home.introBody}
          </p>
          <div className="flex flex-wrap gap-3">
            {(t.home.introValues as readonly string[]).map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#ddd3f1] bg-card px-3 py-1 text-xs font-medium"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#7c3aed]" />
                {v}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="grid gap-6 md:grid-cols-3">
            {t.home.features.map((feature, i) => (
              <Link key={feature.title} href={featureHrefs[i]}>
                <Card className="h-full transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer border-[#ddd3f1]">
                  <CardContent className="pt-6">
                    <div
                      className={`h-1.5 w-10 rounded-full bg-gradient-to-r ${featureColors[i]} mb-5`}
                    />
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold">{feature.title}</h3>
                      {!featureAvailable[i] && (
                        <Badge variant="secondary" className="text-xs">
                          {t.home.comingSoon}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.desc}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#ddd3f1] py-8 px-4 mt-auto">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>{t.home.footer}</p>
        </div>
      </footer>
    </div>
  );
}
