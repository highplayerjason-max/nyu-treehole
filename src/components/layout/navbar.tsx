"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/language-context";

export function Navbar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const isAdmin = session?.user?.role === "ADMIN";
  const { lang, setLang, t } = useLanguage();

  const navLinks = [
    { href: "/treehole", label: t.nav.treehole },
    { href: "/blog", label: t.nav.blog },
    { href: "/courses", label: t.nav.courses },
  ];

  const LangToggle = () => (
    <button
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      className="text-xs font-semibold px-2 py-1 rounded-md border border-[#ddd3f1] text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors"
    >
      {lang === "zh" ? "EN" : "中"}
    </button>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        {/* Logo */}
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <span className="text-xl font-bold bg-gradient-to-r from-[#57068c] to-[#7c3aed] bg-clip-text text-transparent">
            {t.home.title}
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className="transition-colors hover:text-foreground/80 text-red-500"
            >
              {t.nav.admin}
            </Link>
          )}
        </nav>

        <div className="flex-1" />

        {/* Desktop right side */}
        <div className="hidden md:flex items-center space-x-2">
          <LangToggle />
          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                  />
                }
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {session.user.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{session.user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.user.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem render={<Link href="/admin" />}>
                    {t.nav.admin}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem render={<Link href="/account" />}>
                  {t.nav.settings}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="cursor-pointer"
                >
                  {t.nav.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
                {t.nav.login}
              </Button>
              <Button size="sm" nativeButton={false} render={<Link href="/register" />}>
                {t.nav.register}
              </Button>
            </>
          )}
        </div>

        {/* Mobile: lang toggle + hamburger */}
        <div className="md:hidden flex items-center gap-2">
          <LangToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={<Button variant="ghost" size="sm" />}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0 flex flex-col">
              {/* Sidebar header */}
              <div className="px-6 py-5 border-b border-[#ddd3f1]">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="text-xl font-bold bg-gradient-to-r from-[#57068c] to-[#7c3aed] bg-clip-text text-transparent"
                >
                  {t.home.title}
                </Link>
              </div>

              {/* Nav links */}
              <nav className="flex flex-col px-4 py-4 gap-1 flex-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="text-base font-medium py-2.5 px-3 rounded-xl hover:bg-secondary transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="text-base font-medium py-2.5 px-3 rounded-xl hover:bg-secondary transition-colors text-red-500"
                  >
                    {t.nav.admin}
                  </Link>
                )}
              </nav>

              {/* Auth section */}
              <div className="px-4 pb-6 pt-4 border-t border-[#ddd3f1]">
                {session?.user ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 px-1">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-[#ddd3f1] text-[#57068c] text-sm font-semibold">
                          {session.user.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{session.user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full border-[#ddd3f1]"
                      nativeButton={false}
                      render={<Link href="/account" onClick={() => setOpen(false)} />}
                    >
                      {t.nav.settings}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-[#ddd3f1]"
                      onClick={() => {
                        signOut({ callbackUrl: "/" });
                        setOpen(false);
                      }}
                    >
                      {t.nav.logout}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full bg-gradient-to-r from-[#57068c] to-[#7c3aed] border-0"
                      nativeButton={false}
                      render={<Link href="/login" onClick={() => setOpen(false)} />}
                    >
                      {t.nav.login}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-[#ddd3f1]"
                      nativeButton={false}
                      render={<Link href="/register" onClick={() => setOpen(false)} />}
                    >
                      {t.nav.register}
                    </Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
