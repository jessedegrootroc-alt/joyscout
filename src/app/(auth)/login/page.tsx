import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <p className="eyebrow mb-3">Welcome back</p>
      <h1 className="display mb-2 text-[2rem]">Sign in to LeadLens</h1>
      <p className="mb-7 text-[15px] text-muted-foreground">Pick up where you left off: today&apos;s best prospects are waiting.</p>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </>
  );
}
