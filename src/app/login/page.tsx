import { Suspense } from "react";
import { LoginForm } from "@/components/research/LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-6 text-[var(--muted)]">
          Loading…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
