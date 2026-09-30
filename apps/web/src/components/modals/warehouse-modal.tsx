"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import * as z from "zod";
import { AiOutlineClose } from "react-icons/ai";

import { WarehouseWithRelations } from "@esli-cosmetics/types";
import { Button, Input, Label } from "@esli-cosmetics/ui";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { BranchSelect } from "@/components/ui";

// Form validation schema
const warehouseSchema = z.object({
  name: z.string().min(1, "Warehouse name is required"),
  branchId: z.string().optional(),
  address: z.string().optional(),
  contact: z.string().optional(),
});

type WarehouseFormData = z.infer<typeof warehouseSchema>;

interface WarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: WarehouseFormData) => Promise<void>;
  warehouse?: WarehouseWithRelations | null;
  isLoading?: boolean;
}

export function WarehouseModal({
  isOpen,
  onClose,
  onSave,
  warehouse,
  isLoading = false,
}: WarehouseModalProps) {
  const { t } = useTranslation("warehouses");
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!warehouse;
  const title = isEditing ? t("modal.editTitle") : t("modal.createTitle");
  const description = isEditing ? t("modal.editDesc") : t("modal.createDesc");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
  } = useForm<WarehouseFormData>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: "",
      branchId: "",
      address: "",
      contact: "",
    },
  });

  // Reset form when warehouse changes
  useEffect(() => {
    if (isOpen) {
      if (warehouse) {
        reset({
          name: warehouse.name,
          branchId: warehouse.branch_id || "",
          address: warehouse.address || "",
          contact: warehouse.contact || "",
        });
      } else {
        reset({
          name: "",
          branchId: "",
          address: "",
          contact: "",
        });
      }
    }
  }, [isOpen, warehouse, reset]);

  const onSubmit = async (data: WarehouseFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSave(data);
      toast({
        title: t("toast.success"),
        description: isEditing ? t("toast.updated") : t("toast.created"),
        type: "success",
      });
      reset();
      onClose();
    } catch (error) {
      toast({
        title: t("toast.error"),
        description:
          error instanceof Error ? error.message : t("toast.errorDesc"),
        type: "error",
      });
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
          <div className="grid grid-cols-1 gap-4">
            {/* Warehouse Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                {t("form.name")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                {...register("name")}
                placeholder={t("form.namePlaceholder")}
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* Branch */}
            <div className="hidden space-y-2">
              <Label htmlFor="branchId">{t("form.branch")}</Label>
              <BranchSelect
                value={watch("branchId") || ""}
                onChange={branchId => {
                  // Update the form value
                  const event = {
                    target: {
                      name: "branchId",
                      value: branchId || "",
                    },
                  };
                  register("branchId").onChange(event);
                }}
                placeholder={t("form.branchPlaceholder")}
                disabled={isSubmitting}
                error={errors.branchId?.message}
              />
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

          {/* Contact */}
          <div className="space-y-2">
            <Label htmlFor="contact">{t("form.contact")}</Label>
            <Input
              id="contact"
              {...register("contact")}
              placeholder={t("form.contactPlaceholder")}
              disabled={isSubmitting}
            />
            {errors.contact && (
              <p className="text-sm text-red-500">{errors.contact.message}</p>
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
