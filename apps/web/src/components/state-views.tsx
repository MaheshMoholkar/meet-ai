import { AlertCircleIcon, Loader2Icon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StateProps {
  title: string;
  description: string;
  className?: string;
  children?: React.ReactNode;
}

function StateCard({
  icon: Icon,
  iconClassName,
  title,
  description,
  className,
  children,
}: StateProps & { icon: LucideIcon; iconClassName?: string }) {
  return (
    <div className={cn("flex flex-1 items-center justify-center px-8 py-4", className)}>
      <div className="flex max-w-md flex-col items-center gap-y-5 rounded-xl bg-background p-10 text-center shadow-sm">
        <Icon className={cn("size-8 text-muted-foreground", iconClassName)} />
        <div className="flex flex-col gap-y-2">
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LoadingState(props: StateProps) {
  return <StateCard icon={Loader2Icon} iconClassName="animate-spin text-primary" {...props} />;
}

export function ErrorState(props: StateProps) {
  return <StateCard icon={AlertCircleIcon} iconClassName="text-destructive" {...props} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: StateProps & { icon: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-4 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <div className="flex max-w-sm flex-col gap-y-2">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
