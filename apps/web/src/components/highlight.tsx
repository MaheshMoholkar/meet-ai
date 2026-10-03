const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Wraps case-insensitive matches of `query` in <mark>. Replaces react-highlight-words. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;

  const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, "gi"));

  return (
    <>
      {parts.map((part, index) =>
        // With a capturing group, odd indexes are the matches.
        index % 2 === 1 ? (
          <mark key={index} className="rounded-sm bg-yellow-200 text-inherit">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
