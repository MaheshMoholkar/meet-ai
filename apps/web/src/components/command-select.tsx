"use client";

import { ChevronsUpDownIcon } from "lucide-react";
import { useState } from "react";

import { CommandResponsiveDialog } from "@/components/command-responsive-dialog";
import { Button } from "@/components/ui/button";
import { CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface CommandSelectOption {
  id: string;
  value: string;
  label: string;
  children: React.ReactNode;
}

interface Props {
  options: CommandSelectOption[];
  value: string;
  onSelect: (value: string) => void;
  onSearch?: (search: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  "aria-invalid"?: boolean;
}

/** A searchable select. With `onSearch`, filtering happens on the server instead of locally. */
export function CommandSelect({
  options,
  value,
  onSelect,
  onSearch,
  placeholder = "Select an option",
  className,
  id,
  "aria-invalid": ariaInvalid,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  const handleOpenChange = (next: boolean) => {
    onSearch?.("");
    setOpen(next);
  };

  return (
    <>
      <Button
        id={id}
        type="button"
        variant="outline"
        aria-invalid={ariaInvalid}
        onClick={() => handleOpenChange(true)}
        className={cn(
          "justify-between gap-2 pr-2 pl-3 font-normal",
          !selected && "text-muted-foreground",
          className,
        )}
      >
        <div className="truncate">{selected?.children ?? placeholder}</div>
        <ChevronsUpDownIcon className="text-muted-foreground" />
      </Button>
      <CommandResponsiveDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={placeholder}
        shouldFilter={!onSearch}
      >
        <CommandInput placeholder="Search..." onValueChange={onSearch} />
        <CommandList>
          <CommandEmpty>
            <span className="text-sm text-muted-foreground">No options found</span>
          </CommandEmpty>
          {options.map((option) => (
            <CommandItem
              key={option.id}
              value={option.label}
              onSelect={() => {
                onSelect(option.value);
                handleOpenChange(false);
              }}
            >
              {option.children}
            </CommandItem>
          ))}
        </CommandList>
      </CommandResponsiveDialog>
    </>
  );
}
