"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import {
  Button,
  Input,
  Label,
  Checkbox,
  SearchableSelect,
} from "@esli-cosmetics/ui";
import type { SearchableSelectOption } from "@esli-cosmetics/ui";
import {
  EmployeeWithRelations,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
} from "@esli-cosmetics/types";
import {
  useCreateEmployee,
  useUpdateEmployee,
  useCheckEmployeeCode,
  useCheckDocumentNumber,
  useCheckEmail,
} from "@/hooks/use-employees";
import { LocationSelect } from "@/components/ui/location-select";
import { getErrorStatus } from "@/lib/errors/api-error";

const employeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  docType: z.string().optional(),
  docNumber: z.string().optional(),
  employeeCode: z.string().optional(),
  roleTitle: z.string().optional(),
  locationId: z.string().optional(),
  isActive: z.boolean().default(true),
  hiredAt: z.string().optional(),
  userId: z.string().optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface EmployeeFormProps {
  employee?: EmployeeWithRelations | undefined;
  onSuccess?: (action: "create" | "update", employeeName: string) => void;
  onCancel?: () => void;
}

export function EmployeeForm({
  employee,
  onSuccess,
  onCancel,
}: EmployeeFormProps) {
  const { t } = useTranslation("employees");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createEmployeeMutation = useCreateEmployee();
  const updateEmployeeMutation = useUpdateEmployee();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
    setError,
    clearErrors,
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: employee?.person?.firstName || "",
      lastName: employee?.person?.lastName || "",
      phone: employee?.person?.phone || "",
      email: employee?.person?.email || "",
      docType: employee?.person?.docType || "",
      docNumber: employee?.person?.docNumber || "",
      employeeCode: employee?.employeeCode || "",
      roleTitle: employee?.roleTitle || "",
      locationId: employee?.locationId || "",
      isActive: employee?.isActive ?? true,
      hiredAt: employee?.hiredAt
        ? new Date(employee.hiredAt).toISOString().split("T")[0]
        : "",
      userId: employee?.userId || "",
    },
  });

  const watchedEmployeeCode = watch("employeeCode");
  const watchedEmail = watch("email");
  const watchedDocType = watch("docType");
  const watchedDocNumber = watch("docNumber");

  // Check for duplicate employee codes using API
  const { data: codeExists, isLoading: isCheckingCode } = useCheckEmployeeCode(
    watchedEmployeeCode || "",
    employee?.id
  );

  // Check for duplicate emails using API
  const { data: emailExists, isLoading: isCheckingEmail } = useCheckEmail(
    watchedEmail || "",
    employee?.id
  );

  // Document type options
  const docTypeOptions: SearchableSelectOption[] = [
    { value: "PASSPORT", label: t("form.docTypePassport") },
    { value: "ID", label: t("form.docTypeId") },
  ];

  // Check for duplicate document numbers using API
  const { data: documentExists, isLoading: isCheckingDocument } =
    useCheckDocumentNumber(
      watchedDocType || "",
      watchedDocNumber || "",
      employee?.id
    );

  // Set form errors for duplicate checks
  useEffect(() => {
    if (
      codeExists &&
      watchedEmployeeCode &&
      watchedEmployeeCode.trim().length > 0
    ) {
      setError("employeeCode", {
        type: "manual",
        message: t("form.duplicateCodeError"),
      });
    } else if (
      !codeExists &&
      watchedEmployeeCode &&
      watchedEmployeeCode.trim().length > 0 &&
      !isCheckingCode
    ) {
      clearErrors("employeeCode");
    }
  }, [
    codeExists,
    watchedEmployeeCode,
    isCheckingCode,
    setError,
    clearErrors,
    t,
  ]);

  useEffect(() => {
    if (emailExists && watchedEmail && watchedEmail.trim().length > 0) {
      setError("email", {
        type: "manual",
        message: t("form.duplicateEmailError"),
      });
    } else if (
      !emailExists &&
      watchedEmail &&
      watchedEmail.trim().length > 0 &&
      !isCheckingEmail
    ) {
      clearErrors("email");
    }
  }, [emailExists, watchedEmail, isCheckingEmail, setError, clearErrors, t]);

  useEffect(() => {
    if (
      documentExists &&
      watchedDocType &&
      watchedDocNumber &&
      watchedDocType.trim().length > 0 &&
      watchedDocNumber.trim().length > 0
    ) {
      setError("docNumber", {
        type: "manual",
        message: t("form.duplicateDocumentError"),
      });
    } else if (
      !documentExists &&
      watchedDocType &&
      watchedDocNumber &&
      watchedDocType.trim().length > 0 &&
      watchedDocNumber.trim().length > 0 &&
      !isCheckingDocument
    ) {
      clearErrors("docNumber");
    }
  }, [
    documentExists,
    watchedDocType,
    watchedDocNumber,
    isCheckingDocument,
    setError,
    clearErrors,
    t,
  ]);

  // Update form values when employee prop changes
  useEffect(() => {
    if (employee) {
      reset({
        firstName: employee.person?.firstName || "",
        lastName: employee.person?.lastName || "",
        phone: employee.person?.phone || "",
        email: employee.person?.email || "",
        docType: employee.person?.docType || "",
        docNumber: employee.person?.docNumber || "",
        employeeCode: employee.employeeCode || "",
        roleTitle: employee.roleTitle || "",
        locationId: employee.locationId || "",
        isActive: employee.isActive ?? true,
        hiredAt: employee.hiredAt
          ? new Date(employee.hiredAt).toISOString().split("T")[0]
          : "",
        userId: employee.userId || "",
      });
    } else {
      reset({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        docType: "",
        docNumber: "",
        employeeCode: "",
        roleTitle: "",
        locationId: "",
        isActive: true,
        hiredAt: "",
        userId: "",
      });
    }
  }, [employee, reset]);

  const onSubmit = async (data: EmployeeFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Clean up empty strings and ensure required fields
      const cleanedData: CreateEmployeeRequest = {
        firstName: data.firstName.trim(),
        lastName: data.lastName?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        email: data.email.trim(), // Email is required
        docType: data.docType?.trim() || undefined,
        docNumber: data.docNumber?.trim() || undefined,
        employeeCode: data.employeeCode?.trim() || undefined,
        roleTitle: data.roleTitle?.trim() || undefined,
        locationId: data.locationId || undefined,
        isActive: data.isActive,
        hiredAt: data.hiredAt || undefined,
        userId: data.userId || undefined,
      };

      const employeeName =
        `${cleanedData.firstName} ${cleanedData.lastName || ""}`.trim();

      if (employee) {
        // Update existing employee
        await updateEmployeeMutation.mutateAsync({
          id: employee.id,
          data: cleanedData as UpdateEmployeeRequest,
        });
        onSuccess?.("update", employeeName);
      } else {
        // Create new employee
        await createEmployeeMutation.mutateAsync(cleanedData);
        onSuccess?.("create", employeeName);
      }

      reset();
    } catch (error) {
      console.error("Failed to save employee:", error);

      // TODO: Use error.code for better error handling
      // Backend now provides error codes (e.g., "CONFLICT", "VALIDATION_ERROR")
      // Instead of parsing status codes, check: (error as any)?.code === "CONFLICT"
      // This allows for more specific error messages (e.g., "EMAIL_ALREADY_EXISTS" vs "EMPLOYEE_CODE_EXISTS")

      // Handle 409 Conflict errors (duplicate code or document)
      const statusCode = getErrorStatus(error);
      if (statusCode === 409) {
        const errorMessage = error instanceof Error ? error.message : "";

        // Check if it's a document conflict
        if (
          errorMessage.includes("document") ||
          errorMessage.includes("Person with this document")
        ) {
          setError("docNumber", {
            type: "server",
            message:
              t("form.duplicateDocumentError") ||
              "A person with this document already exists.",
          });
          return; // Don't re-throw, let user fix the error
        }

        // Check if it's a code conflict
        if (
          errorMessage.includes("code") ||
          errorMessage.includes("Employee with this code")
        ) {
          setError("employeeCode", {
            type: "server",
            message:
              t("form.duplicateCodeError") ||
              "An employee with this code already exists.",
          });
          return; // Don't re-throw, let user fix the error
        }

        // Generic 409 error
        setError("root", {
          type: "server",
          message:
            t("form.duplicateError") ||
            "A record with this information already exists.",
        });
        return; // Don't re-throw, let user fix the error
      }

      // For other errors, set a root error
      if (statusCode) {
        setError("root", {
          type: "server",
          message:
            statusCode === 400
              ? "Invalid request. Please check your input."
              : statusCode === 404
                ? "Employee not found."
                : statusCode === 422
                  ? "Validation error. Please check your input."
                  : "An error occurred. Please try again.",
        });
        return; // Don't re-throw, show error in form
      }

      // For unknown errors, re-throw to be handled by the modal
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Personal Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t("form.personalInfo")}
          </h3>

          <div>
            <Label htmlFor="firstName" className="text-sm font-medium">
              {t("form.firstName")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="firstName"
              {...register("firstName")}
              className={
                errors.firstName
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                  : ""
              }
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.firstName.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="lastName" className="text-sm font-medium">
              {t("form.lastName")}
            </Label>
            <Input id="lastName" {...register("lastName")} />
          </div>

          <div>
            <Label htmlFor="phone" className="text-sm font-medium">
              {t("form.phone")}
            </Label>
            <Input id="phone" type="tel" {...register("phone")} />
          </div>

          <div>
            <Label htmlFor="email" className="text-sm font-medium">
              {t("form.email")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              className={
                errors.email
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                  : ""
              }
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.email.message}
              </p>
            )}
            {isCheckingEmail &&
              watchedEmail &&
              watchedEmail.trim().length > 0 && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("form.checkingEmail") || "Checking..."}
                </p>
              )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="docType" className="text-sm font-medium">
                {t("form.docType")}
              </Label>
              <SearchableSelect
                options={docTypeOptions}
                value={watchedDocType || ""}
                onValueChange={value => {
                  setValue("docType", value || "", { shouldValidate: true });
                }}
                placeholder={t("form.docTypePlaceholder")}
                disabled={isSubmitting}
                allowSearch={false}
                showClearButton={true}
                error={errors.docType?.message}
              />
            </div>
            <div>
              <Label htmlFor="docNumber" className="text-sm font-medium">
                {t("form.docNumber")}
              </Label>
              <Input
                id="docNumber"
                {...register("docNumber")}
                className={
                  errors.docNumber
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : ""
                }
              />
              {errors.docNumber && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.docNumber.message}
                </p>
              )}
              {isCheckingDocument &&
                watchedDocType &&
                watchedDocNumber &&
                watchedDocType.trim().length > 0 &&
                watchedDocNumber.trim().length > 0 && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t("form.checkingDocument") || "Checking..."}
                  </p>
                )}
            </div>
          </div>
        </div>

        {/* Employment Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t("form.employmentInfo")}
          </h3>

          <div>
            <Label htmlFor="employeeCode" className="text-sm font-medium">
              {t("form.employeeCode")}
            </Label>
            <Input
              id="employeeCode"
              placeholder={t("form.employeeCodePlaceholder")}
              {...register("employeeCode")}
              className={
                errors.employeeCode
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                  : ""
              }
            />
            {errors.employeeCode && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.employeeCode.message}
              </p>
            )}
            {isCheckingCode &&
              watchedEmployeeCode &&
              watchedEmployeeCode.trim().length > 0 && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("form.checkingCode") || "Checking..."}
                </p>
              )}
          </div>

          <div>
            <Label htmlFor="roleTitle" className="text-sm font-medium">
              {t("form.roleTitle")}
            </Label>
            <Input
              id="roleTitle"
              placeholder={t("form.roleTitlePlaceholder")}
              {...register("roleTitle")}
            />
          </div>

          <div>
            <Label htmlFor="locationId" className="text-sm font-medium">
              {t("form.location") || "Location"}
            </Label>
            <LocationSelect
              value={watch("locationId")}
              onChange={locationId => {
                setValue("locationId", locationId || undefined);
              }}
              placeholder={
                t("form.locationPlaceholder") || "Select a location..."
              }
              disabled={isSubmitting}
              error={errors.locationId?.message}
            />
          </div>

          <div>
            <Label htmlFor="hiredAt" className="text-sm font-medium">
              {t("form.hireDate")}
            </Label>
            <Input id="hiredAt" type="date" {...register("hiredAt")} />
          </div>

          <div className="!mt-12 flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={watch("isActive")}
              onCheckedChange={checked =>
                setValue("isActive", checked as boolean)
              }
            />
            <Label htmlFor="isActive" className="text-sm font-medium">
              {t("form.isActive")}
            </Label>
          </div>

          {/* TODO: relate employee to user account */}
          <div className="hidden">
            <Label htmlFor="userId">{t("form.userId")}</Label>
            <Input
              id="userId"
              placeholder={t("form.userIdPlaceholder")}
              {...register("userId")}
            />
          </div>
        </div>
      </div>

      {/* Root Error Display */}
      {errors.root && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.root.message}
          </p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-6">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {t("form.cancel")}
          </Button>
        )}
        <Button
          type="submit"
          disabled={
            isSubmitting ||
            !!errors.employeeCode ||
            !!errors.docNumber ||
            !!errors.email ||
            isCheckingCode ||
            isCheckingDocument ||
            isCheckingEmail
          }
          variant="secondary"
        >
          {isSubmitting
            ? t("form.saving")
            : employee
              ? t("form.updateEmployee")
              : t("form.createEmployee")}
        </Button>
      </div>
    </form>
  );
}
