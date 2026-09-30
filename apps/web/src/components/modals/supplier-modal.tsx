"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { useTranslation } from "react-i18next";
import * as z from "zod";

import { SupplierWithRelations } from "@esli-cosmetics/types";
import { Button, Input, Label } from "@esli-cosmetics/ui";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { BrandMultiSelect } from "@/components/ui/brand-multi-select";
import { useToast } from "@/hooks/toast/use-toast";
import { SearchableMultiSelect } from "@esli-cosmetics/ui";
import { useBrands } from "~/hooks/use-brands";

// Form validation schema factory
const getSupplierSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t("form.supplierNameRequired")),
    contact_name: z.string().optional(),
    phone: z.string().optional(),
    email: z
      .string()
      .email(t("form.emailInvalid"))
      .optional()
      .or(z.literal("")),
    address: z.string().optional(),
    brand_ids: z.array(z.string()).optional(),
  });

type SupplierFormData = {
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  brand_ids?: string[];
};

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SupplierFormData) => Promise<void>;
  supplier?: SupplierWithRelations | null;
  isLoading?: boolean;
}

// TO DO
// Add Async Validation
//implement proactive validation in real-time later.

export function SupplierModal({
  isOpen,
  onClose,
  onSave,
  supplier,
  isLoading = false,
}: SupplierModalProps) {
  const { t } = useTranslation("suppliers");
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [brandSearchTerm, setBrandSearchTerm] = useState("");
  const [activeBrandSearchTerm, setActiveBrandSearchTerm] = useState("");

  const isEditing = !!supplier;
  const title = isEditing ? t("modal.editTitle") : t("modal.createTitle");
  const description = isEditing ? t("modal.editDesc") : t("modal.createDesc");

  // Fetch brands with search support
  const { data: brandsData, isLoading: isLoadingBrands } = useBrands({
    page: 1,
    limit: 200,
    ...(activeBrandSearchTerm && { search: activeBrandSearchTerm }),
  });

  // Handle search - trigger on Enter key
  const handleBrandSearchChange = (newSearchTerm: string) => {
    setBrandSearchTerm(newSearchTerm);
  };

  const handleBrandSearchTrigger = () => {
    setActiveBrandSearchTerm(brandSearchTerm);
  };

  const brands = brandsData?.data || [];

  // Build brand options ensuring selected brands are always included
  const brandOptions = useMemo(() => {
    const allBrands = [...brands];

    // If editing a supplier, ensure its brands are in the options
    if (supplier?.brands) {
      supplier.brands.forEach(supplierBrand => {
        const brandExists = allBrands.some(b => b.id === supplierBrand.brandId);
        if (!brandExists && supplierBrand.brand) {
          // Add the brand from the supplier's brands list if we have the full brand object
          // The nested brand object needs to be converted to BrandWithRelations
          allBrands.unshift({
            id: supplierBrand.brand.id,
            name: supplierBrand.brand.name,
            ...(supplierBrand.brand.description && {
              description: supplierBrand.brand.description,
            }),
            ...(supplierBrand.brand.websiteUrl && {
              websiteUrl: supplierBrand.brand.websiteUrl,
            }),
            ...(supplierBrand.brand.logoUrl && {
              logoUrl: supplierBrand.brand.logoUrl,
            }),
            ...(supplierBrand.brand.country && {
              country: supplierBrand.brand.country,
            }),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isDeleted: false,
            deletedAt: null,
          });
        } else if (!brandExists) {
          // Fallback: create a minimal brand from brandId and brandName
          allBrands.unshift({
            id: supplierBrand.brandId,
            name: supplierBrand.brandName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isDeleted: false,
            deletedAt: null,
          });
        }
      });
    }

    return allBrands.map(brand => ({
      value: brand.id,
      label: brand.name,
    }));
  }, [brands, supplier]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
    setError,
  } = useForm<SupplierFormData>({
    resolver: zodResolver(getSupplierSchema(t)),
    defaultValues: {
      name: "",
      contact_name: "",
      phone: "",
      email: "",
      address: "",
      brand_ids: [],
    },
  });

  // Reset form when supplier changes
  useEffect(() => {
    if (supplier) {
      reset({
        name: supplier.name,
        contact_name: supplier.contact_name || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
        brand_ids: supplier.brands?.map(b => b.brandId) || [],
      });
    } else {
      reset({
        name: "",
        contact_name: "",
        phone: "",
        email: "",
        address: "",
        brand_ids: [],
      });
    }
  }, [supplier, reset]);

  const onSubmit = async (data: SupplierFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSave(data);
      toast({
        title: t("toast.success"),
        description: isEditing ? t("toast.updated") : t("toast.created"),
        type: "success",
      });
      onClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t("toast.errorDesc");

      const isDuplicate =
        errorMessage.includes("already exists") ||
        errorMessage.toLowerCase().includes("unique constraint") ||
        errorMessage.includes("Conflict");

      if (isDuplicate) {
        setError("name", {
          type: "manual",
          message: t("toast.duplicateSupplier"),
        });
      } else {
        toast({
          title: t("toast.error"),
          description: errorMessage,
          type: "error",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      onClose();
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl lg:max-w-4xl">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">{title}</ModalTitle>
          <p className="text-sm text-gray-600">{description}</p>
        </ModalHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Supplier Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                {t("form.supplierName")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                {...register("name")}
                placeholder={t("form.supplierNamePlaceholder")}
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* Contact Name */}
            <div className="space-y-2">
              <Label htmlFor="contact_name">{t("form.contactName")}</Label>
              <Input
                id="contact_name"
                {...register("contact_name")}
                placeholder={t("form.contactNamePlaceholder")}
                disabled={isSubmitting}
              />
              {errors.contact_name && (
                <p className="text-sm text-red-500">
                  {errors.contact_name.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">{t("form.phone")}</Label>
              <Input
                id="phone"
                {...register("phone")}
                placeholder={t("form.phonePlaceholder")}
                disabled={isSubmitting}
              />
              {errors.phone && (
                <p className="text-sm text-red-500">{errors.phone.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">{t("form.email")}</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder={t("form.emailPlaceholder")}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">{t("form.address")}</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder={t("form.addressPlaceholder")}
              disabled={isSubmitting}
            />
            {errors.address && (
              <p className="text-sm text-red-500">{errors.address.message}</p>
            )}
          </div>

          {/* Brand Selection */}
          <div className="space-y-2">
            <Label htmlFor="brand_ids">{t("form.brands")}</Label>
            <SearchableMultiSelect
              options={brandOptions}
              value={watch("brand_ids") || []}
              onValueChange={brandIds => setValue("brand_ids", brandIds)}
              placeholder={t("form.brandsPlaceholder")}
              searchPlaceholder={t("form.searchBrands")}
              disabled={isSubmitting}
              error={errors.brand_ids?.message}
              onSearchChange={handleBrandSearchChange}
              onSearchTrigger={handleBrandSearchTrigger}
              isLoading={isLoadingBrands}
              loadingMessage={t("form.loadingBrands")}
              emptyMessage={t("form.noBrandsFound")}
            />
            {errors.brand_ids && (
              <p className="text-sm text-red-500">{errors.brand_ids.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {t("form.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting
                ? t("form.saving")
                : isEditing
                  ? t("form.update")
                  : t("form.create")}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
