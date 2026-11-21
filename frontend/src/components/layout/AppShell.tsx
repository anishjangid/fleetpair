"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/board", label: "Board" },
  { href: "/profile", label: "Profile" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading hub…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-white/90 backdrop-blur-md">
        <div className="app-frame flex h-12 items-center justify-between gap-3 sm:h-14">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/board" className="shrink-0">
              <span className="text-[1.05rem] font-bold tracking-[-0.04em] sm:text-[1.15rem]">
                fleetpair
              </span>
            </Link>
            <nav className="flex items-center gap-0.5">
              {NAV.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex h-8 items-center rounded-md px-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-full px-1 pr-1.5 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:pr-2.5">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                  {user.avatarInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[140px] truncate text-left text-sm font-medium sm:block">
                {user.name}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground">
                      {user.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {user.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {user.role} · {user.hub}
                    </span>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <UserRound />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
              >
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="app-frame py-4 pb-24 sm:py-5 lg:pb-8">{children}</main>
    </div>
  );
}
