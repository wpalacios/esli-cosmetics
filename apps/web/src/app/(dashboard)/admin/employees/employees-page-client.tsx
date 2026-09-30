"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { EmployeeModal } from "@/components/modals/employee-modal";
import { EmployeesTable } from "@/components/tables/employees-table";
import {
  useCreateEmployee,
  useDeleteEmployee,
  useEmployees,
  useUpdateEmployee,
} from "@/hooks/use-employees";
import {
  EmployeeWithRelations,
  EmployeesResponse,
} from "@esli-cosmetics/types";
import { Button, SearchInput } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface EmployeesPageClientProps {
  initialData: EmployeesResponse;
}

export function EmployeesPageClient({ initialData }: EmployeesPageClientProps) {
  const { t } = useTranslation("employees");

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<
    EmployeeWithRelations | undefined
  >();
  const [viewingEmployee, setViewingEmployee] = useState<
    EmployeeWithRelations | undefined
  >();

  // Confirmation dialog hook
  const confirmationDialog = useConfirmationDialog();

  // Toast hook
  const { toast } = useToast();

  // React Query hooks
  const { data, isLoading, error, refetch } = useEmployees({
    page: currentPage,
    limit: pageSize,
    ...(activeSearchTerm && { search: activeSearchTerm }),
  });

  const createEmployeeMutation = useCreateEmployee();
  const updateEmployeeMutation = useUpdateEmployee();
  const deleteEmployeeMutation = useDeleteEmployee();

  // Event handlers
  const handleCreateEmployee = useCallback(() => {
    setEditingEmployee(undefined);
    setIsCreateModalOpen(true);
  }, []);

  const handleEditEmployee = useCallback((employee: EmployeeWithRelations) => {
    setEditingEmployee(employee);
    setIsCreateModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingEmployee(undefined);
  }, []);

  const handleSuccess = useCallback(
    (action: "create" | "update" | "delete", employeeName?: string) => {
      refetch();
      handleModalClose();

      // Show success toast
      const messages = {
        create: {
          title: t("toast.created"),
          description: t("toast.createdDesc", {
            name: employeeName || t("page.title"),
          }),
        },
        update: {
          title: t("toast.updated"),
          description: t("toast.updatedDesc", {
            name: employeeName || t("page.title"),
          }),
        },
        delete: {
          title: t("toast.deleted"),
          description: t("toast.deletedDesc", {
            name: employeeName || t("page.title"),
          }),
        },
      };

      toast({
        type: "success",
        title: messages[action].title,
        description: messages[action].description,
        duration: 5000,
      });
    },
    [refetch, handleModalClose, toast]
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setCurrentPage(1);
    },
    [setPageSize]
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setActiveSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  }, []);

  // Reset page when active search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTerm]);

  // Use initial data if no data from query yet
  const employeesData = data || initialData;

  const handleDeleteEmployee = useCallback(
    async (id: string) => {
      const employee = employeesData.employees?.find(emp => emp.id === id);
      const employeeName = employee
        ? `${employee.person?.firstName} ${employee.person?.lastName}`.trim()
        : "this employee";

      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: employeeName }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
        variant: "destructive",
      });

      if (confirmed) {
        try {
          await deleteEmployeeMutation.mutateAsync(id);
          handleSuccess("delete", employeeName);
        } catch (error) {
          console.error("Failed to delete employee:", error);
          toast({
            type: "error",
            title: t("toast.deleteFailed"),
            description: t("toast.deleteFailedDesc", { name: employeeName }),
            duration: 5000,
          });
        }
      }
    },
    [
      deleteEmployeeMutation,
      employeesData.employees,
      confirmationDialog,
      handleSuccess,
      toast,
    ]
  );

  // Use the correct data structure from EmployeesResponse
  const totalItems = employeesData.total ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  if (error) {
    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t("page.title")}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {t("page.subtitle")}
            </p>
          </div>
          <Button
            onClick={handleCreateEmployee}
            variant="primary"
            leftIcon={<PlusIcon className="h-4 w-4" />}
            className="w-full md:w-auto"
          >
            {t("page.addButton")}
          </Button>
        </div>

        {/* Error State */}
        <div className="sm:p-7.5 rounded-[10px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
          <div className="text-center">
            <div className="mb-4 text-red-600 dark:text-red-400">
              {t("page.error.loadFailed")}
            </div>
            <Button onClick={() => refetch()} variant="outline">
              {t("page.error.retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("page.title")}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("page.subtitle")}
          </p>
        </div>
        <Button
          onClick={handleCreateEmployee}
          variant="primary"
          leftIcon={<PlusIcon className="h-4 w-4" />}
          className="w-full md:w-auto"
        >
          {t("page.addButton")}
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative w-full flex-1 md:w-auto md:max-w-md">
          <SearchInput
            placeholder={t("page.searchPlaceholder")}
            value={searchTerm}
            onChange={handleSearchChange}
            onSearch={handleSearch}
            minLength={0}
          />
        </div>
      </div>

      {/* Employees Table */}
      <EmployeesTable
        data={employeesData.employees ?? []}
        onEdit={handleEditEmployee}
        onDelete={handleDeleteEmployee}
        isLoading={isLoading}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: handlePageChange,
          totalItems,
          pageSize,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions,
        }}
      />

      {/* Create/Edit Modal */}
      <EmployeeModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        employee={editingEmployee}
        onSuccess={(action, employeeName) =>
          handleSuccess(action, employeeName)
        }
      />

      {/* Confirmation Dialog */}
      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}
