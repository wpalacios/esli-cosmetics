"use client";

import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";

import { Badge, Button, DataTable } from "@esli-cosmetics/ui";
import { Order } from "@/actions/orders";
import { CrossCircledIcon, CheckCircledIcon } from "@radix-ui/react-icons";
import { formatCurrency } from "@esli-cosmetics/utils";
import { TbReportMoney } from "react-icons/tb";
import { BiPrinter } from "react-icons/bi";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui";
import { useCurrentUser } from "@/hooks/use-auth";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface OrdersTableProps {
  orders: Order[];
  onView: (order: Order) => void;
  onAnnul: (order: Order) => void;
  onApprove?: (order: Order) => void;
  onExportPdf?: (order: Order) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

// Helper function to check if an order has overdue credit payments
function hasOverduePayments(order: Order): boolean {
  if (!order.credit || !order.credit.installments) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison

  return order.credit.installments.some(installment => {
    const dueDate = new Date(installment.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    // Check if installment is overdue:
    // 1. Due date is before or equal to today
    // 2. Not fully paid (paidAmount < amount or status is not PAID)
    const isPastDue = dueDate <= today;
    const isNotFullyPaid =
      installment.paidAmount < installment.amount ||
      installment.status !== "PAID";

    return isPastDue && isNotFullyPaid;
  });
}

export function OrdersTable({
  orders,
  onView,
  onAnnul,
  onApprove,
  onExportPdf,
  isLoading = false,
  pagination,
}: OrdersTableProps) {
  const { t } = useTranslation("orders");

  // Get current user for role-based access control
  const { data: userData } = useCurrentUser();
  // Roles can be either string[] or array of objects with key property
  const userRoles =
    userData?.roles?.map((r: any) =>
      typeof r === "string" ? r : r?.key || r
    ) || [];
  const isAdmin = userRoles.includes("admin");
  const isStoreManager = userRoles.includes("store_manager");
  const canManageOrders = isAdmin || isStoreManager;

  const columns: ColumnDef<Order, any>[] = [
    {
      id: "orderNumber",
      header: t("table.orderNumber"),
      cell: ({ row }) => {
        const order = row.original;
        const orderNumber = order.orderNumber;
        const hasOverdue = hasOverduePayments(order);

        return (
          <div className="flex items-center gap-2">
            <span
              className={`font-mono font-medium text-gray-900 dark:text-white ${hasOverdue ? "text-red-500" : "text-gray-900"}`}
            >
              {orderNumber}
            </span>
            {hasOverdue && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="h-3 w-3 rounded-full bg-red-500"
                      aria-label="Overdue payments"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {t("table.overduePayments") ||
                        "This order has overdue credit payments"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        );
      },
    },
    {
      id: "customer",
      header: t("table.customer"),
      cell: ({ row }) => {
        const customer = row.original.customer;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {customer?.name || t("table.walkIn")}
          </span>
        );
      },
    },
    {
      id: "status",
      header: t("table.status"),
      cell: ({ row }) => {
        const status = row.original.status || "COMPLETED";
        const getStatusConfig = () => {
          switch (status) {
            case "PENDING":
              return {
                label: t("table.pending"),
                className:
                  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
              };
            case "APPROVED":
              return {
                label: t("table.approved"),
                className:
                  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
              };
            case "COMPLETED":
              return {
                label: t("table.completed"),
                className:
                  "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
              };
            case "ANNULLED":
              return {
                label: t("table.annulled"),
                className:
                  "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
              };
            default:
              return {
                label: status,
                className:
                  "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
              };
          }
        };

        const statusConfig = getStatusConfig();
        return (
          <Badge
            variant={status === "ANNULLED" ? "error" : "primary"}
            className={statusConfig.className}
          >
            {statusConfig.label}
          </Badge>
        );
      },
    },
    {
      id: "totalAmount",
      header: t("table.totalAmount"),
      cell: ({ row }) => {
        const totalAmount = row.original.totalAmount;
        return (
          <span className="font-semibold text-gray-900 dark:text-white">
            {formatCurrency(totalAmount)}
          </span>
        );
      },
    },
    {
      id: "location",
      header: t("table.location"),
      cell: ({ row }) => {
        const location = row.original.location;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {location?.name || "N/A"}
          </span>
        );
      },
    },
    {
      id: "cashier",
      header: t("table.cashier"),
      cell: ({ row }) => {
        const cashier = row.original.cashier;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {cashier?.name || "N/A"}
          </span>
        );
      },
    },
    {
      id: "createdAt",
      header: t("table.createdAt"),
      cell: ({ row }) => {
        const value = row.original.createdAt;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {value ? new Date(value).toLocaleDateString() : "N/A"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: t("table.actions"),
      cell: ({ row }) => {
        const order = row.original;
        const status = order.status || "COMPLETED";
        const isAnnulled = status === "ANNULLED";
        const isPending = status === "PENDING";
        const isApproved = status === "APPROVED";
        const isCompleted = status === "COMPLETED";
        // Only allow annulling COMPLETED or APPROVED orders (not PENDING or ANNULLED)
        // APPROVED orders are credit orders that can be annulled
        // This includes both CASH and CREDIT orders
        const canAnnul = !isAnnulled && (isCompleted || isApproved);
        // Only allow approving PENDING orders
        const canApprove = isPending && onApprove;

        return (
          <div className="flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(order)}
                    className="h-8 w-8 p-0 hover:bg-blue-100"
                  >
                    <TbReportMoney className="h-4 w-4 text-blue-600" />
                    <span className="sr-only">{t("table.view")}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("table.viewTooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {onExportPdf && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onExportPdf(order)}
                      className="h-8 w-8 p-0 text-gray-500 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/20"
                      title={t("table.exportPdf")}
                    >
                      <BiPrinter className="h-4 w-4" />
                      <span className="sr-only">{t("table.exportPdf")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("table.exportPdf")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {canManageOrders && canApprove && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onApprove(order)}
                      className="h-8 w-8 p-0 hover:bg-green-100"
                    >
                      <CheckCircledIcon className="h-4 w-4 text-green-600" />
                      <span className="sr-only">{t("table.approve")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("table.approveTooltip") || "Approve order"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {canManageOrders && (isCompleted || isApproved) && !isAnnulled && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAnnul(order)}
                        disabled={!canAnnul}
                        className="h-8 w-8 p-0 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CrossCircledIcon className="h-4 w-4 text-red-600" />
                        <span className="sr-only">{t("table.annul")}</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {!canAnnul
                        ? !isCompleted && !isApproved
                          ? t("table.annulDisabledStatus") ||
                            "Only completed or approved orders can be annulled"
                          : t("table.annulTooltip")
                        : t("table.annulTooltip")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      data={orders}
      columns={columns}
      loading={isLoading}
      title={t("table.title")}
      empty={
        <div className="py-8 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            {t("table.noData")}
          </div>
        </div>
      }
      paginationLabels={{
        showing: t("pagination.showing"),
        of: t("pagination.of"),
        results: t("pagination.results"),
        previous: t("pagination.previous"),
        next: t("pagination.next"),
        page: t("pagination.page"),
        rowsPerPage: t("pagination.rowsPerPage"),
      }}
      {...(pagination && { pagination })}
    />
  );
}
