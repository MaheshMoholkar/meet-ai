"use client";

import { useCallback, useState } from "react";

import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";

/**
 * Promise-based confirmation: `if (!(await confirm())) return;`
 * Render the returned dialog element somewhere in the component.
 *
 * `confirmLabel` names what the final button does ("Delete meeting"); it is never "Confirm".
 */
export function useConfirm(title: string, description: string, confirmLabel: string) {
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    () => new Promise<boolean>((resolve) => setResolver(() => resolve)),
    [],
  );

  const settle = (value: boolean) => {
    resolver?.(value);
    setResolver(null);
  };

  const dialog = (
    <ResponsiveDialog
      open={resolver !== null}
      onOpenChange={(open) => !open && settle(false)}
      title={title}
      description={description}
    >
      <div className="flex w-full flex-col-reverse items-center justify-end gap-2 md:flex-row">
        <Button variant="outline" className="w-full md:w-auto" onClick={() => settle(false)}>
          Cancel
        </Button>
        <Button variant="danger" className="w-full md:w-auto" onClick={() => settle(true)}>
          {confirmLabel}
        </Button>
      </div>
    </ResponsiveDialog>
  );

  return [dialog, confirm] as const;
}
