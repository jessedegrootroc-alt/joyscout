import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <p className="eyebrow mb-3">Get started</p>
      <h1 className="display mb-2 text-[2rem]">Create your account</h1>
      <p className="mb-7 text-[15px] text-muted-foreground">Find local businesses whose website is holding them back.</p>
      <Suspense>
        <AuthForm mode="register" />
      </Suspense>
    </>
  );
}
