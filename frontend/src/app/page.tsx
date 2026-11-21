"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export default function Home() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? "/board" : "/login");
  }, [ready, user, router]);

  return (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
      Opening fleetpair…
    </div>
  );
}
