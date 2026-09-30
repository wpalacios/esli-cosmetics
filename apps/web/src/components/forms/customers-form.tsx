"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  CustomerWithRelations,
  CreateCustomerRequest,
  UpdateCustomerRequest,
} from "@esli-cosmetics/types";
import { Button, Input, Label, Checkbox } from "@esli-cosmetics/ui";
import { PriceTypesMultiSelect } from "@/components/ui/price-types-multi-select";
import { DiscountCodeMultiSelect } from "@/components/ui/discount-code-multi-select";
import { CustomerTypeSelect } from "@/components/ui/customer-type-select";

const getCustomerSchema = (t: (key: string) => string) =>
  z
    .object({
      firstName: z.string().min(1, t("form.firstNameRequired")),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      email: z
        .string()
        .email(t("form.emailInvalid"))
        .optional()
        .or(z.literal("")),
      docType: z.string().optional(),
      docNumber: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      userId: z.string().optional(),
      externalId: z.string().optional(),
      defaultBillingAddressId: z.string().optional(),
      customerTypeId: z.string().optional(),
      priceTypeIds: z.array(z.string()).min(1, t("form.priceTypeRequired")),
      discountCodeIds: z.array(z.string()).optional(),
      creditAllowed: z.boolean().optional(),
      creditLimit: z.string().optional(),
      initialOpeningBalance: z.string().optional(),
    })
    .refine(
      data => {
        // If creditAllowed is true, creditLimit must be provided and valid
        if (data.creditAllowed === true) {
          if (!data.creditLimit || data.creditLimit.trim() === "") {
            return false;
          }
          const num = parseFloat(data.creditLimit);
          return !isNaN(num) && num >= 0;
        }
        // If creditAllowed is false or undefined, creditLimit is optional
        // But if provided, it should still be valid
        if (data.creditLimit && data.creditLimit.trim() !== "") {
          const num = parseFloat(data.creditLimit);
          return !isNaN(num) && num >= 0;
        }
        return true;
      },
      {
        message: t("form.creditLimitRequired"),
        path: ["creditLimit"], // This will attach the error to the creditLimit field
      }
    );

type CustomerFormData = z.infer<ReturnType<typeof getCustomerSchema>>;

interface CustomerFormProps {
  customer?: CustomerWithRelations | null;
  onSave: (
    data: CreateCustomerRequest | UpdateCustomerRequest,
    id?: string
  ) => Promise<void>;
  isLoading?: boolean;
  onCancel: () => void;
}

export function CustomerForm({
  customer,
  onSave,
  isLoading = false,
  onCancel,
}: CustomerFormProps) {
  const { t } = useTranslation("customers");
  const isEditMode = !!customer;
  const isSubmitting = isLoading;
  const isFormDisabled = isSubmitting;

  const customerSchema = getCustomerSchema(t);

  const {
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
    watch,
    setValue,
    register,
    setError,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      docType: "",
      docNumber: "",
      address: "",
      city: "",
      postalCode: "",
      userId: "",
      externalId: "",
      defaultBillingAddressId: "",
      customerTypeId: "",
      priceTypeIds: [],
      discountCodeIds: [],
      creditAllowed: false,
      creditLimit: "",
      initialOpeningBalance: "",
    },
  });

  // Track customerTypeId from customer prop as source of truth
  // This ensures we always have the correct value even if form state gets cleared
  const [customerTypeIdFromCustomer, setCustomerTypeIdFromCustomer] =
    useState<string>("");

  useEffect(() => {
    if (customer) {
      const customerTypeId =
        customer.customerType?.id || customer.customerTypeId || "";

      // Set the source of truth value
      setCustomerTypeIdFromCustomer(customerTypeId);

      reset({
        firstName: customer.person?.firstName || "",
        lastName: customer.person?.lastName || "",
        phone: customer.person?.phone || "",
        email: customer.person?.email || "",
        docType: customer.person?.docType || "",
        docNumber: customer.person?.docNumber || "",
        address: customer.defaultBillingAddress?.address || "",
        city: customer.defaultBillingAddress?.city || "",
        postalCode: customer.defaultBillingAddress?.postalCode || "",
        userId: customer.userId || "",
        externalId: customer.externalId || "",
        defaultBillingAddressId: customer.defaultBillingAddressId || "",
        customerTypeId,
        priceTypeIds: customer.priceTypes?.map(pt => pt.id) || [],
        discountCodeIds:
          customer.discountCodes
            ?.filter(dc => dc.discountCode.isActive)
            .map(dc => dc.discountCode.id) || [],
        creditAllowed: customer.creditAllowed ?? false,
        creditLimit: customer.creditLimit ? String(customer.creditLimit) : "",
        initialOpeningBalance: customer.initialOpeningBalance
          ? String(customer.initialOpeningBalance)
          : "",
      });
    } else {
      setCustomerTypeIdFromCustomer("");
      reset();
    }
  }, [customer, reset]);

  const onSubmit = async (data: CustomerFormData) => {
    try {
      const cleanOptional = (val: unknown): string | undefined => {
        if (val === null || val === undefined) return undefined;
        if (typeof val === "string" && val.trim() === "") return undefined;
        return val as string | undefined;
      };

      // Helper to parse numeric string, allowing 0 and empty values
      const parseNumericOptional = (
        val: string | undefined | null
      ): number | undefined => {
        if (val === null || val === undefined) return undefined;
        if (typeof val === "string" && val.trim() === "") return undefined;
        const parsed = parseFloat(val);
        return isNaN(parsed) ? undefined : parsed;
      };

      const priceTypeIdsToSend = data.priceTypeIds;
      const parsedInitialOpeningBalance = parseNumericOptional(
        data.initialOpeningBalance
      );

      const personPayload = {
        firstName: data.firstName,
        ...(cleanOptional(data.lastName) && { lastName: data.lastName }),
        ...(cleanOptional(data.phone) && { phone: data.phone }),
        ...(cleanOptional(data.email) && { email: data.email }),
        ...(cleanOptional(data.docType) && { docType: data.docType }),
        ...(cleanOptional(data.docNumber) && { docNumber: data.docNumber }),
      };

      const addressPayload = {
        ...(cleanOptional(data.address) && { address: data.address }),
        ...(cleanOptional(data.city) && { city: data.city }),
        ...(cleanOptional(data.postalCode) && { postalCode: data.postalCode }),
      };

      const customerPayload = {
        person: personPayload,
        ...(Object.keys(addressPayload).length > 0 && {
          address: addressPayload,
        }),
        ...(cleanOptional(data.userId) && { userId: data.userId }),
        ...(cleanOptional(data.externalId) && { externalId: data.externalId }),
        ...(cleanOptional(data.defaultBillingAddressId) && {
          defaultBillingAddressId: data.defaultBillingAddressId,
        }),
        ...(cleanOptional(data.customerTypeId) && {
          customerTypeId: data.customerTypeId,
        }),
        priceTypeIds: priceTypeIdsToSend,
        // Always include discountCodeIds, even if empty, so backend knows to remove all when empty
        discountCodeIds: data.discountCodeIds || [],
        creditAllowed: data.creditAllowed ?? false,
        ...(data.creditLimit &&
          data.creditLimit.trim() !== "" && {
            creditLimit: parseFloat(data.creditLimit),
          }),
        // Always include initialOpeningBalance when editing, so backend can update it to 0 when cleared
        // For new customers, only include if it has a value
        ...(isEditMode
          ? {
              initialOpeningBalance: parsedInitialOpeningBalance ?? 0,
            }
          : parsedInitialOpeningBalance !== undefined && {
              initialOpeningBalance: parsedInitialOpeningBalance,
            }),
      };

      if (isEditMode) {
        await onSave(customerPayload as UpdateCustomerRequest, customer!.id);
      } else {
        await onSave(customerPayload as CreateCustomerRequest);
      }
    } catch (error: unknown) {
      console.error("Customer form submission error:", error);

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
          message: t("form.genericError"),
        });
        return;
      }

      // Extract status code from API error format: "API Error: 400 - {...}"
      const statusMatch = errorString.match(/API Error: (\d+)/);
      const statusCode =
        statusMatch && statusMatch[1] ? parseInt(statusMatch[1]) : null;

      // Show user-friendly messages based on status code
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
        // Fallback for non-API errors
        setError("root", {
          type: "server",
          message: t("form.genericError"),
        });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Root error display */}
      {errors.root && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.root.message}
          </p>
        </div>
      )}

      <div className="space-y-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t("form.personalInfoHeading")}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-sm font-medium">
              {t("form.firstName")} <span className="text-red-500">*</span>
            </Label>

            <Input
              id="firstName"
              {...register("firstName")}
              placeholder={t("form.firstNamePlaceholder")}
              disabled={isFormDisabled}
              className={`h-12 ${errors.firstName ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
            />

            {errors.firstName?.message && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {errors.firstName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-sm font-medium">
              {t("form.lastName")}
            </Label>

            <Input
              id="lastName"
              {...register("lastName")}
              placeholder={t("form.lastNamePlaceholder")}
              disabled={isFormDisabled}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              {t("form.email")}
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

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              {t("form.phone")}
            </Label>

            <Input
              id="phone"
              {...register("phone")}
              placeholder={t("form.phonePlaceholder")}
              disabled={isFormDisabled}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="docType" className="text-sm font-medium">
              {t("form.docType")}
            </Label>

            <Input
              id="docType"
              {...register("docType")}
              placeholder={t("form.docTypePlaceholder")}
              disabled={isFormDisabled}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="docNumber" className="text-sm font-medium">
              {t("form.docNumber")}
            </Label>

            <Input
              id="docNumber"
              {...register("docNumber")}
              placeholder={t("form.docNumberPlaceholder")}
              disabled={isFormDisabled}
              className="h-12"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("form.addressHeading")}
          </h4>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-medium">
              {t("form.address")}
            </Label>

            <Input
              id="address"
              {...register("address")}
              placeholder={t("form.addressPlaceholder")}
              disabled={isFormDisabled}
              className="h-12"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-sm font-medium">
                {t("form.city")}
              </Label>

              <Input
                id="city"
                {...register("city")}
                placeholder={t("form.cityPlaceholder")}
                disabled={isFormDisabled}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postalCode" className="text-sm font-medium">
                {t("form.postalCode")}
              </Label>

              <Input
                id="postalCode"
                {...register("postalCode")}
                placeholder={t("form.postalCodePlaceholder")}
                disabled={isFormDisabled}
                className="h-12"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customerTypeId" className="text-sm font-medium">
            {t("form.customerType")}
          </Label>

          <CustomerTypeSelect
            key={`${customer?.id || "new"}-${customer?.customerType?.id || "no-type"}`}
            value={(() => {
              // Use customerTypeIdFromCustomer as source of truth if available,
              // otherwise fall back to watched value
              const watchedValue = watch("customerTypeId") || "";
              return customerTypeIdFromCustomer || watchedValue;
            })()}
            onChange={id => {
              // Prevent clearing the value if we're editing and the customer has a type
              if (
                id === "" &&
                customer &&
                (customer.customerType?.id || customer.customerTypeId)
              ) {
                const expectedId =
                  customer.customerType?.id || customer.customerTypeId || "";
                // Restore the expected value
                setValue("customerTypeId", expectedId, {
                  shouldValidate: true,
                });
                setCustomerTypeIdFromCustomer(expectedId);
                return;
              }

              // Update both the form state and our source of truth
              setCustomerTypeIdFromCustomer(id);
              setValue("customerTypeId", id, { shouldValidate: true });
            }}
            disabled={isFormDisabled}
            placeholder={t("form.selectCustomerType")}
            error={errors.customerTypeId?.message ?? ""}
            {...(customer?.customerType && {
              currentCustomerType: customer.customerType,
            })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="priceTypeIds" className="text-sm font-medium">
            {t("form.priceTypes")} <span className="text-red-500">*</span>
          </Label>

          <PriceTypesMultiSelect
            value={watch("priceTypeIds") || []}
            onChange={ids =>
              setValue("priceTypeIds", ids, { shouldValidate: true })
            }
            disabled={isFormDisabled}
            placeholder={t("form.selectPriceTypes")}
            error={errors.priceTypeIds?.message}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="discountCodeIds" className="text-sm font-medium">
          {t("form.discountCodes")}
        </Label>

        <DiscountCodeMultiSelect
          value={watch("discountCodeIds") || []}
          onChange={ids =>
            setValue("discountCodeIds", ids, { shouldValidate: true })
          }
          disabled={isFormDisabled}
          error={errors.discountCodeIds?.message}
        />
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t("form.creditInfoHeading")}
        </h3>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="creditAllowed"
              checked={watch("creditAllowed") || false}
              onCheckedChange={checked =>
                setValue("creditAllowed", checked === true, {
                  shouldValidate: true,
                })
              }
              disabled={isFormDisabled}
            />
            <Label
              htmlFor="creditAllowed"
              className="cursor-pointer text-sm font-medium"
            >
              {t("form.creditAllowed")}
            </Label>
          </div>
          <p className="text-xs text-gray-500">
            {t("form.creditAllowedDescription")}
          </p>
        </div>
      </div>

      {watch("creditAllowed") && (
        <div className="space-y-2">
          <Label htmlFor="creditLimit" className="text-sm font-medium">
            {t("form.creditLimit")} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="creditLimit"
            {...register("creditLimit")}
            type="number"
            step="0.01"
            min="0"
            placeholder={t("form.creditLimitPlaceholder")}
            disabled={isFormDisabled}
            className={`h-12 ${errors.creditLimit ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
          />
          {errors.creditLimit?.message && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.creditLimit.message}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="initialOpeningBalance" className="text-sm font-medium">
          {t("form.initialOpeningBalance")}
        </Label>
        <Input
          id="initialOpeningBalance"
          {...register("initialOpeningBalance")}
          type="number"
          step="0.01"
          placeholder={t("form.initialOpeningBalancePlaceholder")}
          disabled={isFormDisabled}
          className="h-12"
        />
        <p className="text-xs text-gray-500">
          {t("form.initialOpeningBalanceDescription")}
        </p>
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
