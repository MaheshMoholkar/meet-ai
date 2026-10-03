"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

/** A search box that updates the URL after the user pauses typing. */
export function SearchFilter({ value, onChange, placeholder }: Props) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const [emitted, setEmitted] = useState(value);

  // Follow external changes (for example "Clear"), but never overwrite what the
  // user kept typing after the value we emitted ourselves.
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== emitted) setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const timeout = setTimeout(() => {
      setEmitted(draft);
      onChange(draft);
    }, 300);
    return () => clearTimeout(timeout);
  }, [draft, value, onChange]);

  return (
    <div className="relative">
      <Input
        placeholder={placeholder}
        className="h-9 w-50 bg-background pl-7"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-label={placeholder}
      />
      <SearchIcon className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
