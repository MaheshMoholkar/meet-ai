"use client";

import { ResponsiveDialog } from "@/components/responsive-dialog";

import type { AgentGetOne } from "../../types";
import { AgentForm } from "./agent-form";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewAgentDialog({ open, onOpenChange }: DialogProps) {
  return (
    <ResponsiveDialog title="New agent" description="An agent is the AI you'll talk to in meetings." open={open} onOpenChange={onOpenChange}>
      <AgentForm onSuccess={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
    </ResponsiveDialog>
  );
}

export function UpdateAgentDialog({
  open,
  onOpenChange,
  initialValues,
}: DialogProps & { initialValues: AgentGetOne }) {
  return (
    <ResponsiveDialog title="Edit agent" description="Changes apply to its future meetings." open={open} onOpenChange={onOpenChange}>
      <AgentForm
        initialValues={initialValues}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
      />
    </ResponsiveDialog>
  );
}
