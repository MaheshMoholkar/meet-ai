import { cn } from "@/lib/utils";

/** The quiet screens around a call (lobby, ended, errors): one card centred on the Night stage. */
export function CallCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div
        className={cn(
          "flex w-full max-w-[440px] flex-col items-center gap-y-5 rounded-xl border bg-card p-10 text-center shadow-dialog",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function CallCardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="font-heading text-2xl leading-[30px] font-semibold tracking-[-0.015em]">{children}</h1>
  );
}
