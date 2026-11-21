"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { DEMO_CREDENTIALS } from "@/lib/auth";

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function enterHub() {
    setLoading(true);
    const result = login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not open hub");
      return;
    }
    toast.success("Signed in");
    router.replace("/board");
  }

  return (
    <div className="uiverse-login">
      <div className="mb-6 text-center">
        <p className="text-[1.65rem] font-bold tracking-[-0.04em] text-foreground">
          fleetpair
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Indiranagar Hub</p>
      </div>

      <button
        type="button"
        className="uiverse-cta w-full"
        disabled={loading}
        onClick={enterHub}
      >
        <span className="inline-flex items-center justify-center gap-2">
          <LogIn className="size-4" />
          {loading ? "Opening…" : "Enter hub"}
        </span>
      </button>
    </div>
  );
}
