"use client";

import { Modal, ModalContent } from "@esli-cosmetics/ui";
import { ShoppingCart } from "./shopping-cart";
import type { CartItem } from "../pos-page-client";

interface MobileCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productVariantId: string, quantity: number) => void;
  onRemoveItem: (productVariantId: string) => void;
  onUpdateItemDiscount: (
    productVariantId: string,
    discountAmount: number
  ) => void;
  onUpdateItemDiscountPercentage: (
    productVariantId: string,
    discountPercentage: number
  ) => void;
  onUpdatePriceType?: (productVariantId: string, priceTypeId: string) => void;
  discountCode: string;
  onDiscountCodeChange: (code: string) => void;
  discountCodeInfo: {
    id: string;
    discountType: "PERCENTAGE" | "FIXED";
    value: number;
    maxDiscount?: number;
  } | null;
  onDiscountCodeInfoChange: (
    info: {
      id: string;
      discountType: "PERCENTAGE" | "FIXED";
      value: number;
      maxDiscount?: number;
    } | null
  ) => void;
  manualOrderDiscount: number;
  onManualOrderDiscountChange: (amount: number) => void;
  manualOrderDiscountPercentage: number;
  onManualOrderDiscountPercentageChange: (percentage: number) => void;
  includeTax: boolean;
  onIncludeTaxChange: (include: boolean) => void;
  totals: {
    subtotal: number;
    itemsDiscountTotal: number;
    orderDiscount: number;
    discountCodeValue: number;
    manualOrderDiscount: number;
    discountAmount: number;
    taxes: number;
    totalAmount: number;
  };
  customerId: string;
  selectedCustomer?: {
    id: string;
    priceTypes?: Array<{
      id: string;
      name: string;
      minQuantity: number;
      priority: number;
      isActive: boolean;
    }>;
  } | null;
  onCheckout: () => void;
  onResetCart: () => void;
  checkoutButtonText?: string;
  isSubmitting?: boolean;
  stockValidationBlocked?: boolean;
  isQuoteMode?: boolean;
  quoteStatus?: string;
  onApproveQuote?: () => void;
}

export function MobileCartDrawer({
  isOpen,
  onClose,
  ...shoppingCartProps
}: MobileCartDrawerProps) {
  return (
    <Modal open={isOpen} onClose={onClose} size="full">
      <ModalContent
        className="flex h-[100vh] max-h-[100vh] w-full max-w-full flex-col gap-0 p-0 sm:rounded-lg"
        showCloseButton={true}
        hiddenTitle="Shopping Cart"
      >
        <div className="min-h-0 flex-1 overflow-hidden">
          <ShoppingCart {...shoppingCartProps} />
        </div>
      </ModalContent>
    </Modal>
  );
}
