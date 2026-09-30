"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import * as z from "zod";
import { AiOutlineClose } from "react-icons/ai";

import {
  BranchWithRelations,
  CreateBranchRequest,
  EmployeeWithRelations,
} from "@esli-cosmetics/types";
import { Button, Input, Label, Checkbox } from "@esli-cosmetics/ui";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { EmployeeSelect } from "@/components/ui";

// Form validation schema matches CreateBranchRequest
const branchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  code: z
    .string()
    .optional()
    .transform(val => val || undefined),
  address: z
    .string()
    .optional()
    .transform(val => val || undefined),
  phone: z
    .string()
    .optional()
    .transform(val => val || undefined),
  managerEmployeeId: z
    .string()
    .uuid("Manager must be a valid employee")
    .optional()
    .or(z.literal(""))
    .transform(val => val || undefined),
  isActive: z.boolean().default(true),
});

type BranchFormData = z.infer<typeof branchSchema>;

interface BranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateBranchRequest) => Promise<void>;
  branch?: BranchWithRelations | null;
  isLoading?: boolean;
}

export function BranchModal({
  isOpen,
  onClose,
  onSave,
  branch,
  isLoading = false,
}: BranchModalProps) {
  const { t } = useTranslation("branches");
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!branch;
  const title = isEditing ? t("modal.editTitle") : t("modal.createTitle");
  const description = isEditing ? t("modal.editDesc") : t("modal.createDesc");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
  } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: "",
      code: "",
      address: "",
      phone: "",
      managerEmployeeId: undefined,
      isActive: true,
    },
  });

  // Reset form when branch changes
  useEffect(() => {
    if (branch) {
      reset({
        name: branch.name,
        code: branch.code || "",
        address: branch.address || "",
        phone: branch.phone || "",
        managerEmployeeId: branch.manager_employee_id || undefined,
        isActive: branch.is_active,
      });
    } else {
      reset({
        name: "",
        code: "",
        address: "",
        phone: "",
        managerEmployeeId: undefined,
        isActive: true,
      });
    }
  }, [branch, reset]);

  const onSubmit = async (data: BranchFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Clean up the data - remove empty optional fields
      const cleanData: CreateBranchRequest = {
        name: data.name,
        isActive: data.isActive,
      };
      if (data.code) cleanData.code = data.code;
      if (data.address) cleanData.address = data.address;
      if (data.phone) cleanData.phone = data.phone;
      if (data.managerEmployeeId)
        cleanData.managerEmployeeId = data.managerEmployeeId;

      await onSave(cleanData);
      toast({
        title: t("toast.success"),
        description: isEditing ? t("toast.updated") : t("toast.created"),
        type: "success",
      });
      onClose();
    } catch (error: any) {
      let friendlyMessage = t("toast.errorDesc");
      const errorMessage = error?.message || "";

      // Use exact matching for more robust error handling
      if (errorMessage === "Branch with this name already exists") {
        friendlyMessage = t("toast.duplicateName");
      } else if (errorMessage === "Branch with this code already exists") {
        friendlyMessage = t("toast.duplicateCode");
      }

      toast({
        title: t("toast.error"),
        description: friendlyMessage,
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Branch Name */}
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

            {/* Branch Code */}
            <div className="space-y-2">
              <Label htmlFor="code">{t("form.code")}</Label>
              <Input
                id="code"
                {...register("code")}
                placeholder={t("form.codePlaceholder")}
                disabled={isSubmitting}
              />
              {errors.code && (
                <p className="text-sm text-red-500">{errors.code.message}</p>
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

            {/* Manager Employee */}
            <div className="space-y-2">
              <Label htmlFor="managerEmployeeId">{t("form.manager")}</Label>
              <EmployeeSelect
                value={watch("managerEmployeeId") || undefined}
                onChange={employeeId => {
                  // Update the form value
                  const event = {
                    target: {
                      name: "managerEmployeeId",
                      value: employeeId || undefined,
                    },
                  };
                  register("managerEmployeeId").onChange(event);
                }}
                {...(branch?.manager_employee
                  ? {
                      currentEmployee: {
                        id: branch.manager_employee.id,
                        personId: "",
                        isActive: true,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        person: {
                          id: "",
                          firstName: branch.manager_employee.person.firstName,
                          lastName: branch.manager_employee.person.lastName,
                        },
                      } as EmployeeWithRelations,
                    }
                  : {})}
                placeholder={t("form.managerPlaceholder")}
                disabled={isSubmitting}
                error={errors.managerEmployeeId?.message}
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">{t("form.address")}</Label>
              <Input
                id="address"
                {...register("address")}
                placeholder={t("form.addressPlaceholder")}
                disabled={isSubmitting}
                className="w-full"
              />
              {errors.address && (
                <p className="text-sm text-red-500">{errors.address.message}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="isActive">{t("form.status")}</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={watch("isActive")}
                onCheckedChange={() =>
                  register("isActive").onChange({
                    target: { name: "isActive", value: !watch("isActive") },
                  })
                }
                disabled={isSubmitting}
              />
              <Label htmlFor="isActive" className="text-sm font-normal">
                {t("form.active")}
              </Label>
            </div>
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
