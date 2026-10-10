import { Search, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { LIST_PAGE_SIZE } from "@/hooks/use-list-paging";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
  badge,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {badge}
        </div>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
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
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
        {left}
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("surface p-4.5 sm:p-6 transition-all duration-200", className)}>
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-elevated/30 px-6 py-12 text-center">
      <span className="mb-3.5 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground sm:text-sm">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
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
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-border/80 bg-elevated/70 pl-10 pr-9 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/80 focus:ring-2 focus:ring-primary/20"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
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
  const tones = {
    success: {
      wrap: "bg-success/15 text-success border-success/30",
      dot: "bg-success animate-pulse",
    },
    warning: {
      wrap: "bg-warning/15 text-warning border-warning/30",
      dot: "bg-warning",
    },
    destructive: {
      wrap: "bg-destructive/15 text-destructive border-destructive/30",
      dot: "bg-destructive",
    },
    info: {
      wrap: "bg-info/15 text-info border-info/30",
      dot: "bg-info",
    },
    muted: {
      wrap: "bg-muted text-muted-foreground border-border",
      dot: "bg-muted-foreground",
    },
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tones.wrap,
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", tones.dot)} aria-hidden />
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
      <label htmlFor={htmlFor} className="label-xs block text-muted-foreground font-semibold">
        {label}
        {required ? <span className="text-destructive font-bold"> *</span> : null}
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
  "h-11 w-full rounded-xl border border-border/80 bg-elevated/70 px-3.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/80 focus:ring-2 focus:ring-primary/20 disabled:opacity-50";

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
    <div className="flex flex-col items-center gap-2 pt-1">
      <p className="text-xs text-muted-foreground">
        Showing {shown} of {total} records
      </p>
      {remaining > 0 ? (
        <button
          type="button"
          onClick={onLoadMore}
          className="min-h-11 w-full rounded-xl border border-border/80 bg-elevated/60 text-sm font-medium transition-all hover:bg-accent active:scale-[0.99]"
        >
          Load {Math.min(LIST_PAGE_SIZE, remaining)} more ({remaining} remaining)
        </button>
      ) : null}
    </div>
  );
}

export function MetaRow({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="label-xs text-[10px] text-muted-foreground/80">{i.label}</dt>
          <dd className="num mt-0.5 truncate text-sm font-medium text-foreground">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-150 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/30 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none";

export const btnOutline =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/80 bg-elevated/70 px-4 py-2.5 text-sm font-medium text-foreground transition-all duration-150 hover:bg-accent hover:border-border active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none";

export const btnDanger =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition-all duration-150 hover:bg-destructive/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none";

export const btnIcon =
  "inline-flex size-11 items-center justify-center rounded-xl border border-border/70 bg-elevated/70 text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground active:scale-[0.96] disabled:opacity-50 cursor-pointer select-none";
