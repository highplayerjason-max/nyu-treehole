import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const adminNav = [
  {
    href: "/admin",
    label: "Overview",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  },
  {
    href: "/admin/moderation",
    label: "Moderation",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    href: "/admin/tags",
    label: "Tags",
    icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/?error=unauthorized");
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <aside className="hidden w-64 border-r bg-muted/30 p-4 md:block">
        <h2 className="mb-4 text-lg font-bold text-red-500">Admin Console</h2>
        <nav className="space-y-1">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={item.icon}
                />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="absolute w-full border-b p-2 md:hidden">
        <div className="flex gap-2 overflow-x-auto">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full border px-3 py-1 text-sm hover:bg-accent"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <main className="mt-10 flex-1 p-6 md:mt-0 md:p-8">{children}</main>
    </div>
  );
}
