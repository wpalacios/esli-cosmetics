"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import {
  UserWithRelations,
  CreateUserRequest,
  UpdateUserRequest,
  EmployeeWithRelations,
} from "@esli-cosmetics/types";
import { Button, Checkbox, Input, Label } from "@esli-cosmetics/ui";
import { RolesMultiSelect } from "@/components/ui/roles-multi-select";
import { EmployeeSelect } from "@/components/ui/employee-select";
import { useEmployee } from "@/hooks/use-employees";

const getUserSchema = (
  t: (key: string) => string,
  isEditMode: boolean = false
) =>
  z
    .object({
      email: z
        .string()
        .email(t("form.emailInvalid"))
        .min(1, t("form.emailRequired")),
      password: isEditMode
        ? z
            .string()
            .min(6, t("form.passwordMinLength"))
            .optional()
            .or(z.literal(""))
        : z.string().min(6, t("form.passwordMinLength")),
      passwordConfirmation: isEditMode
        ? z.string().optional().or(z.literal(""))
        : z.string().min(6, t("form.passwordMinLength")),
      isActive: z.boolean().default(true),
      roleKeys: z.array(z.string()).min(1, t("form.rolesRequired")),
      employeeId: z.string().optional(),
    })
    .refine(
      data => {
        // If password is provided, password confirmation must match
        if (data.password && data.password.trim() !== "") {
          return data.password === data.passwordConfirmation;
        }
        // If no password, password confirmation should also be empty (for edit mode)
        if (!data.password || data.password.trim() === "") {
          return (
            !data.passwordConfirmation ||
            data.passwordConfirmation.trim() === ""
          );
        }
        return true;
      },
      {
        message: t("form.passwordMismatch"),
        path: ["passwordConfirmation"],
      }
    );

type UserFormData = z.infer<ReturnType<typeof getUserSchema>>;

interface UserFormProps {
  user?: UserWithRelations | null;
  onSave: (
    data: CreateUserRequest | UpdateUserRequest,
    id?: string
  ) => Promise<void>;
  isLoading?: boolean;
  onCancel: () => void;
}

export function UserForm({
  user,
  onSave,
  isLoading = false,
  onCancel,
}: UserFormProps) {
  const { t } = useTranslation("users");
  const isEditMode = !!user;
  const isSubmitting = isLoading;
  const isFormDisabled = isSubmitting;
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);

  const userSchema = getUserSchema(t, isEditMode);

  const {
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
    register,
    setError,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: "",
      password: "",
      passwordConfirmation: "",
      isActive: true,
      roleKeys: [],
      employeeId: undefined,
    },
  });

  // Get employee ID from user data or form state
  const employeeIdFromUser = user?.employee?.id;
  const formEmployeeId = watch("employeeId");

  // Use employeeId from form state if available, otherwise from user data
  const employeeIdToFetch = formEmployeeId || employeeIdFromUser;

  // Fetch employee data if we have an employee ID
  const { data: fetchedEmployee, isLoading: isLoadingEmployee } = useEmployee(
    employeeIdToFetch || ""
  );

  // Use fetched employee if available, otherwise try to convert user.employee
  const currentEmployee = useMemo<EmployeeWithRelations | undefined>(() => {
    // Prefer fetched employee data as it's complete
    if (fetchedEmployee) {
      return fetchedEmployee;
    }

    // Fallback to converting user.employee if it exists
    if (!user?.employee) return undefined;

    return {
      id: user.employee.id,
      employeeCode: user.employee.employeeCode,
      roleTitle: user.employee.roleTitle,
      person: user.employee.person
        ? {
            id: user.employee.person.id,
            firstName: user.employee.person.firstName,
            lastName: user.employee.person.lastName,
            phone: user.employee.person.phone,
            email: user.employee.person.email,
          }
        : undefined,
      userId: user.id,
      personId: user.employee.person?.id || "",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as EmployeeWithRelations;
  }, [user, fetchedEmployee]);

  useEffect(() => {
    if (user) {
      const employeeId = user.employee?.id || undefined;
      reset({
        email: user.email || "",
        isActive: user.isActive ?? true,
        // Extract role keys from role objects (handle both old string[] and new object[] format)
        roleKeys:
          user.roles?.map(role =>
            typeof role === "string" ? role : role.key
          ) || [],
        employeeId,
      });
    } else {
      reset();
    }
  }, [user, reset]);

  // Update employeeId when fetchedEmployee becomes available
  useEffect(() => {
    if (fetchedEmployee && user && !formEmployeeId) {
      setValue("employeeId", fetchedEmployee.id, { shouldValidate: false });
    }
  }, [fetchedEmployee, user, formEmployeeId, setValue]);

  const onSubmit = async (data: UserFormData) => {
    try {
      const cleanOptional = (val: unknown): string | undefined => {
        if (val === null || val === undefined) return undefined;
        if (typeof val === "string" && val.trim() === "") return undefined;
        return val as string | undefined;
      };

      const basePayload = {
        email: data.email,
        isActive: data.isActive,
      };

      const optionalFields: Partial<CreateUserRequest | UpdateUserRequest> = {};

      if (data.password && data.password.trim() !== "") {
        optionalFields.password = data.password;
      }
      if (data.roleKeys && data.roleKeys.length > 0) {
        optionalFields.roleKeys = data.roleKeys;
      }

      // Handle employeeId
      if (isEditMode) {
        // Always include employeeId in update payload to allow unlinking
        // Use null if undefined to explicitly signal "unlink"
        optionalFields.employeeId = data.employeeId || null;
      } else if (data.employeeId) {
        // Only include employeeId in create if it's provided
        optionalFields.employeeId = data.employeeId;
      }

      const userPayload = { ...basePayload, ...optionalFields };

      if (isEditMode) {
        await onSave(userPayload as UpdateUserRequest, user!.id);
      } else {
        await onSave(userPayload as CreateUserRequest);
      }
    } catch (error: unknown) {
      console.error("User form submission error:", error);

      // TODO: Use error.code for better error handling
      // Backend now provides error codes (e.g., "VALIDATION_ERROR", "EMAIL_ALREADY_EXISTS", "INVALID_CREDENTIALS")
      // Instead of parsing status codes, check: (error as any)?.code === "EMAIL_ALREADY_EXISTS"
      // This allows for more specific error messages per error type

      let errorString = "";
      if (error && typeof error === "object" && "message" in error) {
        errorString = String(error.message);
      } else if (typeof error === "string") {
        errorString = error;
      } else {
        setError("root", {
          type: "server",
          message: t("form.genericError"),
        });
        return;
      }

      const statusMatch = errorString.match(/API Error: (\d+)/);
      const statusCode =
        statusMatch && statusMatch[1] ? parseInt(statusMatch[1]) : null;

      if (statusCode) {
        switch (statusCode) {
          case 400:
            setError("root", {
              type: "server",
              message: t("form.genericConflict"),
            });
            break;
          case 401:
            setError("root", {
              type: "server",
              message: t("form.unauthorized"),
            });
            break;
          case 403:
            setError("root", {
              type: "server",
              message: t("form.forbidden"),
            });
            break;
          case 404:
            setError("root", {
              type: "server",
              message: t("form.notFound"),
            });
            break;
          case 409:
            setError("root", {
              type: "server",
              message: t("form.genericConflict"),
            });
            break;
          case 422:
            setError("root", {
              type: "server",
              message: t("form.validationError"),
            });
            break;
          case 500:
            setError("root", {
              type: "server",
              message: t("form.serverError"),
            });
            break;
          default:
            setError("root", {
              type: "server",
              message: t("form.genericError"),
            });
        }
      } else {
        setError("root", {
          type: "server",
          message: t("form.genericError"),
        });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {errors.root && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.root.message}
          </p>
        </div>
      )}

      {/* Account Information Section */}
      <div className="space-y-6">
        <div>
          <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
            {t("form.accountInfoHeading") || "Account Information"}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("form.accountInfoDescription") ||
              "Basic account details for the user"}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              {t("form.email")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              {...register("email")}
              type="email"
              placeholder={t("form.emailPlaceholder")}
              disabled={isFormDisabled}
              className={`h-12 ${errors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
            />
            {errors.email?.message && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>

          {!isEditMode && (
            <>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  {t("form.password")} <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    placeholder={t("form.passwordPlaceholder")}
                    disabled={isFormDisabled}
                    className={`h-12 pr-10 ${errors.password ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isFormDisabled}
                  >
                    {showPassword ? (
                      <AiOutlineEyeInvisible className="h-5 w-5" />
                    ) : (
                      <AiOutlineEye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password?.message && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.password.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("form.passwordHint")}
                </p>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="passwordConfirmation"
                  className="text-sm font-medium"
                >
                  {t("form.passwordConfirmation")}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="passwordConfirmation"
                    type={showPasswordConfirmation ? "text" : "password"}
                    {...register("passwordConfirmation")}
                    placeholder={t("form.passwordConfirmationPlaceholder")}
                    disabled={isFormDisabled}
                    className={`h-12 pr-10 ${errors.passwordConfirmation ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    onClick={() =>
                      setShowPasswordConfirmation(!showPasswordConfirmation)
                    }
                    disabled={isFormDisabled}
                  >
                    {showPasswordConfirmation ? (
                      <AiOutlineEyeInvisible className="h-5 w-5" />
                    ) : (
                      <AiOutlineEye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.passwordConfirmation?.message && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.passwordConfirmation.message}
                  </p>
                )}
              </div>
            </>
          )}

          {isEditMode && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  {t("form.resetPassword")}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    placeholder={t("form.resetPasswordPlaceholder")}
                    disabled={isFormDisabled}
                    className={`h-12 pr-10 ${errors.password ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isFormDisabled}
                  >
                    {showPassword ? (
                      <AiOutlineEyeInvisible className="h-5 w-5" />
                    ) : (
                      <AiOutlineEye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password?.message && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.password.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("form.resetPasswordHint")}
                </p>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="passwordConfirmation"
                  className="text-sm font-medium"
                >
                  {t("form.passwordConfirmation")}
                </Label>
                <div className="relative">
                  <Input
                    id="passwordConfirmation"
                    type={showPasswordConfirmation ? "text" : "password"}
                    {...register("passwordConfirmation")}
                    placeholder={t("form.passwordConfirmationPlaceholder")}
                    disabled={isFormDisabled}
                    className={`h-12 pr-10 ${errors.passwordConfirmation ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    onClick={() =>
                      setShowPasswordConfirmation(!showPasswordConfirmation)
                    }
                    disabled={isFormDisabled}
                  >
                    {showPasswordConfirmation ? (
                      <AiOutlineEyeInvisible className="h-5 w-5" />
                    ) : (
                      <AiOutlineEye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.passwordConfirmation?.message && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.passwordConfirmation.message}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Permissions & Access Section */}
      <div className="space-y-6">
        <div>
          <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
            {t("form.permissionsHeading") || "Permissions & Access"}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("form.permissionsDescription") ||
              "Configure user roles and employee association"}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roleKeys" className="text-sm font-medium">
              {t("form.roles")} <span className="text-red-500">*</span>
            </Label>
            <RolesMultiSelect
              value={watch("roleKeys") || []}
              onChange={keys =>
                setValue("roleKeys", keys, { shouldValidate: true })
              }
              disabled={isFormDisabled}
              placeholder={t("form.selectRoles")}
            />
            {errors.roleKeys?.message && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {errors.roleKeys.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="employeeId" className="text-sm font-medium">
              {t("form.employee")}
            </Label>
            <EmployeeSelect
              value={formEmployeeId}
              onChange={employeeId =>
                setValue("employeeId", employeeId, { shouldValidate: true })
              }
              disabled={isFormDisabled}
              placeholder={t("form.selectEmployee")}
              error={errors.employeeId?.message}
              currentEmployee={currentEmployee}
            />
            {errors.employeeId?.message && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {errors.employeeId.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-3 border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <Checkbox
                id="isActive"
                {...register("isActive")}
                disabled={isFormDisabled}
                className="h-4 w-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500 dark:border-gray-600"
                checked={watch("isActive") || false}
                onCheckedChange={checked =>
                  setValue("isActive", checked === true, {
                    shouldValidate: true,
                  })
                }
              />
              <div className="flex-1">
                <Label
                  htmlFor="isActive"
                  className="cursor-pointer text-sm font-medium"
                >
                  {t("form.isActive")}
                </Label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isFormDisabled}
            className="h-11 px-6"
          >
            {t("form.cancel")}
          </Button>
        )}

        <Button
          type="submit"
          disabled={isFormDisabled}
          variant="secondary"
          className="h-11 px-6"
        >
          {isSubmitting
            ? t("form.saving")
            : isEditMode
              ? t("form.update")
              : t("form.create")}
        </Button>
      </div>
    </form>
  );
}
