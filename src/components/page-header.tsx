import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-[1.75rem] leading-[1.15] font-medium tracking-tight md:text-[2rem]">{title}</h1>
        {description && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-input px-6 py-16 text-center">
      <p className="eyebrow mb-3">{eyebrow ?? "Nothing here yet"}</p>
      <p className="text-[17px] font-medium">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Section card header used across pages */
export function SectionHeader({ title, meta, action }: { title: React.ReactNode; meta?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="whitespace-nowrap text-[15px] font-medium">{title}</h2>
        {meta && <span className="hidden truncate text-[12px] text-muted-foreground sm:inline">{meta}</span>}
      </div>
      {action}
    </header>
  );
}
