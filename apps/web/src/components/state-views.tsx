import { CircleAlertIcon, type LucideIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StateProps {
  title: string;
  description: string;
  className?: string;
  /** The next step, when there is one that the page header doesn't already offer. */
  children?: React.ReactNode;
}

/**
 * What a page says when it has nothing to show: an icon tile, a title, a
 * sentence or two, left-aligned on the canvas. No card, no illustration.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: StateProps & { icon: LucideIcon }) {
  return (
    <div className={cn("flex max-w-[420px] flex-col items-start gap-4 py-10", className)}>
      <div className="flex size-11 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="size-5" />
      </div>
      <div>
        <h2 className="font-heading text-lg leading-[26px] font-semibold tracking-[-0.01em]">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function ErrorState(props: StateProps) {
  return <EmptyState icon={CircleAlertIcon} {...props} />;
}

const rows = ["w-44", "w-56", "w-40"];

/** The shape of what is coming. `list` for a table of rows, `page` for a detail page. */
export function LoadingState({ label, variant = "list" }: { label: string; variant?: "list" | "page" }) {
  if (variant === "page") {
    return (
      <div aria-busy="true" aria-label={label} className="flex flex-col gap-6">
        <Skeleton className="h-4 w-48" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex max-w-[68ch] flex-col gap-3 pt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div aria-busy="true" aria-label={label} className="border-t">
      {rows.map((width) => (
        <div key={width} className="flex items-center gap-3 border-b px-2 py-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-2 py-0.5">
            <Skeleton className={cn("h-3.5", width)} />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="ml-8 h-3 w-8" />
        </div>
      ))}
    </div>
  );
}
