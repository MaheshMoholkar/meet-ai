"use client";

import { useRouter } from "next/navigation";

import { ResponsiveDialog } from "@/components/responsive-dialog";

import type { MeetingGetOne } from "../../types";
import { MeetingForm } from "./meeting-form";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewMeetingDialog({ open, onOpenChange }: DialogProps) {
  const router = useRouter();

  return (
    <ResponsiveDialog title="New meeting" description="A meeting is a voice call with one of your agents." open={open} onOpenChange={onOpenChange}>
      <MeetingForm
        onSuccess={(id) => {
          onOpenChange(false);
          router.push(`/meetings/${id}`);
        }}
        onCancel={() => onOpenChange(false)}
      />
    </ResponsiveDialog>
  );
}

export function UpdateMeetingDialog({
  open,
  onOpenChange,
  initialValues,
}: DialogProps & { initialValues: MeetingGetOne }) {
  return (
    <ResponsiveDialog title="Edit meeting" description="Rename it or choose a different agent." open={open} onOpenChange={onOpenChange}>
      <MeetingForm
        initialValues={initialValues}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
      />
    </ResponsiveDialog>
  );
}
