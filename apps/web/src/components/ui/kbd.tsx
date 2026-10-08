import { cn } from "cn"

/** A keyboard key, shown wherever a shortcut exists. Set in the text face, not a monospace. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-sm border bg-muted px-[5px] font-sans text-[11px] leading-4 font-semibold text-muted-foreground select-none",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
