"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/trpc/client";

import { agentsInsertSchema, type AgentInsert } from "../../schemas";
import type { AgentGetOne } from "../../types";

interface Props {
  initialValues?: AgentGetOne;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

export function AgentForm({ initialValues, onSuccess, onCancel }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isEdit = Boolean(initialValues);

  const invalidate = () => queryClient.invalidateQueries(trpc.agents.pathFilter());

  const createAgent = useMutation(
    trpc.agents.create.mutationOptions({
      onSuccess: async (agent) => {
        await invalidate();
        onSuccess?.(agent.id);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const updateAgent = useMutation(
    trpc.agents.update.mutationOptions({
      onSuccess: async (agent) => {
        // Meeting rows show the agent's name.
        await Promise.all([invalidate(), queryClient.invalidateQueries(trpc.meetings.pathFilter())]);
        onSuccess?.(agent.id);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const form = useForm<AgentInsert>({
    resolver: zodResolver(agentsInsertSchema),
    defaultValues: {
      name: initialValues?.name ?? "",
      instructions: initialValues?.instructions ?? "",
    },
  });
  const name = useWatch({ control: form.control, name: "name" });

  const isPending = createAgent.isPending || updateAgent.isPending;

  const onSubmit = (values: AgentInsert) => {
    if (initialValues) {
      updateAgent.mutate({ ...values, id: initialValues.id });
    } else {
      createAgent.mutate(values);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <GeneratedAvatar seed={name || "agent"} variant="botttsNeutral" className="size-16" />
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="agent-name">Name</FieldLabel>
              <Input
                {...field}
                id="agent-name"
                placeholder="e.g. Math tutor"
                aria-invalid={fieldState.invalid}
                className="h-10"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="instructions"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="agent-instructions">Instructions</FieldLabel>
              <Textarea
                {...field}
                id="agent-instructions"
                rows={5}
                placeholder="You are a patient math tutor. Explain step by step and check understanding."
                aria-invalid={fieldState.invalid}
              />
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
  );
}
