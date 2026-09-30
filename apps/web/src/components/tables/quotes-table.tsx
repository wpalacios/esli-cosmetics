"use client";

import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";

import { Badge, Button, DataTable } from "@esli-cosmetics/ui";
import type { Quote } from "@esli-cosmetics/types";
import { formatCurrency } from "@esli-cosmetics/utils";
import {
  CrossCircledIcon,
  EyeOpenIcon,
  Pencil1Icon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { TbReportMoney } from "react-icons/tb";
import { BiPrinter } from "react-icons/bi";
import { useExportQuotePdf } from "~/hooks/use-quotes";
import { th } from "date-fns/locale";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface QuotesTableProps {
  quotes: Quote[];
  onView: (quote: Quote) => void;
  onEdit: (quote: Quote) => void;
  onAnnul: (quote: Quote) => void;
  onDelete: (quote: Quote) => void;
  onViewOrder?: (orderId: string) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

export function QuotesTable({
  quotes,
  onView,
  onEdit,
  onAnnul,
  onDelete,
  onViewOrder,
  isLoading = false,
  pagination,
}: QuotesTableProps) {
  const { t } = useTranslation("quotes");

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "DRAFT":
        return {
          label: t("table.draft") || "Draft",
          className:
            "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
        };
      case "APPROVED":
        return {
          label: t("table.approved") || "Approved",
          className:
            "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        };
      case "EXPIRED":
        return {
          label: t("table.expired") || "Expired",
          className:
            "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        };
      case "CONVERTED":
        return {
          label: t("table.converted") || "Converted",
          className:
            "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
        };
      case "ANNULLED":
        return {
          label: t("table.annulled") || "Annulled",
          className:
            "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        };
      default:
        return {
          label: status,
          className:
            "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
        };
    }
  };

  const exportQuotePdfMutation = useExportQuotePdf();

  // Function to download PDF file (avoids popup blockers)
  const downloadBase64Pdf = (fileName: string, base64String: string) => {
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  };

  // Export handler: triggers PDF export and downloads the file
  const handleExport = (quote: Quote) => {
    exportQuotePdfMutation.mutate(quote.id, {
      onSuccess: data => {
        downloadBase64Pdf(data.fileName, data.base64);
      },
      onError: err => {
        throw new Error("Error exporting quote PDF: " + err);
      },
    });
  };


  const columns: ColumnDef<Quote, any>[] = [
    {
      id: "quoteNumber",
      header: t("table.quoteNumber") || "Quote Number",
      cell: ({ row }) => {
        const quote = row.original;
        return (
          <span className="font-mono font-medium text-gray-900 dark:text-white">
            {quote.quoteNumber || `#${quote.id.slice(0, 8)}`}
          </span>
        );
      },
    },
    {
      id: "customer",
      header: t("table.customer") || "Customer",
      cell: ({ row }) => {
        const customer = row.original.customer;
        if (!customer) {
          return (
            <span className="text-gray-400 dark:text-gray-500">
              {t("table.walkIn") || "Walk-in"}
            </span>
          );
        }
        const person = customer.person;
        const name = person
          ? `${person.firstName || ""} ${person.lastName || ""}`.trim()
          : "Unknown";
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {name || "Unknown"}
          </span>
        );
      },
    },
    {
      id: "location",
      header: t("table.location") || "Location",
      cell: ({ row }) => {
        const location = row.original.location;
        if (!location) {
          return (
            <span className="text-gray-400 dark:text-gray-500">
              {t("table.noLocation") || "No location"}
            </span>
          );
        }
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {location.name || "Unknown"}
          </span>
        );
      },
    },
    {
      id: "status",
      header: t("table.status") || "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const config = getStatusConfig(status);
        return <Badge className={config.className}>{config.label}</Badge>;
      },
    },
    {
      id: "expiration",
      header: t("table.expiration") || "Expiration",
      cell: ({ row }) => {
        const quote = row.original;
        // Show expiration date only if quote has validUntil and is APPROVED or EXPIRED
        if (
          quote.validUntil &&
          (quote.status === "APPROVED" || quote.status === "EXPIRED")
        ) {
          return (
            <span className="text-gray-600 dark:text-gray-300">
              {new Date(quote.validUntil).toLocaleDateString()}
            </span>
          );
        }
        return null;
      },
    },
    {
      id: "totalAmount",
      header: t("table.total") || "Total",
      cell: ({ row }) => {
        const total = row.original.totalAmount || 0;
        return (
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(total)}
          </span>
        );
      },
    },
    {
      id: "items",
      header: t("table.items") || "Items",
      cell: ({ row }) => {
        const items = row.original.items || [];
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        );
      },
    },
    {
      id: "createdAt",
      header: t("table.createdAt") || "Created",
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {date.toLocaleDateString()}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: t("table.actions") || "Actions",
      cell: ({ row }) => {
        const quote = row.original;
        const isExpired = quote.status === "EXPIRED";
        const canEdit =
          !isExpired &&
          quote.status !== "CONVERTED" &&
          quote.status !== "ANNULLED";
        const canDelete =
          quote.status === "DRAFT" ||
          quote.status === "EXPIRED" ||
          quote.status === "ANNULLED";
        const isConverted = quote.status === "CONVERTED";
        const canAnnul =
          !isExpired &&
          (quote.status === "DRAFT" || quote.status === "APPROVED");
        const hasOrder =
          !isExpired && isConverted && quote.orderId && onViewOrder;

        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExport(quote)}
              className="h-8 w-8 p-0 text-gray-500 hover:bg-purple-50 hover:text-purple-600"
              title={t("table.exportPdf") || "Export PDF"}
              disabled={exportQuotePdfMutation.isPending}
            >
              <BiPrinter className="h-4 w-4" />
              <span className="sr-only">
                {t("table.exportPdf") || "Export PDF"}
              </span>
            </Button>
            {/* Actions if not Expired */}
            {!isExpired && (
              <>
                {hasOrder && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewOrder(quote.orderId!)}
                    className="h-8 w-8 p-0 hover:bg-blue-100"
                  >
                    <TbReportMoney className="h-4 w-4 text-blue-600" />
                    <span className="sr-only">
                      {t("table.viewOrder") || "View Order"}
                    </span>
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(quote)}
                    className="h-8 w-8 p-0 hover:bg-yellow-100"
                  >
                    <Pencil1Icon className="h-4 w-4 text-yellow-600" />
                    <span className="sr-only">{t("table.edit")}</span>
                  </Button>
                )}
                {canAnnul && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onAnnul(quote)}
                    className="h-8 w-8 p-0 hover:bg-red-100"
                    title={t("table.annul") || "Annul"}
                  >
                    <CrossCircledIcon className="h-4 w-4 text-red-600" />
                    <span className="sr-only">{t("table.annul")}</span>
                  </Button>
                )}
              </>
            )}
            {/* Delete if canDelete is true */}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(quote)}
                className="h-8 w-8 p-0 hover:bg-red-100"
              >
                <TrashIcon className="h-4 w-4 text-red-600" />
                <span className="sr-only">{t("table.delete")}</span>
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={quotes}
      loading={isLoading}
      empty={t("table.noData") || "No data available"}
      {...(pagination && {
        pagination,
        paginationLabels: {
          showing: t("table.showing") || "Showing",
          of: t("table.of") || "of",
          results: t("table.results") || "results",
          page: t("table.page") || "Page",
          previous: t("table.previous") || "Previous",
          next: t("table.next") || "Next",
          rowsPerPage: t("pagination.rowsPerPage"),
        },
      })}
    />
  );
}
