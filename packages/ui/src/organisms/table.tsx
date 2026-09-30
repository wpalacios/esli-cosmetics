import React, { forwardRef, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";

// Simple arrow components for pagination
const ChevronLeft = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 19l-7-7 7-7"
    />
  </svg>
);

const ChevronRight = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </svg>
);

import { cn } from "@esli-cosmetics/utils";
import { Badge } from "../atoms/badge";
import { Button } from "../atoms/button";

// Shared page-size selector defaults so consumers can reuse the same set.
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;
const DEFAULT_PAGE_SIZE = 10;

type DataTablePagination = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  // Actual page size used for the "showing X to Y" math. Defaults to 10.
  pageSize?: number;
  // When provided, the page-size selector is rendered.
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
};

// DataTable props that support TanStack Table
type TableProps<T = unknown> = {
  data: T[];
  columns: ColumnDef<T, any>[];
  loading?: boolean;
  empty?: React.ReactNode;
  onRowClick?: (item: T, index: number) => void;
  selectedRows?: T[];
  onSelectionChange?: (selected: T[]) => void;
  pagination?: DataTablePagination;
  // Enables internal TanStack pagination (with the same footer + page-size
  // selector) when no server-side `pagination` prop is provided.
  clientPagination?:
    | boolean
    | { pageSize?: number; pageSizeOptions?: number[] };
  paginationLabels?: {
    showing?: string;
    of?: string;
    results?: string;
    previous?: string;
    next?: string;
    page?: string;
    rowsPerPage?: string;
  };
  className?: string;
  title?: string;
  showTitle?: boolean;
};

const Table = forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-neutral-100/50 font-medium [&>tr]:last:border-b-0 dark:bg-neutral-800/50",
      className
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & {
    clickable?: boolean;
  }
>(({ className, clickable, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-neutral-100/50 data-[state=selected]:bg-neutral-100 dark:hover:bg-neutral-800/50 dark:data-[state=selected]:bg-neutral-800",
      clickable && "cursor-pointer",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-2 text-left align-middle font-medium text-neutral-500 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] dark:text-neutral-400",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn(
      "mt-4 text-sm text-neutral-500 dark:text-neutral-400",
      className
    )}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

// DataTable with TanStack Table support
function DataTable<T>({
  data,
  columns,
  loading,
  empty,
  onRowClick,
  selectedRows = [],
  onSelectionChange,
  pagination,
  clientPagination,
  paginationLabels,
  className,
  title,
  showTitle = true,
}: TableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState({});

  // Client-side pagination is active only when explicitly enabled and there is
  // no server-side `pagination` prop driving the data.
  const clientPaginationEnabled = Boolean(clientPagination) && !pagination;
  const clientPaginationConfig =
    typeof clientPagination === "object" ? clientPagination : {};
  const clientPageSizeOptions = clientPaginationConfig.pageSizeOptions ?? [
    ...PAGE_SIZE_OPTIONS,
  ];
  const initialClientPageSize =
    clientPaginationConfig.pageSize ??
    clientPageSizeOptions[0] ??
    DEFAULT_PAGE_SIZE;

  const [clientPageIndex, setClientPageIndex] = useState(0);
  const [clientPageSize, setClientPageSize] = useState(initialClientPageSize);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    ...(clientPaginationEnabled
      ? {}
      : {
          initialState: {
            pagination: {
              // Show all rows when data is already paginated server-side or
              // when no client pagination is used. TanStack Table defaults to
              // pageSize: 10, which would hide rows 11+.
              pageSize: 1000,
            },
          },
        }),
    state: {
      sorting,
      columnFilters,
      rowSelection,
      ...(clientPaginationEnabled && {
        pagination: {
          pageIndex: clientPageIndex,
          pageSize: clientPageSize,
        },
      }),
    },
  });

  // Build a normalized pagination descriptor that drives the footer for both
  // server-side and client-side modes.
  const effectivePagination = pagination
    ? {
        currentPage: pagination.currentPage,
        totalPages: pagination.totalPages,
        totalItems: pagination.totalItems,
        pageSize: pagination.pageSize ?? DEFAULT_PAGE_SIZE,
        onPageChange: pagination.onPageChange,
        onPageSizeChange: pagination.onPageSizeChange,
        pageSizeOptions: pagination.pageSizeOptions ?? [...PAGE_SIZE_OPTIONS],
      }
    : clientPaginationEnabled
      ? {
          currentPage: clientPageIndex + 1,
          totalPages: Math.max(1, table.getPageCount()),
          totalItems: table.getFilteredRowModel().rows.length,
          pageSize: clientPageSize,
          onPageChange: (page: number) => setClientPageIndex(page - 1),
          onPageSizeChange: (size: number) => {
            setClientPageSize(size);
            setClientPageIndex(0);
          },
          pageSizeOptions: clientPageSizeOptions,
        }
      : null;

  if (loading) {
    return (
      <div className="rounded-[10px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none sm:p-7.5">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-gray-200 dark:bg-gray-700 rounded"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[10px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none sm:p-7.5",
        className
      )}
    >
      {showTitle && title && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-black dark:text-white">
            {title}
          </h2>
        </div>
      )}

      {/* Desktop Table View - Hidden on mobile */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup: any) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header: any) => (
                  <TableHead key={header.id} className="text-xs sm:text-sm">
                    {header.isPlaceholder
                      ? null
                      : (flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        ) as any)}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row: any) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-gray-800"
                  onClick={() => onRowClick?.(row.original, row.index)}
                >
                  {row.getVisibleCells().map((cell: any) => (
                    <TableCell key={cell.id} className="text-xs sm:text-sm">
                      {
                        flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        ) as any
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {empty || "No hay datos disponibles"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View - Shown on mobile only */}
      <div className="md:hidden space-y-3">
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row: any) => {
            const cells = row.getVisibleCells();
            const headers = table.getHeaderGroups()[0]?.headers || [];

            const cardContent = (
              <div className="space-y-3">
                {cells.map((cell: any, index: number) => {
                  const header = headers[index];
                  if (!header || header.isPlaceholder) return null;

                  const headerContent = flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  );

                  // Skip rendering if header is empty/null
                  if (!headerContent) return null;

                  // Check if this is an actions column
                  const isActionsColumn =
                    cell.column.id === "actions" ||
                    cell.column.id === "__actions";

                  return (
                    <div
                      key={cell.id}
                      className={cn(
                        "flex flex-col gap-1",
                        isActionsColumn && "items-end"
                      )}
                    >
                      <div
                        className={cn(
                          "text-xs font-semibold text-neutral-900 dark:text-neutral-400 uppercase",
                          isActionsColumn && "text-right"
                        )}
                      >
                        {headerContent as any}
                      </div>
                      <div
                        className={cn(
                          "text-sm text-neutral-900 dark:text-neutral-100",
                          isActionsColumn && "flex justify-end"
                        )}
                      >
                        {
                          flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          ) as any
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            );

            const cardClassName = cn(
              "rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm",
              "transition-all hover:shadow-md w-full text-left",
              onRowClick &&
                "cursor-pointer hover:bg-primary-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400",
              row.getIsSelected() &&
                "ring-2 ring-primary-500 dark:ring-primary-400"
            );

            return onRowClick ? (
              <button
                key={row.id}
                type="button"
                onClick={() => onRowClick(row.original, row.index)}
                className={cardClassName}
              >
                {cardContent}
              </button>
            ) : (
              <div key={row.id} className={cardClassName}>
                {cardContent}
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
            {empty || "No hay datos disponibles"}
          </div>
        )}
      </div>

      {/* Pagination */}
      {effectivePagination && (
        <div className="flex flex-col space-y-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:space-x-2">
          {/* Results info - hidden on mobile, shown on desktop */}
          <div className="hidden text-sm text-muted-foreground sm:block sm:flex-1">
            {paginationLabels?.showing || "Mostrando"}{" "}
            {effectivePagination.totalItems === 0
              ? 0
              : (effectivePagination.currentPage - 1) *
                  effectivePagination.pageSize +
                1}{" "}
            a{" "}
            {Math.min(
              effectivePagination.currentPage * effectivePagination.pageSize,
              effectivePagination.totalItems
            )}{" "}
            {paginationLabels?.of || "de"} {effectivePagination.totalItems}{" "}
            {paginationLabels?.results || "resultados"}
          </div>

          {/* Mobile results info - shown on mobile only */}
          <div className="text-center text-sm text-muted-foreground sm:hidden">
            {paginationLabels?.page || "Página"}{" "}
            {effectivePagination.currentPage} {paginationLabels?.of || "de"}{" "}
            {effectivePagination.totalPages}
          </div>

          {/* Page-size selector + navigation controls */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-2">
            {effectivePagination.onPageSizeChange && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {paginationLabels?.rowsPerPage || "Filas por página"}
                </span>
                <select
                  value={effectivePagination.pageSize}
                  onChange={event =>
                    effectivePagination.onPageSizeChange?.(
                      Number(event.target.value)
                    )
                  }
                  className="border-gray-200 dark:border-gray-700 dark:bg-gray-800 h-8 rounded-md border bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-300 dark:focus:ring-primary-400"
                >
                  {effectivePagination.pageSizeOptions.map(size => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  effectivePagination.onPageChange(
                    effectivePagination.currentPage - 1
                  )
                }
                disabled={effectivePagination.currentPage <= 1}
                className="flex items-center space-x-1"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {paginationLabels?.previous || "Anterior"}
                </span>
              </Button>

              {/* Desktop page indicator - hidden on mobile */}
              <span className="hidden text-sm text-gray-600 dark:text-gray-400 sm:inline">
                {paginationLabels?.page || "Página"}{" "}
                {effectivePagination.currentPage} {paginationLabels?.of || "de"}{" "}
                {effectivePagination.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  effectivePagination.onPageChange(
                    effectivePagination.currentPage + 1
                  )
                }
                disabled={
                  effectivePagination.currentPage >=
                  effectivePagination.totalPages
                }
                className="flex items-center space-x-1"
              >
                <span className="hidden sm:inline">
                  {paginationLabels?.next || "Siguiente"}
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  DataTable,
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
};
export type { TableProps, DataTablePagination };
