"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";

import { CustomerWithRelations } from "@esli-cosmetics/types";
import { Badge, Button, DataTable } from "@esli-cosmetics/ui";
import { formatCurrencyValue, CURRENCY_SIGN } from "@esli-cosmetics/utils";
import { FileTextIcon, Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { BiCreditCard } from "react-icons/bi";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface CustomersTableProps {
  customers: CustomerWithRelations[];
  onEdit: (customer: CustomerWithRelations) => void;
  onDelete: (customer: CustomerWithRelations) => void;
  onView: (customer: CustomerWithRelations) => void;
  onViewStatement?: (customer: CustomerWithRelations) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

export function CustomersTable({
  customers,
  onEdit,
  onDelete,
  onView,
  onViewStatement,
  isLoading = false,
  pagination,
}: CustomersTableProps) {
  const { t } = useTranslation("customers");

  const columns: ColumnDef<CustomerWithRelations, any>[] = [
    {
      id: "customer",
      header: t("table.customer"),
      cell: ({ row }) => {
        const customer = row.original;
        const person = customer.person;
        const customerName = person
          ? `${person.firstName} ${person.lastName || ""}`.trim()
          : "N/A";
        return (
          <div className="flex max-w-24 flex-wrap items-center gap-2 text-wrap">
            <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
              {customerName}
            </div>
            {customer.creditAllowed && (
              <>
                <BiCreditCard
                  className="h-4 w-4 text-primary-500 dark:text-primary-400"
                  title="Credit allowed"
                />
                {formatCurrencyValue(customer.creditLimit || 0)}
              </>
            )}
          </div>
        );
      },
    },
    {
      id: "customerType",
      header: () => (
        <div className="whitespace-nowrap">{t("table.customerType")}</div>
      ),
      cell: ({ row }) => {
        const customerType = row.original.customerType;
        if (!customerType) {
          return (
            <span className="text-sm text-gray-500 dark:text-gray-400">—</span>
          );
        }

        return (
          <Badge
            variant={customerType.isActive ? "success" : "secondary"}
            className="text-xs"
          >
            {customerType.name}
          </Badge>
        );
      },
    },
    {
      id: "priceTypes",
      header: () => (
        <div className="whitespace-nowrap">{t("table.priceTypes")}</div>
      ),
      cell: ({ row }) => {
        const priceTypes = row.original.priceTypes;
        if (
          !priceTypes ||
          !Array.isArray(priceTypes) ||
          priceTypes.length === 0
        ) {
          return (
            <span className="text-sm text-gray-500 dark:text-gray-400">—</span>
          );
        }

        return (
          <div className="min-w-[120px] space-y-1">
            {priceTypes.slice(0, 2).map((priceType, index) => (
              <div key={index} className="text-xs">
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {priceType.name}
                </span>
                <span className="ml-1 text-gray-500 dark:text-gray-400">
                  (Min: {priceType.minQuantity})
                </span>
              </div>
            ))}
            {priceTypes.length > 2 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                +{priceTypes.length - 2} {t("table.more")}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "phone",
      header: t("table.phone"),
      cell: ({ row }) => {
        const value = row.original.person?.phone;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {value || t("table.noPhone")}
          </span>
        );
      },
    },
    {
      id: "city",
      header: t("table.city"),
      cell: ({ row }) => {
        const value = row.original.defaultBillingAddress?.city;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {value || "—"}
          </span>
        );
      },
    },
    {
      id: "id",
      header: t("table.id"),
      cell: ({ row }) => {
        const value = row.original.person?.docNumber;

        return (
          <span className="font-mono text-sm text-gray-600 dark:text-gray-300">
            {value || "N/A"}
          </span>
        );
      },
    },
    {
      id: "discountCodes",
      header: t("table.discountCodes"),
      cell: ({ row }) => {
        const discountCodes = row.original.discountCodes;
        if (
          !discountCodes ||
          !Array.isArray(discountCodes) ||
          discountCodes.length === 0
        ) {
          return (
            <span className="text-sm text-gray-500 dark:text-gray-400">—</span>
          );
        }

        return (
          <div className="min-w-[120px] space-y-1">
            {discountCodes.slice(0, 2).map((dc, index) => (
              <div key={index} className="text-xs">
                <span className="font-medium text-pink-600 dark:text-pink-400">
                  {dc.discountCode.code}
                </span>
                <span className="ml-1 text-gray-500 dark:text-gray-400">
                  (
                  {dc.discountCode.discountType === "PERCENTAGE"
                    ? `${dc.discountCode.value}%`
                    : `${CURRENCY_SIGN}${dc.discountCode.value}`}
                  )
                </span>
              </div>
            ))}
            {discountCodes.length > 2 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                +{discountCodes.length - 2} {t("table.more")}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "created",
      header: t("table.created"),
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
        const customer = row.original;
        return (
          <div className="flex items-center space-x-2">
            {onViewStatement && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewStatement(customer)}
                className="h-8 w-8 p-0 hover:bg-blue-100"
                title="View Statement"
              >
                <FileTextIcon className="h-4 w-4 text-blue-600" />
                <span className="sr-only">View Statement</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(customer)}
              className="h-8 w-8 p-0 hover:bg-yellow-100"
            >
              <Pencil1Icon className="h-4 w-4 text-yellow-600" />
              <span className="sr-only">{t("table.edit")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(customer)}
              className="h-8 w-8 p-0 hover:bg-red-100"
            >
              <TrashIcon className="h-4 w-4 text-red-600" />
              <span className="sr-only">{t("table.delete")}</span>
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      data={customers}
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
