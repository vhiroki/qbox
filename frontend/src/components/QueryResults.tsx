import { Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertCircle, Loader2, MoreHorizontal } from "lucide-react";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import type { QueryExecuteResult } from "../types";

interface QueryResultsProps {
  result: QueryExecuteResult | null;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onExport: () => void;
  isExporting: boolean;
  onFixWithAI?: (error: string) => void;
}

export default function QueryResults({
  result,
  isLoading,
  error,
  onPageChange,
  onPageSizeChange,
  onExport,
  isExporting,
  onFixWithAI,
}: QueryResultsProps) {

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
          <AlertDescription className="flex items-start justify-between gap-3">
            <span className="flex-1">{error}</span>
            {onFixWithAI && (
              <Button
                onClick={() => onFixWithAI(error)}
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs flex-shrink-0"
              >
                Fix with AI
              </Button>
            )}
          </AlertDescription>
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
    const resultError = result.error || "Failed to execute query";
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-start justify-between gap-3">
            <span className="flex-1">{resultError}</span>
            {onFixWithAI && (
              <Button
                onClick={() => onFixWithAI(resultError)}
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs flex-shrink-0"
              >
                Fix with AI
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { columns, rows, total_rows, page, page_size, total_pages, execution_time_ms } = result;

  return (
    <div className="h-full flex flex-col border rounded-md bg-card">
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between px-2 py-1 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {total_rows !== undefined && (
            <span>{total_rows.toLocaleString()} rows</span>
          )}
          {execution_time_ms !== undefined && (
            <span>• {execution_time_ms.toFixed(1)}ms</span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <MoreHorizontal className="h-3.5 w-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExport} disabled={isExporting}>
              <Download className="h-3.5 w-3.5 mr-2" />
              Export to CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full caption-bottom text-xs">
          <thead className="sticky top-0 z-10 bg-card border-b" style={{ position: 'sticky', top: 0 }}>
            <tr className="border-b transition-colors">
              {columns.map((column) => (
                <th
                  key={column}
                  className="h-7 px-2 text-left align-middle font-semibold text-muted-foreground bg-card whitespace-nowrap"
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
                  className="px-2 py-1 align-middle text-center text-muted-foreground h-16 whitespace-nowrap"
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
                      className="px-2 py-1 align-middle whitespace-nowrap overflow-hidden text-ellipsis max-w-md"
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
        <div className="flex items-center justify-between px-2.5 py-1 border-t flex-shrink-0 bg-card">
          <Select
            value={String(page_size)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger size="xs" className="w-[54px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50" className="text-xs py-0.5">50</SelectItem>
              <SelectItem value="100" className="text-xs py-0.5">100</SelectItem>
              <SelectItem value="250" className="text-xs py-0.5">250</SelectItem>
              <SelectItem value="500" className="text-xs py-0.5">500</SelectItem>
              <SelectItem value="1000" className="text-xs py-0.5">1000</SelectItem>
            </SelectContent>
          </Select>

          {total_pages > 1 ? (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground">
                {page}/{total_pages}
              </span>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => onPageChange(1)}
                  disabled={page === 1}
                  title="First page"
                >
                  <ChevronsLeft className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page === 1}
                  title="Previous page"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page === total_pages}
                  title="Next page"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => onPageChange(total_pages)}
                  disabled={page === total_pages}
                  title="Last page"
                >
                  <ChevronsRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              {rows.length} {rows.length === 1 ? "row" : "rows"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

