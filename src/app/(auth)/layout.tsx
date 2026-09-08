import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-background px-5 py-12">
      {/* Quiet decorative dots in the brand tints, kept far from the form */}
      <span aria-hidden="true" className="pointer-events-none absolute left-[8%] top-[14%] size-16 rounded-full bg-tint-blue/30 blur-[1px]" />
      <span aria-hidden="true" className="pointer-events-none absolute right-[10%] top-[22%] size-10 rounded-full bg-tint-yellow/40" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-[10%] left-[8%] size-8 rounded-full bg-tint-green/35" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-[6%] right-[5%] size-14 rounded-full bg-tint-pink/40" />
      <div className="page-enter w-full max-w-[440px]">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="rounded-[2rem] border border-border bg-card p-8 md:p-10">{children}</div>
      </div>
    </div>
  );
}
