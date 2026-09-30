"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { UserWithRelations, UpdateUserRequest } from "@esli-cosmetics/types";
import { Button, Input, Label, Badge, Card } from "@esli-cosmetics/ui";
import { cn } from "@esli-cosmetics/utils";

const getProfileSchema = (t: (key: string) => string) =>
  z
    .object({
      email: z
        .string()
        .min(1, t("form.emailRequired") || "Email is required")
        .email(t("form.emailInvalid") || "Invalid email address"),
      firstName: z
        .string()
        .min(1, t("form.firstNameRequired") || "First name is required"),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      password: z
        .string()
        .min(
          6,
          t("form.passwordMinLength") ||
            "Password must be at least 6 characters"
        )
        .optional()
        .or(z.literal("")),
      passwordConfirmation: z.string().optional().or(z.literal("")),
    })
    .refine(
      data => {
        // If password is provided, password confirmation must match
        if (data.password && data.password.trim() !== "") {
          return data.password === data.passwordConfirmation;
        }
        // If no password, password confirmation should also be empty
        if (!data.password || data.password.trim() === "") {
          return (
            !data.passwordConfirmation ||
            data.passwordConfirmation.trim() === ""
          );
        }
        return true;
      },
      {
        message: t("form.passwordMismatch") || "Passwords do not match",
        path: ["passwordConfirmation"],
      }
    );

type ProfileFormData = z.infer<ReturnType<typeof getProfileSchema>>;

interface ProfileFormProps {
  user: UserWithRelations;
  onSave: (data: UpdateUserRequest) => Promise<void>;
  isLoading?: boolean;
}

export function ProfileForm({
  user,
  onSave,
  isLoading = false,
}: ProfileFormProps) {
  const { t } = useTranslation("profile");
  const isSubmitting = isLoading;
  const isFormDisabled = isSubmitting;
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);

  const profileSchema = getProfileSchema(t);

  const {
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    register,
    setError,
    watch,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      password: "",
      passwordConfirmation: "",
    },
    mode: "onChange",
  });

  // Watch password field to clear confirmation when password is cleared
  const passwordValue = watch("password");

  useEffect(() => {
    if (user) {
      reset({
        email: user.email || "",
        firstName: user.person?.firstName || "",
        lastName: user.person?.lastName || "",
        phone: user.person?.phone || "",
        password: "",
        passwordConfirmation: "",
      });
    }
  }, [user, reset]);

  // Clear password confirmation when password is cleared
  useEffect(() => {
    if (!passwordValue || passwordValue.trim() === "") {
      reset(
        {
          ...watch(),
          passwordConfirmation: "",
        },
        { keepErrors: true }
      );
    }
  }, [passwordValue, reset, watch]);

  const onSubmit = async (data: ProfileFormData) => {
    try {
      // Clean up optional fields - convert empty strings to undefined
      const cleanOptional = (val: unknown): string | undefined => {
        if (val === null || val === undefined) return undefined;
        if (typeof val === "string" && val.trim() === "") return undefined;
        return val as string | undefined;
      };

      const payload: UpdateUserRequest = {
        email: data.email.trim(),
        firstName: data.firstName.trim(),
      };

      // Add optional fields only if they have values
      const cleanedLastName = cleanOptional(data.lastName);
      if (cleanedLastName !== undefined) {
        payload.lastName = cleanedLastName;
      }

      const cleanedPhone = cleanOptional(data.phone);
      if (cleanedPhone !== undefined) {
        payload.phone = cleanedPhone;
      }

      // Only include password if it's provided and not empty
      if (data.password && data.password.trim() !== "") {
        payload.password = data.password;
      }

      await onSave(payload);

      // Reset form to mark it as not dirty after successful save
      reset(
        {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName || "",
          phone: data.phone || "",
          password: "",
          passwordConfirmation: "",
        },
        { keepValues: false }
      );
    } catch (error: unknown) {
      console.error("Profile form submission error:", error);

      // TODO: Use error.code for better error handling
      // Backend now provides error codes (e.g., "VALIDATION_ERROR", "EMAIL_ALREADY_EXISTS")
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
          message:
            t("form.genericError") || "An error occurred. Please try again.",
        });
        return;
      }

      // Parse API error response
      const statusMatch = errorString.match(/API Error: (\d+)/);
      const statusCode =
        statusMatch && statusMatch[1] ? parseInt(statusMatch[1]) : null;

      if (statusCode) {
        switch (statusCode) {
          case 400:
            setError("root", {
              type: "server",
              message:
                t("form.validationError") ||
                "Invalid data. Please check your input.",
            });
            break;
          case 401:
            setError("root", {
              type: "server",
              message:
                t("form.unauthorized") ||
                "You are not authorized to perform this action.",
            });
            break;
          case 403:
            setError("root", {
              type: "server",
              message:
                t("form.forbidden") ||
                "You don't have permission to perform this action.",
            });
            break;
          case 404:
            setError("root", {
              type: "server",
              message: t("form.notFound") || "Profile not found.",
            });
            break;
          case 409:
            setError("root", {
              type: "server",
              message:
                t("form.emailConflict") || "This email is already in use.",
            });
            break;
          case 422:
            setError("root", {
              type: "server",
              message:
                t("form.validationError") ||
                "Validation error. Please check your input.",
            });
            break;
          case 500:
            setError("root", {
              type: "server",
              message:
                t("form.serverError") ||
                "Server error. Please try again later.",
            });
            break;
          default:
            setError("root", {
              type: "server",
              message:
                t("form.genericError") ||
                "An error occurred. Please try again.",
            });
        }
      } else {
        // Check for specific error messages
        if (
          errorString.includes("email") &&
          errorString.includes("already exists")
        ) {
          setError("email", {
            type: "server",
            message: t("form.emailConflict") || "This email is already in use.",
          });
        } else if (errorString.includes("Session expired")) {
          setError("root", {
            type: "server",
            message:
              t("form.sessionExpired") ||
              "Your session has expired. Please log in again.",
          });
        } else {
          setError("root", {
            type: "server",
            message:
              errorString ||
              t("form.genericError") ||
              "An error occurred. Please try again.",
          });
        }
      }
    }
  };

  const userName = user.person
    ? `${user.person.firstName} ${user.person.lastName || ""}`.trim()
    : user.email;

  const userInitial =
    user.person?.firstName?.charAt(0)?.toUpperCase() ||
    user.email?.charAt(0)?.toUpperCase() ||
    "?";

  return (
    <div className="space-y-8">
      {/* User Info Card */}
      <Card className="p-6">
        <div className="flex items-center space-x-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-primary-500 to-primary-600 text-xl font-semibold text-white shadow-lg">
            {userInitial}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {userName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {user.email}
            </p>
            {user.roles && user.roles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {user.roles.map((role, index) => {
                  const roleName =
                    typeof role === "string" ? role : role.name || role.key;
                  return (
                    <Badge key={index} variant="success" className="text-xs">
                      {roleName}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Form */}
      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {errors.root && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-600 dark:text-red-400">
                {errors.root.message}
              </p>
            </div>
          )}

          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("form.personalInfoHeading") || "Personal Information"}
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-medium">
                  {t("form.firstName") || "First Name"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstName"
                  {...register("firstName")}
                  placeholder={
                    t("form.firstNamePlaceholder") || "Enter your first name"
                  }
                  disabled={isFormDisabled}
                  className={cn(
                    "h-12",
                    errors.firstName &&
                      "border-red-500 focus:border-red-500 focus:ring-red-500"
                  )}
                />
                {errors.firstName?.message && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-medium">
                  {t("form.lastName") || "Last Name"}
                </Label>
                <Input
                  id="lastName"
                  {...register("lastName")}
                  placeholder={
                    t("form.lastNamePlaceholder") || "Enter your last name"
                  }
                  disabled={isFormDisabled}
                  className="h-12"
                />
                {errors.lastName?.message && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.lastName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  {t("form.email") || "Email"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  {...register("email")}
                  type="email"
                  placeholder={t("form.emailPlaceholder") || "Enter your email"}
                  disabled={isFormDisabled}
                  className={cn(
                    "h-12",
                    errors.email &&
                      "border-red-500 focus:border-red-500 focus:ring-red-500"
                  )}
                />
                {errors.email?.message && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">
                  {t("form.phone") || "Phone"}
                </Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  type="tel"
                  placeholder={
                    t("form.phonePlaceholder") || "Enter your phone number"
                  }
                  disabled={isFormDisabled}
                  className="h-12"
                />
                {errors.phone?.message && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.phone.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6 border-t border-gray-200 pt-6 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("form.securityHeading") || "Security"}
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  {t("form.resetPassword") || "New Password"}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    placeholder={
                      t("form.resetPasswordPlaceholder") ||
                      "Enter new password (leave empty to keep current)"
                    }
                    disabled={isFormDisabled}
                    className={cn(
                      "h-12 pr-10",
                      errors.password &&
                        "border-red-500 focus:border-red-500 focus:ring-red-500"
                    )}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isFormDisabled}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
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
                  {t("form.resetPasswordHint") ||
                    "Leave empty to keep your current password"}
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="passwordConfirmation"
                  className="text-sm font-medium"
                >
                  {t("form.passwordConfirmation") || "Confirm New Password"}
                </Label>
                <div className="relative">
                  <Input
                    id="passwordConfirmation"
                    type={showPasswordConfirmation ? "text" : "password"}
                    {...register("passwordConfirmation")}
                    placeholder={
                      t("form.passwordConfirmationPlaceholder") ||
                      "Confirm new password"
                    }
                    disabled={
                      isFormDisabled ||
                      !passwordValue ||
                      passwordValue.trim() === ""
                    }
                    className={cn(
                      "h-12 pr-10",
                      errors.passwordConfirmation &&
                        "border-red-500 focus:border-red-500 focus:ring-red-500"
                    )}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    onClick={() =>
                      setShowPasswordConfirmation(!showPasswordConfirmation)
                    }
                    disabled={
                      isFormDisabled ||
                      !passwordValue ||
                      passwordValue.trim() === ""
                    }
                    aria-label={
                      showPasswordConfirmation
                        ? "Hide password"
                        : "Show password"
                    }
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
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
            <Button
              type="submit"
              disabled={isFormDisabled || !isDirty}
              variant="primary"
              className="h-11 px-6"
            >
              {isSubmitting
                ? t("form.saving") || "Saving..."
                : t("form.update") || "Update Profile"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
