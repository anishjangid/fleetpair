"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) router.replace("/board");
  }, [ready, user, router]);

  return (
    <div className="login-canvas">
      <LoginForm />
    </div>
  );
}
