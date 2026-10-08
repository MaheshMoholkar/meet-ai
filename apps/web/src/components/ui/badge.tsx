import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/**
 * A small fact about a row or page ("3 meetings", "13m"). A chip, not a pill:
 * pills are reserved for meeting status, so a fact is never read as a state.
 */
const badgeVariants = cva(
  "group/badge focus-ring inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-2 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5!",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground [&>svg]:text-muted-foreground",
        secondary: "bg-secondary text-secondary-foreground [&>svg]:text-muted-foreground",
        destructive: "bg-destructive-soft text-destructive",
        outline: "border-border text-foreground [&>svg]:text-muted-foreground",
        ghost: "text-foreground hover:bg-accent",
        link: "text-agent-text underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
