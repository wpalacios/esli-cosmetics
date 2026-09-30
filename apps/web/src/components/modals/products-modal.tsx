"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ProductWithRelations,
  ApiProductVariant,
  ProductType,
} from "@esli-cosmetics/types";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
} from "@esli-cosmetics/ui";
import { cn } from "@esli-cosmetics/utils";
import { Pencil1Icon, MixerHorizontalIcon } from "@radix-ui/react-icons";
import {
  ProductForm,
  ProductCreationResult,
  ProductFormRef,
} from "../forms/products-form";
import {
  ProductVariantForm,
  ProductVariantFormRef,
} from "../forms/product-variant-form";
import { ProductVariantsTable } from "../tables/product-variant-table";
import {
  useDeleteProductVariant,
  useProductVariantsPaginated,
} from "@/hooks/use-product-variants";
import { useToast } from "@/hooks/toast/use-toast";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { usePrices } from "@/hooks/use-prices";
import { Stepper } from "../ui/stepper";
import { StepperButtons } from "../ui/stepper-buttons";

// Helper to safely extract error messages on the client
function getClientErrorMessage(error: any, t: (key: string) => string): string {
  return error?.message || t("errors.unexpectedError");
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: ProductWithRelations | undefined;
  onSuccess?: (
    action: "create" | "update",
    result: ProductCreationResult
  ) => void | Promise<void>;
  productType?: ProductType | undefined;
}

export function ProductModal({
  isOpen,
  onClose,
  product,
  onSuccess,
  productType,
}: ProductModalProps) {
  const { t } = useTranslation("products");
  const { toast } = useToast();
  const confirmationDialog = useConfirmationDialog();

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [isStep1Valid, setIsStep1Valid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVariantSubmitting, setIsVariantSubmitting] = useState(false);

  const [parentId, setParentId] = useState<string | undefined>(product?.id);
  const [parentName, setParentName] = useState<string | undefined>(
    product?.name
  );
  const [defaultVariantOnly, setDefaultVariantOnly] = useState<boolean>(
    product?.defaultVariantOnly ?? false
  );
  const [parentData, setParentData] = useState<
    ProductCreationResult | undefined
  >();
  const [editingVariant, setEditingVariant] =
    useState<ApiProductVariant | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [requiredFieldsValid, setRequiredFieldsValid] = useState(false);

  const productFormRef = useRef<ProductFormRef>(null);
  const variantFormRef = useRef<ProductVariantFormRef>(null);

  const [variantPage, setVariantPage] = useState(1);
  const [variantPageSize, setVariantPageSize] = useState(DEFAULT_PAGE_SIZE);
  const {
    data: variantsData,
    isLoading: isLoadingVariants,
    refetch: refetchVariants,
  } = useProductVariantsPaginated(parentId ?? "", variantPage, variantPageSize);
  const variantPagination = variantsData?.pagination;
  const totalVariantPages = variantPagination?.totalPages ?? 1;
  const totalVariantItems = variantPagination?.total ?? 0;
  const deleteVariantMutation = useDeleteProductVariant();
  const { data: pricesResponse } = usePrices();
  const priceTypes = pricesResponse?.data || [];

  const steps = useMemo(
    () => [
      {
        label: t("modal.productDetails"),
        icon: <Pencil1Icon className="h-5 w-5" />,
      },
      {
        label: defaultVariantOnly
          ? t("modal.productSellingDetails")
          : t("modal.variantDetails"),
        icon: <MixerHorizontalIcon className="h-5 w-5" />,
      },
    ],
    [defaultVariantOnly, t]
  );

  useEffect(() => {
    if (isOpen) {
      if (product) {
        setParentId(product.id);
        setParentName(product.name);
        setDefaultVariantOnly(product.defaultVariantOnly ?? false);
        setCurrentStep(1);
        setVariantPage(1);
      } else {
        setParentId(undefined);
        setDefaultVariantOnly(false);
        setCurrentStep(1);
        setVariantPage(1);
      }
      setFormError(null);
    }
  }, [isOpen, product]);

  const handleParentSuccess = async (
    action: "create" | "update",
    result: ProductCreationResult
  ) => {
    setParentId(result.id);
    setParentName(result.name);
    setParentData(result);
    setIsSubmitting(false);

    if (onSuccess) await onSuccess(action, result);

    if (action === "create") {
      if (defaultVariantOnly) {
        onClose();
      }
      // Stay on step 1 so user can add product images; they click Next again to go to step 2
    }

    if (action === "update") {
      if (defaultVariantOnly) {
        onClose();
      } else {
        setCurrentStep(2);
      }
    }
  };

  const handleVariantSuccess = (variant: ApiProductVariant) => {
    const isEdit = !!editingVariant;
    setFormError(null);
    toast({
      type: "success",
      title: isEdit ? t("toast.variantUpdated") : t("toast.variantCreated"),
      description: isEdit
        ? t("toast.variantUpdatedDesc", { name: variant.name || "Sin nombre" })
        : t("toast.variantCreatedDesc", { name: variant.name || "Sin nombre" }),
      duration: 5000,
    });
    setVariantPage(1);
    refetchVariants();
    if (parentData) {
      onSuccess?.("update", parentData);
    }
    // Después de crear o actualizar, limpiar el formulario de variantes (dejar listo para crear otra o cerrar)
    setEditingVariant(null);
  };

  const handleDeleteVariant = async (variant: ApiProductVariant) => {
    const confirmed = await confirmationDialog.openDialog({
      title: t("confirm.deleteVariantTitle"),
      description: t("confirm.deleteVariantDesc", {
        name: variant.name || "Sin nombre",
      }),
      confirmText: t("confirm.deleteVariantButton"),
      cancelText: t("confirm.cancel"),
      variant: "destructive",
    });

    if (confirmed) {
      try {
        await deleteVariantMutation.mutateAsync(variant.id);
        toast({
          type: "success",
          title: t("toast.variantDeleted"),
          description: t("toast.variantDeletedDesc", {
            name: variant.name || "Sin nombre",
          }),
          duration: 5000,
        });
        setVariantPage(1);
        refetchVariants();
        if (parentData) {
          onSuccess?.("update", parentData);
        }
      } catch (error) {
        const message = getClientErrorMessage(error, t);
        console.error("ERROR: Failed to delete variant:", error);
        toast({
          type: "error",
          title: t("toast.variantDeleteFailed"),
          description: message,
          duration: 6000,
        });
      }
    }
  };

  const handleFormError = (error: unknown) => {
    const errorMessage =
      (error instanceof Error ? error.message : String(error)) ||
      t("form.genericError");
    setFormError(errorMessage);
    toast({
      type: "error",
      title: t("toast.errorTitle"),
      description: errorMessage,
      duration: 6000,
    });
  };

  const onNext = async () => {
    if (currentStep === 1) {
      if (parentId && !product) {
        // Product was just created; go to step 2 (variants) without submitting again
        setCurrentStep(2);
      } else if (parentId && product && defaultVariantOnly) {
        // Editing with default-variant-only: go to step 2 so user can edit default variant details (cost, stock, prices, images)
        setCurrentStep(2);
      } else if (parentId && product) {
        // Editing product with variants: save only if there are changes, then go to step 2
        const hasChanges = productFormRef.current?.hasChanges?.() ?? false;
        if (hasChanges) {
          setIsSubmitting(true);
          productFormRef.current?.submit();
        } else {
          setCurrentStep(2);
        }
      } else if (defaultVariantOnly) {
        setCurrentStep(2);
      } else {
        // Create product (no parentId yet)
        setIsSubmitting(true);
        productFormRef.current?.submit();
      }
    } else {
      if (defaultVariantOnly) {
        setIsSubmitting(true);
        productFormRef.current?.submit();
      } else if (product) {
        // Step 2 with variants: persist defaultVariantOnly: false then close
        setIsSubmitting(true);
        productFormRef.current?.submit();
      } else {
        onClose();
      }
    }
  };
  function checkRequiredFields(formData: ProductCreationResult) {
    // check required fields: name, barcode, brandId
    const valid = !!formData.name && !!formData.barcode && !!formData.brandId;
    setRequiredFieldsValid(valid);
  }

  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalContent
        size="xl"
        className={cn(
          "bg-white p-0 transition-all duration-500 ease-in-out dark:bg-gray-800",
          "max-w-4xl",
          "max-h-[90vh]",
          "flex flex-col"
        )}
        showCloseButton={true}
      >
        <ModalHeader className="border-none bg-white px-6 py-2 pb-1 dark:bg-gray-800">
          <div className="flex flex-col gap-0">
            <ModalTitle className="text-xl font-bold uppercase tracking-tight">
              {product ? t("modal.editTitle") : t("modal.createTitle")}
            </ModalTitle>
            <div className="mt-5 flex w-full justify-center">
              <div className="w-full" style={{ maxWidth: 520, minWidth: 380 }}>
                <Stepper
                  currentStep={currentStep}
                  steps={steps}
                  // onStepClick={async (s) => {
                  //   if (s < currentStep) {
                  //     setCurrentStep(s as 1 | 2);
                  //     if (s === 1 && productFormRef.current?.validate) {
                  //       await productFormRef.current.validate();
                  //     }
                  //   } else if (s > currentStep && s === 2 && isStep1Valid) {
                  //     setCurrentStep(2);
                  //   }
                  // }}
                />
              </div>
            </div>
          </div>
        </ModalHeader>

        {formError && (
          <div className="px-6">
            <div className="rounded-md border border-red-400 bg-red-50 p-3 dark:border-red-600 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                {formError}
              </p>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-0">
          {/* Keep ProductForm mounted when editing on step 2 so we can submit defaultVariantOnly change when user unchecks */}
          {(currentStep === 1 ||
            (currentStep === 2 && defaultVariantOnly) ||
            (currentStep === 2 && product)) && (
            <div
              className={cn(
                "duration-300 animate-in fade-in",
                currentStep === 2 && "slide-in-from-right-4",
                currentStep === 2 && !defaultVariantOnly && product && "hidden"
              )}
            >
              <div className="mb-3 text-lg font-bold">
                {currentStep === 1
                  ? t("modal.productDetails")
                  : t("modal.productSellingDetails")}
              </div>
              <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-700 dark:bg-gray-800">
                <ProductForm
                  key={product?.id ?? "create"}
                  ref={productFormRef}
                  currentStep={currentStep}
                  product={product}
                  existingProductId={
                    parentId && !product ? parentId : undefined
                  }
                  initialData={parentData}
                  onSuccess={handleParentSuccess}
                  onCancel={onClose}
                  onError={err => {
                    setIsSubmitting(false);
                    setFormError(String(err));
                  }}
                  onDefaultVariantOnlyChange={setDefaultVariantOnly}
                  onValidationChange={isValid => {
                    setIsStep1Valid(isValid);
                    if (productFormRef.current) {
                      const formData = productFormRef.current.getValues?.();
                      if (formData) checkRequiredFields(formData);
                    }
                  }}
                  hideActionButtons={true}
                  productType={productType}
                />
              </div>
            </div>
          )}

          {currentStep === 2 && !defaultVariantOnly && (
            <div className="space-y-6 duration-300 animate-in fade-in slide-in-from-right-4">
              <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-700 dark:bg-gray-800">
                {!parentId && (
                  <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-yellow-800">
                    {t("modal.createProductFirst")}
                  </div>
                )}
                <ProductVariantForm
                  ref={variantFormRef}
                  parentId={parentId}
                  parentProduct={product}
                  onSuccess={handleVariantSuccess}
                  onAfterCreate={() => setEditingVariant(null)}
                  onError={handleFormError}
                  disabled={!parentId || isLoadingVariants}
                  editingVariant={editingVariant}
                  onCancel={() => setEditingVariant(null)}
                  priceTypes={priceTypes}
                  isDefaultVariant={defaultVariantOnly}
                  onSubmittingChange={setIsVariantSubmitting}
                />
              </div>
              <ProductVariantsTable
                data={variantsData?.data ?? []}
                parentName={parentName || ""}
                onEdit={setEditingVariant}
                onDelete={handleDeleteVariant}
                isLoading={isLoadingVariants}
                priceTypes={priceTypes}
                pagination={
                  totalVariantItems > 0
                    ? {
                        currentPage: variantPage,
                        totalPages: totalVariantPages,
                        totalItems: totalVariantItems,
                        onPageChange: setVariantPage,
                        pageSize: variantPageSize,
                        onPageSizeChange: (size: number) => {
                          setVariantPageSize(size);
                          setVariantPage(1);
                        },
                        pageSizeOptions: [...PAGE_SIZE_OPTIONS],
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>

        <div className="border-none bg-white px-6 py-6 dark:bg-gray-800">
          <StepperButtons
            currentStep={currentStep}
            totalSteps={2}
            onPrevious={() => setCurrentStep(1)}
            onNext={onNext}
            isNextDisabled={
              (currentStep === 1 && !requiredFieldsValid) ||
              isSubmitting ||
              isVariantSubmitting
            }
            isPreviousDisabled={isSubmitting || isVariantSubmitting}
            nextLabel={
              currentStep === 2
                ? product
                  ? t("buttons.save", "Guardar Cambios")
                  : t("buttons.create", "Crear Producto")
                : t("buttons.next", "Siguiente")
            }
          />
        </div>
      </ModalContent>
      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </Modal>
  );
}
