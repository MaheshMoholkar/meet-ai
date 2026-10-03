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
    <ResponsiveDialog title="New agent" description="Create a new agent" open={open} onOpenChange={onOpenChange}>
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
    <ResponsiveDialog title="Edit agent" description="Edit the agent details" open={open} onOpenChange={onOpenChange}>
      <AgentForm
        initialValues={initialValues}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
      />
    </ResponsiveDialog>
  );
}
