import { Search, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { LIST_PAGE_SIZE } from "@/hooks/use-list-paging";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({
  children,
  left,
  right,
}: {
  children: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
        {left}
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("surface p-4 sm:p-5", className)}>{children}</section>;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative w-full">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-input bg-elevated pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
      />
    </div>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "destructive" | "info" | "muted";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    destructive: "bg-destructive/15 text-destructive border-destructive/30",
    info: "bg-info/15 text-info border-info/30",
    muted: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  required,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="label-xs block">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "h-11 w-full rounded-lg border border-input bg-elevated px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring disabled:opacity-60";

/** "Load N more" footer paired with `useListPaging`. */
export function LoadMore({
  shown,
  total,
  remaining,
  onLoadMore,
}: {
  shown: number;
  total: number;
  remaining: number;
  onLoadMore: () => void;
}) {
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Showing {shown} of {total}
      </p>
      {remaining > 0 ? (
        <button
          type="button"
          onClick={onLoadMore}
          className="mt-1 min-h-11 w-full rounded-lg border border-border bg-elevated text-sm font-medium"
        >
          Load {Math.min(LIST_PAGE_SIZE, remaining)} more ({remaining} remaining)
        </button>
      ) : null}
    </>
  );
}

export function MetaRow({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="label-xs">{i.label}</dt>
          <dd className="num mt-0.5 text-sm font-medium">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60";

export const btnOutline =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-elevated px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60";

export const btnDanger =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20";

export const btnIcon =
  "inline-flex size-11 items-center justify-center rounded-lg border border-border bg-elevated text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
