"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NewAgentDialog } from "@/modules/agents/ui/components/agent-dialogs";
import { useTRPC } from "@/trpc/client";

import { meetingsInsertSchema, type MeetingInsert } from "../../schemas";
import type { MeetingGetOne } from "../../types";
import { AgentSelect } from "./agent-select";

interface Props {
  initialValues?: MeetingGetOne;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

export function MeetingForm({ initialValues, onSuccess, onCancel }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const isEdit = Boolean(initialValues);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries(trpc.meetings.pathFilter()),
      // Agent rows show a meeting count.
      queryClient.invalidateQueries(trpc.agents.pathFilter()),
    ]);

  const createMeeting = useMutation(
    trpc.meetings.create.mutationOptions({
      onSuccess: async (meeting) => {
        await invalidate();
        onSuccess?.(meeting.id);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const updateMeeting = useMutation(
    trpc.meetings.update.mutationOptions({
      onSuccess: async (meeting) => {
        await invalidate();
        onSuccess?.(meeting.id);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const form = useForm<MeetingInsert>({
    resolver: zodResolver(meetingsInsertSchema),
    defaultValues: {
      name: initialValues?.name ?? "",
      agentId: initialValues?.agentId ?? "",
    },
  });

  const isPending = createMeeting.isPending || updateMeeting.isPending;

  const onSubmit = (values: MeetingInsert) => {
    if (initialValues) {
      updateMeeting.mutate({ ...values, id: initialValues.id });
    } else {
      createMeeting.mutate(values);
    }
  };

  return (
    <>
      <NewAgentDialog open={newAgentOpen} onOpenChange={setNewAgentOpen} />
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="meeting-name">Name</FieldLabel>
                <Input
                  {...field}
                  id="meeting-name"
                  placeholder="e.g. Algebra practice"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="agentId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="meeting-agent">Agent</FieldLabel>
                <AgentSelect
                  id="meeting-agent"
                  value={field.value}
                  onSelect={field.onChange}
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription>
                  Not finding the right one?{" "}
                  <button
                    type="button"
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => setNewAgentOpen(true)}
                  >
                    Create a new agent
                  </button>
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <div className="flex justify-between gap-x-2">
            {onCancel && (
              <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isPending} className="ml-auto">
              {isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </>
  );
}
