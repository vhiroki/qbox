import { useState } from "react";
import { Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { QueryExecuteResult } from "../types";

interface QueryResultsProps {
  result: QueryExecuteResult | null;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onExport: () => void;
  isExporting: boolean;
}

export default function QueryResults({
  result,
  isLoading,
  error,
  onPageChange,
  onPageSizeChange,
  onExport,
  isExporting,
}: QueryResultsProps) {
  const [pageInput, setPageInput] = useState<string>("");

  const handlePageInputSubmit = () => {
    if (!result || !result.total_pages) return;
    
    const page = parseInt(pageInput, 10);
    if (page >= 1 && page <= result.total_pages) {
      onPageChange(page);
      setPageInput("");
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handlePageInputSubmit();
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Executing query...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No results yet</p>
          <p className="text-xs mt-1">Click "Run Query" to execute</p>
        </div>
      </div>
    );
  }

  if (!result.success || !result.columns || !result.rows) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {result.error || "Failed to execute query"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { columns, rows, total_rows, page, page_size, total_pages, execution_time_ms } = result;

  return (
    <div className="h-full flex flex-col border rounded-md bg-card">
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            {total_rows !== undefined && (
              <>{total_rows.toLocaleString()} total rows</>
            )}
          </span>
          {execution_time_ms !== undefined && (
            <span>• {execution_time_ms.toFixed(2)}ms</span>
          )}
        </div>
        <Button
          onClick={onExport}
          size="sm"
          variant="outline"
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-3 w-3 mr-2" />
              Export to CSV
            </>
          )}
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="sticky top-0 z-10 bg-card border-b" style={{ position: 'sticky', top: 0 }}>
            <tr className="border-b transition-colors">
              {columns.map((column) => (
                <th
                  key={column}
                  className="h-10 px-4 text-left align-middle font-semibold text-muted-foreground bg-card whitespace-nowrap"
                  title={column}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-b transition-colors hover:bg-muted/50">
                <td
                  colSpan={columns.length}
                  className="px-4 py-2 align-middle text-center text-muted-foreground h-24 whitespace-nowrap"
                >
                  No data returned
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  {columns.map((column) => (
                    <td 
                      key={`${rowIndex}-${column}`} 
                      className="px-4 py-2 align-middle whitespace-nowrap overflow-hidden text-ellipsis max-w-md"
                      title={row[column] !== null && row[column] !== undefined ? String(row[column]) : 'null'}
                    >
                      {row[column] !== null && row[column] !== undefined
                        ? String(row[column])
                        : <span className="text-muted-foreground italic">null</span>}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {total_pages !== undefined && (
        <div className="flex items-center justify-between px-4 py-3 border-t flex-shrink-0 bg-card">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Rows per page:</span>
            <Select
              value={String(page_size)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="250">250</SelectItem>
                <SelectItem value="500">500</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {total_pages > 1 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Page {page} of {total_pages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onPageChange(1)}
                  disabled={page === 1}
                  title="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page === 1}
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1 px-2">
                  <input
                    type="text"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={handlePageInputKeyDown}
                    onBlur={handlePageInputSubmit}
                    placeholder={String(page)}
                    className="w-12 h-8 text-center text-sm border rounded px-2 bg-background"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page === total_pages}
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onPageChange(total_pages)}
                  disabled={page === total_pages}
                  title="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              Showing all {rows.length} {rows.length === 1 ? "row" : "rows"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

