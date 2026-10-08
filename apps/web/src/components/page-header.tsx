interface Props {
  title: string;
  /** Shown before the title: an agent's avatar on its page. */
  leading?: React.ReactNode;
  /** A row under the title: the agent, the date, the duration, the status. */
  meta?: React.ReactNode;
  /** One button: ink on list pages, the call button on a meeting that can be started or joined. */
  action?: React.ReactNode;
}

/** The title of a page and the one thing you can do on it. */
export function PageHeader({ title, leading, meta, action }: Props) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="min-w-0">
          <h1 className="font-heading text-2xl leading-[30px] font-semibold tracking-[-0.015em] wrap-break-word">
            {title}
          </h1>
          {meta && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] leading-[18px] text-muted-foreground">
              {meta}
            </div>
          )}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}
