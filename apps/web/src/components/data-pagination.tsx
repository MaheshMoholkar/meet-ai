import { Button } from "@/components/ui/button";

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function DataPagination({ page, totalPages, onPageChange }: Props) {
  const lastPage = Math.max(totalPages, 1);

  return (
    <div className="flex items-center justify-between px-2 py-3">
      <p className="text-xs font-medium text-muted-foreground">
        Page {page} of {lastPage}
      </p>
      <div className="flex items-center gap-x-2">
        <Button
          disabled={page <= 1}
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <Button
          disabled={page >= lastPage}
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(lastPage, page + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
