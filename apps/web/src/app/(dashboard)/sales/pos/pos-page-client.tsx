"use client";

import { DEFAULT_TAX_RATE } from "@esli-cosmetics/utils";
import { CreateOrderRequest } from "@/actions/orders";
import { useToast } from "@/hooks/toast/use-toast";
import { useCurrentUser, useHasRole } from "@/hooks/use-auth";
import {
  useCashRegisters,
  useCashSessionByCashRegisterId,
  useOpenCashSessionsByLocation,
} from "@/hooks/use-cash-register";
import { useCreateOrder } from "@/hooks/use-orders";
import { productVariantKeys } from "@/hooks/use-product-variants";
import {
  CashRegister,
  EmployeeWithRelations,
  LocationInfo,
  POSKitItem,
  ProductType,
} from "@esli-cosmetics/types";
import {
  calculateItemsDiscountTotal,
  lineDiscountAmountForCartItem,
  selectPriceForQuantity as selectPriceForQuantityUtil,
  validateItemDiscountAmount,
  validateItemDiscountPercentage,
  validateManualDiscountAmount,
  validateManualDiscountPercentage,
  CURRENCY_SIGN,
} from "@esli-cosmetics/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BiCart } from "react-icons/bi";
import { CashRegisterMovementModal } from "./_components/cash-register-movement-modal";
import { CashRegisterOptions } from "./_components/cash-register-options";
import { CheckoutModal } from "./_components/checkout-modal";
import { CloseCashSessionModal } from "./_components/close-cash-session-modal";
import { MobileCartDrawer } from "./_components/mobile-cart-drawer";
import { OpenCashSessionModal } from "./_components/open-cash-session-modal";
import { POSHeader } from "./_components/pos-header";
import { ProductSearch } from "./_components/product-search";
import { ReceiptModal } from "./_components/receipt-modal";
import { ShoppingCart } from "./_components/shopping-cart";
import { getStockLevelsByProductVariantsAndLocation } from "@/actions/stock-levels";
import { validateCartItemsAgainstStockLevels } from "@/lib/cart-stock-validation";

export const normalizeProductWithMetadata = (product: any): any => {
  if (product.kitItems && product.kitItems.length > 0) return product;
  if (product.product?.kitItems && product.product.kitItems.length > 0)
    return product;

  const type = product.type || product.product?.type;
  const metadata = product.metadata || product.product?.metadata;

  if ((type === "KIT" || type === "kit") && metadata?.composition) {
    const composition = metadata.composition;

    const kitItems = composition.map((comp: any) => ({
      id: comp.variantId,
      productVariantId: comp.variantId,
      quantity: comp.quantity,
      productVariant: {
        id: comp.variantId,
        name: comp.name,
      },
      availableStock: 0,
    }));

    return {
      ...product,
      kitItems: kitItems,
      product: {
        ...product.product,
        kitItems: kitItems,
      },
    };
  }

  return product;
};

export interface CartItem {
  product: {};
  id: string;
  productVariantId: string;
  name: string;
  brand: string;
  sku: string;
  barcode: string | null;
  price: number;
  quantity: number;
  image?: string;
  availableStock: number;
  discountAmount?: number;
  discountPercentage?: number;
  multiple?: number | null;
  productPrices?: Array<{
    priceTypeId: string;
    priceTypeName: string;
    price: number;
    minQuantity: number;
    priority: number;
  }>;
  priceTypeId?: string;
  manualPriceTypeSelection?: boolean; // If true, price type was manually selected and should not be auto-updated
  /** Saved line qty reserved on server when editing an APPROVED quote (boost for stock ceiling). */
  approvedQuoteReservedQuantity?: number;
  stockError?: string;
  // [KIT INTEGRATION]
  type?: ProductType; // 'KIT' | 'STANDARD'
  kitItems?: POSKitItem[];
}
export interface SelectedEmployee {
  id: string;
  name: string;
  fullEmployeeObject?: EmployeeWithRelations;
}

export interface SelectedCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  customerType?: {
    id: string;
    name: string;
    description?: string | null;
  };
  priceTypes?: Array<{
    id: string;
    name: string;
    minQuantity: number;
    priority: number;
    description?: string | null;
    isActive: boolean;
  }>;
  creditAllowed?: boolean;
  creditLimit?: number;
}

export interface SelectedLocation {
  id: string;
  name: string;
  branchId: string | null;
  branchName: string;
}

export interface Payment {
  paymentType: string;
  provider?: string;
  amount: number;
  transactionReference?: string;
}

export function POSPage() {
  const { t } = useTranslation("pos");
  const queryClient = useQueryClient();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [discountCode, setDiscountCode] = useState("");
  const [discountCodeInfo, setDiscountCodeInfo] = useState<{
    id: string;
    discountType: "PERCENTAGE" | "FIXED";
    value: number;
    maxDiscount?: number;
  } | null>(null);
  const [manualOrderDiscount, setManualOrderDiscount] = useState(0);
  const [manualOrderDiscountPercentage, setManualOrderDiscountPercentage] =
    useState(0);
  const [includeTax, setIncludeTax] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [productSearchKey, setProductSearchKey] = useState(0);

  // Header selections
  const [selectedLocation, setSelectedLocation] = useState<LocationInfo | null>(
    null
  );
  const [selectedCashRegister, setSelectedCashRegister] =
    useState<CashRegister | null>(null);
  const [selectedCashier, setSelectedCashier] =
    useState<SelectedEmployee | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<SelectedEmployee | null>(
    null
  );
  const [selectedCustomer, setSelectedCustomer] =
    useState<SelectedCustomer | null>(null);
  const { toast } = useToast();
  const { data: userData, isLoading: isLoadingUser } = useCurrentUser();
  const isCashier = useHasRole("cashier");
  const isSalesRep = useHasRole("sales_rep");
  const isStoreManager = useHasRole("store_manager");
  const isAdmin = useHasRole("admin");
  const hasSalesRole = isAdmin || isStoreManager || isCashier || isSalesRep;
  const createOrderMutation = useCreateOrder();

  // Fetch cash session for the selected cash register
  const {
    data: selectedCashRegisterSession,
    isLoading: isLoadingCashSession,
    refetch: refetchCashSession,
  } = useCashSessionByCashRegisterId(selectedCashRegister?.id);

  const [isValidatingCart, setIsValidatingCart] = useState(false);
  const [isOpenCashModalOpen, setIsOpenCashModalOpen] = useState(false);
  const [pendingCashRegisterId, setPendingCashRegisterId] = useState<
    string | null
  >(null);
  const [pendingCashRegisterName, setPendingCashRegisterName] = useState<
    string | null
  >(null);
  const [isCloseCashModalOpen, setIsCloseCashModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const previousLocationIdRef = useRef<string | null>(null);
  const isSubmittingOrderRef = useRef(false);
  const dismissedCashRegisterIdRef = useRef<string | null>(null);
  const locationChangeInProgressRef = useRef(false);

  // Get open sessions for the selected location (used to check if cash register is open)
  const { data: openSessions } = useOpenCashSessionsByLocation(
    selectedLocation?.id
  );

  // Use the cash session from the selected cash register
  const effectiveCashSession = selectedCashRegisterSession;
  const { data: registersResponse } = useCashRegisters(
    selectedLocation?.id ? { locationId: selectedLocation.id } : undefined
  );

  useEffect(() => {
    if (
      registersResponse?.data &&
      registersResponse.data.length > 0 &&
      !selectedCashRegister
    ) {
      setSelectedCashRegister(registersResponse.data[0] || null);
    }
  }, [registersResponse, selectedCashRegister, setSelectedCashRegister]);

  // Clear selected cash register when location changes
  useEffect(() => {
    if (selectedLocation?.id !== previousLocationIdRef.current) {
      locationChangeInProgressRef.current = true;
      setSelectedCashRegister(null);
      // Close the modal if it's open when location changes
      setIsOpenCashModalOpen(false);
      setPendingCashRegisterId(null);
      setPendingCashRegisterName(null);
      previousLocationIdRef.current = selectedLocation?.id || null;
      // Reset dismissed cash register when location changes
      dismissedCashRegisterIdRef.current = null;
      // Reset the flag after a brief delay to allow effects to complete
      setTimeout(() => {
        locationChangeInProgressRef.current = false;
      }, 0);
    }
  }, [selectedLocation]);

  // Check if selected cash register is closed and show toast/open modal
  useEffect(() => {
    // Skip this check if we're in the middle of a location change
    if (locationChangeInProgressRef.current) {
      return;
    }

    if (selectedCashRegister && selectedLocation) {
      const isOpen = openSessions?.some(
        session =>
          session.cashRegisterId === selectedCashRegister.id &&
          session.status === "open"
      );

      // If cash register is closed (no open session), show toast and open modal
      // Only auto-open if:
      // 1. Modal is not already open
      // 2. This cash register hasn't been dismissed by the user
      // 3. It's a different cash register than the one that was dismissed
      const shouldAutoOpen =
        !isOpen &&
        selectedCashRegister.openSessionId == null &&
        !isOpenCashModalOpen &&
        dismissedCashRegisterIdRef.current !== selectedCashRegister.id;

      if (shouldAutoOpen) {
        // Show toast notification
        toast({
          type: "warning",
          title: t("errors.cashRegisterClosedTitle") || "Cash Register Closed",
          description:
            t("errors.cashRegisterClosed", {
              name: selectedCashRegister.name,
            }) ||
            `Cash register "${selectedCashRegister.name}" is closed. Please open a cash session.`,
        });
        setPendingCashRegisterId(selectedCashRegister.id);
        setPendingCashRegisterName(selectedCashRegister.name || "");
        setIsOpenCashModalOpen(true);
      } else if (isOpen) {
        // Reset dismissed flag when session opens
        dismissedCashRegisterIdRef.current = null;
      }
    }
  }, [
    selectedCashRegister,
    openSessions,
    isOpenCashModalOpen,
    selectedLocation,
    t,
    toast,
  ]);

  // Close the open cash modal when a session is detected after opening
  useEffect(() => {
    if (effectiveCashSession && isOpenCashModalOpen) {
      setIsOpenCashModalOpen(false);
      setPendingCashRegisterId(null);
      setPendingCashRegisterName(null);
      // Reset dismissed flag when session opens
      dismissedCashRegisterIdRef.current = null;
    }
  }, [effectiveCashSession, isOpenCashModalOpen]);

  // Auto-select location, seller and cashier from user's employee data
  useEffect(() => {
    if (!userData) return;

    const employee = userData.employee;
    if (employee?.id && hasSalesRole) {
      const person = employee.person;
      const fullNameFromPerson =
        person && `${person.firstName || ""} ${person.lastName || ""}`.trim();
      const displayName =
        fullNameFromPerson ||
        person?.email?.trim() ||
        userData.email?.trim() ||
        "Employee";

      if (!selectedCashier) {
        setSelectedCashier({
          id: employee.id,
          name: displayName,
        });
      }
      if (!selectedSeller) {
        setSelectedSeller({
          id: employee.id,
          name: displayName,
        });
      }
    }

    // Prefer top-level location; backend often only nests under employee.location
    const defaultLocation =
      userData.location ?? userData.employee?.location ?? null;
    const defaultBranch =
      userData.branch ?? userData.employee?.location?.branch ?? null;

    if (defaultLocation?.id && !selectedLocation) {
      const { branch: _nestedBranch, ...locationRest } =
        defaultLocation as LocationInfo & {
          branch?: { id: string; name: string; code?: string };
        };
      const branchId = locationRest.branchId ?? defaultBranch?.id ?? null;

      setSelectedLocation({
        ...locationRest,
        name: locationRest.name?.trim() || "Location",
        branchId,
      });
    }
  }, [
    userData,
    hasSalesRole,
    selectedCashier,
    selectedSeller,
    selectedLocation,
  ]);

  const handlePrintReceipt = () => {
    window.print();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F - Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[placeholder*="Search"]'
        );
        searchInput?.focus();
      }

      // Ctrl/Cmd + P - Print receipt (if receipt is open)
      if ((e.ctrlKey || e.metaKey) && e.key === "p" && isReceiptOpen) {
        e.preventDefault();
        handlePrintReceipt();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isReceiptOpen]);

  // Validate cart items when location changes
  useEffect(() => {
    // Skip validation if:
    // - No location selected
    // - No cart items
    // - Already validating (to prevent multiple simultaneous validations)
    // - Location hasn't actually changed (initial mount or same location)
    if (
      !selectedLocation?.id ||
      cartItems.length === 0 ||
      isValidatingCart ||
      previousLocationIdRef.current === selectedLocation.id
    ) {
      // Update ref even if we skip validation
      if (selectedLocation?.id) {
        previousLocationIdRef.current = selectedLocation.id;
      }
      return;
    }

    const validateCartItems = async () => {
      setIsValidatingCart(true);
      try {
        const { updatedItems, removedItems, adjustedItems } =
          await validateCartItemsAgainstStockLevels(
            cartItems,
            selectedLocation.id,
            getStockLevelsByProductVariantsAndLocation,
            {
              normalizeProduct: normalizeProductWithMetadata,
              selectPriceForQuantity,
            }
          );

        setCartItems(updatedItems);

        // Recalculate discounts after updating cart
        recalculatePercentageDiscounts(updatedItems);

        // Show notifications
        if (removedItems.length > 0) {
          toast({
            type: "warning",
            title: t("errors.itemsRemoved") || "Items Removed",
            description:
              t("errors.itemsRemovedDescription", {
                count: removedItems.length,
                items: removedItems.slice(0, 3).join(", "),
                more: removedItems.length > 3 ? removedItems.length - 3 : 0,
              }) ||
              `${removedItems.length} item(s) removed from cart due to insufficient stock: ${removedItems.slice(0, 3).join(", ")}${removedItems.length > 3 ? ` and ${removedItems.length - 3} more` : ""}`,
          });
        }

        if (adjustedItems.length > 0) {
          const firstItem = adjustedItems[0];
          if (firstItem) {
            toast({
              type: "warning",
              title: t("errors.itemsAdjusted") || "Items Adjusted",
              description:
                t("errors.itemsAdjustedDescription", {
                  count: adjustedItems.length,
                  itemName: firstItem.name,
                  oldQty: firstItem.oldQty,
                  newQty: firstItem.newQty,
                  more: adjustedItems.length > 1 ? adjustedItems.length - 1 : 0,
                }) ||
                `${adjustedItems.length} item(s) adjusted. ${firstItem.name}: ${firstItem.oldQty} → ${firstItem.newQty}`,
            });
          }
        }
      } catch (error) {
        console.error("Error validating cart items:", error);
        toast({
          type: "error",
          title: t("errors.validationError") || "Validation Error",
          description:
            t("errors.validationErrorDescription") ||
            "An error occurred while validating cart items. Please try again.",
        });
      } finally {
        setIsValidatingCart(false);
      }
    };

    // Only validate if location actually changed (not on initial mount)
    const timeoutId = setTimeout(() => {
      validateCartItems().then(() => {
        // Update ref after validation completes
        if (selectedLocation?.id) {
          previousLocationIdRef.current = selectedLocation.id;
        }
      });
    }, 100); // Small delay to debounce rapid location changes

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation?.id]);

  // Function to select the appropriate price based on customer price types and quantity
  // Uses shared utility function for consistent logic
  const selectPriceForQuantity = useCallback(
    (prices: CartItem["productPrices"], quantity: number) => {
      return selectPriceForQuantityUtil(
        prices || [],
        quantity,
        selectedCustomer
      );
    },
    [selectedCustomer]
  );

  // Helper function to recalculate percentage-based discounts
  const recalculatePercentageDiscounts = useCallback(
    (items: CartItem[]) => {
      const newSubtotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      // Recalculate discount code value if it's percentage-based
      if (discountCodeInfo && discountCodeInfo.discountType === "PERCENTAGE") {
        const newDiscountCodeValue = Number(
          ((newSubtotal * discountCodeInfo.value) / 100).toFixed(2)
        );
        const finalDiscountCodeValue =
          discountCodeInfo.maxDiscount &&
          newDiscountCodeValue > discountCodeInfo.maxDiscount
            ? Number(discountCodeInfo.maxDiscount.toFixed(2))
            : newDiscountCodeValue;
        // Note: The discount code info itself doesn't change, only the calculated value
        // The calculateTotals function will handle this automatically
      }

      // Recalculate manual order discount if it's percentage-based
      if (manualOrderDiscountPercentage > 0) {
        const newManualDiscount = Number(
          ((newSubtotal * manualOrderDiscountPercentage) / 100).toFixed(2)
        );
        setManualOrderDiscount(newManualDiscount);
      }
    },
    [discountCodeInfo, manualOrderDiscountPercentage]
  );

  // Update cart item prices when customer changes
  useEffect(() => {
    if (cartItems.length === 0) {
      return;
    }

    // Update prices for all cart items based on current customer
    const updatedItems = cartItems.map(item => {
      // Skip items with manual price type selection - user's choice takes priority
      if (item.manualPriceTypeSelection) {
        // If manually selected, keep the current priceTypeId but update price if needed
        if (
          item.priceTypeId &&
          item.productPrices &&
          item.productPrices.length > 0
        ) {
          const manualPrice = item.productPrices.find(
            p => p.priceTypeId === item.priceTypeId
          );
          if (manualPrice) {
            // Update price to match the manually selected price type
            const newItemSubtotal = manualPrice.price * item.quantity;
            let updatedDiscountAmount = item.discountAmount || 0;
            let updatedDiscountPercentage = item.discountPercentage || 0;

            if (item.discountPercentage && item.discountPercentage > 0) {
              updatedDiscountAmount = Number(
                ((newItemSubtotal * item.discountPercentage) / 100).toFixed(2)
              );
            } else if (item.discountAmount && item.discountAmount > 0) {
              updatedDiscountPercentage =
                newItemSubtotal > 0
                  ? Number(
                      ((item.discountAmount / newItemSubtotal) * 100).toFixed(2)
                    )
                  : 0;
            }

            return {
              ...item,
              price: manualPrice.price,
              discountAmount: updatedDiscountAmount,
              discountPercentage: updatedDiscountPercentage,
            };
          }
        }
        // If manual price type not found, keep item as is
        return item;
      }

      if (!item.productPrices || item.productPrices.length === 0) {
        return item;
      }

      const selectedPrice = selectPriceForQuantity(
        item.productPrices,
        item.quantity
      );

      if (selectedPrice) {
        // Recalculate item-level percentage discounts if price changed
        let updatedDiscountAmount = item.discountAmount || 0;
        let updatedDiscountPercentage = item.discountPercentage || 0;

        if (item.discountPercentage && item.discountPercentage > 0) {
          // If percentage discount exists, recalculate amount based on new price and quantity
          const newItemSubtotal = selectedPrice.price * item.quantity;
          updatedDiscountAmount = Number(
            ((newItemSubtotal * item.discountPercentage) / 100).toFixed(2)
          );
          updatedDiscountPercentage = item.discountPercentage;
        } else if (item.discountAmount && item.discountAmount > 0) {
          // If only fixed discount amount exists, recalculate percentage based on new price and quantity
          const newItemSubtotal = selectedPrice.price * item.quantity;
          updatedDiscountPercentage =
            newItemSubtotal > 0
              ? Number(
                  ((item.discountAmount / newItemSubtotal) * 100).toFixed(2)
                )
              : 0;
          // Keep the fixed discount amount as is
          updatedDiscountAmount = item.discountAmount;
        }

        return {
          ...item,
          price: selectedPrice.price,
          priceTypeId: selectedPrice.priceTypeId,
          discountAmount: updatedDiscountAmount,
          discountPercentage: updatedDiscountPercentage,
        };
      }

      return item;
    });

    // Only update if prices actually changed to avoid unnecessary re-renders
    const hasChanges = updatedItems.some((updatedItem, index) => {
      const originalItem = cartItems[index];
      if (!originalItem) return false;
      return (
        updatedItem.price !== originalItem.price ||
        updatedItem.priceTypeId !== originalItem.priceTypeId ||
        updatedItem.discountAmount !== originalItem.discountAmount ||
        updatedItem.discountPercentage !== originalItem.discountPercentage
      );
    });

    if (hasChanges) {
      setCartItems(updatedItems);
      // Recalculate percentage-based discounts after price update
      recalculatePercentageDiscounts(updatedItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedCustomer,
    selectPriceForQuantity,
    recalculatePercentageDiscounts,
  ]);

  const handleAddToCart = useCallback(
    (product: any, quantity?: number, priceTypeId?: string) => {
      const existingItem = cartItems.find(
        item => item.productVariantId === product.id
      );

      // [CRITICAL FIX] Use injected availableStock (for kits) or fallback to stockLevel
      const realStock =
        product.availableStock ?? product.stockLevel?.available ?? 0;

      // [KIT INTEGRATION] check stock for each kit component before adding
      if (
        product.product?.type === "KIT" &&
        Array.isArray(product.product?.kitItems)
      ) {
        const kitItems = product.product.kitItems;
        let initialQuantity = existingItem
          ? existingItem.quantity +
            (product.multiple && product.multiple > 0 ? product.multiple : 1)
          : product.multiple && product.multiple > 0
            ? product.multiple
            : 1;

        const insufficientComponent = kitItems.find(
          (kitItem: { availableStock: number; quantity: number }) => {
            if (typeof kitItem.availableStock === "number") {
              return (
                kitItem.availableStock < kitItem.quantity * initialQuantity
              );
            }
            return false;
          }
        );

        if (insufficientComponent) {
          toast({
            type: "error",
            title: t("errors.insufficientStock"),
            description:
              t("errors.insufficientStockKitDescription", {
                kitName: product.name || product.product.name,
                componentName:
                  insufficientComponent.name ||
                  insufficientComponent.productVariantId,
                required: insufficientComponent.quantity * initialQuantity,
                available: insufficientComponent.availableStock,
              }) ||
              `No hay suficiente stock de ${insufficientComponent.name || insufficientComponent.productVariantId} para el kit.`,
          });
          return;
        }
      }

      if (existingItem) {
        // If quantity is provided, use it; otherwise add the default increment
        let newQuantity =
          quantity !== undefined
            ? existingItem.quantity + quantity
            : existingItem.quantity +
              (product.multiple && product.multiple > 0 ? product.multiple : 1);

        // Check if we can add more (using the availableStock already in the item)
        if (newQuantity > existingItem.availableStock) {
          toast({
            type: "error",
            title: t("errors.insufficientStock"),
            description: t("errors.insufficientStockDescription", {
              quantity: existingItem.availableStock,
              productName: product.name || product.product.name,
            }),
          });
          newQuantity = existingItem.availableStock;
          return;
        }

        // Recalculate price based on new quantity
        // If price type was manually selected, keep it and only update price
        let newPrice = existingItem.price;
        let newPriceTypeId = existingItem.priceTypeId;

        if (
          existingItem.productPrices &&
          existingItem.productPrices.length > 0
        ) {
          if (
            existingItem.manualPriceTypeSelection &&
            existingItem.priceTypeId
          ) {
            // User manually selected price type - keep it and update price only
            const manualPrice = existingItem.productPrices.find(
              p => p.priceTypeId === existingItem.priceTypeId
            );
            if (manualPrice) {
              newPrice = manualPrice.price;
              // Keep the manually selected priceTypeId
            }
          } else {
            // Auto-select price based on quantity
            const selectedPrice = selectPriceForQuantity(
              existingItem.productPrices,
              newQuantity
            );
            if (selectedPrice) {
              newPrice = selectedPrice.price;
              newPriceTypeId = selectedPrice.priceTypeId;
            }
          }
        }

        const updatedItems = cartItems.map(item =>
          item.productVariantId === product.id
            ? {
                ...item,
                quantity: newQuantity,
                price: newPrice,
                ...(newPriceTypeId && { priceTypeId: newPriceTypeId }),
              }
            : item
        );
        setCartItems(updatedItems);
        // Recalculate percentage-based discounts after quantity/price update
        recalculatePercentageDiscounts(updatedItems);
      } else {
        // [CRITICAL FIX] Check if product has stock using REAL STOCK
        if (realStock <= 0) {
          toast({
            type: "error",
            title: t("errors.outOfStock"),
            description: t("errors.outOfStockDescription", {
              productName: product.name || product.product.name,
            }),
          });
          return;
        }

        // Use provided priceTypeId to find price, or selectedPrice, or fallback to first price
        let priceToUse = 0;
        let selectedPriceTypeId: string | undefined;

        if (priceTypeId && product.prices) {
          const selectedPrice = product.prices.find(
            (p: any) => p.priceTypeId === priceTypeId
          );
          if (selectedPrice) {
            priceToUse = selectedPrice.price;
            selectedPriceTypeId = priceTypeId;
          }
        }

        if (priceToUse === 0) {
          // Fallback to selectedPrice or first price
          priceToUse =
            product.selectedPrice?.price || product.prices[0]?.price || 0;
          selectedPriceTypeId =
            product.selectedPrice?.priceTypeId ||
            product.prices[0]?.priceTypeId;
        }

        // Use provided quantity, or if product has multiple, set initial quantity to the multiple value
        let initialQuantity =
          quantity !== undefined
            ? quantity
            : product.multiple && product.multiple > 0
              ? product.multiple
              : 1;

        if (initialQuantity > realStock) {
          initialQuantity = realStock;
        }

        const productData = product.product as any;
        const primaryImageUrl =
          productData?.primaryImageUrl ?? productData?.images?.[0]?.url;
        const newItem: CartItem = {
          id: product.id,
          productVariantId: product.id,
          name: product.name || product.product.name,
          brand: product.product?.brand?.name || "Unknown",
          sku: product.sku || "",
          barcode: product.barcode || null,
          price: priceToUse,
          quantity: initialQuantity,
          type: product.product?.type,
          kitItems: product.kitItems ?? product.product?.kitItems,
          availableStock: realStock, // real stock
          discountAmount: 0,
          multiple: product.multiple || null,
          productPrices: product.prices,
          ...(primaryImageUrl && { image: primaryImageUrl }),
          ...(selectedPriceTypeId && {
            priceTypeId: selectedPriceTypeId,
            // Mark as manual if priceTypeId was explicitly provided
            manualPriceTypeSelection: !!priceTypeId,
          }),
          product: {},
        };

        const updatedItems = [...cartItems, newItem];
        setCartItems(updatedItems);
        // Recalculate percentage-based discounts after adding new item
        recalculatePercentageDiscounts(updatedItems);
      }
    },
    [
      cartItems,
      toast,
      selectPriceForQuantity,
      recalculatePercentageDiscounts,
      t,
    ]
  );

  const handleRemoveItem = useCallback(
    (productVariantId: string) => {
      const updatedItems = cartItems.filter(
        item => item.productVariantId !== productVariantId
      );
      setCartItems(updatedItems);
      // Recalculate percentage-based discounts after removing item
      recalculatePercentageDiscounts(updatedItems);
    },
    [cartItems, toast, recalculatePercentageDiscounts]
  );

  const handleUpdateQuantity = useCallback(
    (productVariantId: string, quantity: number) => {
      if (quantity <= 0) {
        handleRemoveItem(productVariantId);
        return;
      }

      const updatedItems = cartItems.map(item => {
        if (item.productVariantId === productVariantId) {
          // [KIT INTEGRATION] check stock for each kit component before updating quantity
          if (item.type === "KIT" && Array.isArray(item.kitItems)) {
            // validate stock for each kit component
            const insufficientComponent = item.kitItems.find(kitItem => {
              if (typeof kitItem.availableStock === "number") {
                return kitItem.availableStock < kitItem.quantity * quantity;
              }
              return false;
            });

            if (insufficientComponent) {
              toast({
                type: "error",
                title: t("errors.insufficientStock"),
                description:
                  t("errors.insufficientStockKitDescription", {
                    kitName: item.name,
                    componentName:
                      insufficientComponent.name ||
                      insufficientComponent.productVariantId,
                    required: insufficientComponent.quantity * quantity,
                    available: insufficientComponent.availableStock,
                  }) ||
                  `No hay suficiente stock de ${insufficientComponent.name || insufficientComponent.productVariantId} para el kit.`,
              });
              // do not update quantity IF insufficient stock
              return item;
            }
          }

          // Validate quantity is a multiple of the product's multiple value
          let validatedQuantity = quantity;
          if (item.multiple && item.multiple > 0) {
            // Round down to nearest multiple
            validatedQuantity =
              Math.floor(quantity / item.multiple) * item.multiple;
            // Ensure at least one multiple
            if (validatedQuantity < item.multiple) {
              validatedQuantity = item.multiple;
            }
          }

          const newQuantity = Math.min(validatedQuantity, item.availableStock);

          // Recalculate price based on new quantity
          // If price type was manually selected, keep it and only update price
          let newPrice = item.price;
          let newPriceTypeId = item.priceTypeId;

          if (item.productPrices && item.productPrices.length > 0) {
            if (item.manualPriceTypeSelection && item.priceTypeId) {
              // User manually selected price type - keep it and update price only
              const manualPrice = item.productPrices.find(
                p => p.priceTypeId === item.priceTypeId
              );
              if (manualPrice) {
                newPrice = manualPrice.price;
                // Keep the manually selected priceTypeId
              }
            } else {
              // Auto-select price based on quantity
              const selectedPrice = selectPriceForQuantity(
                item.productPrices,
                newQuantity
              );
              if (selectedPrice) {
                newPrice = selectedPrice.price;
                newPriceTypeId = selectedPrice.priceTypeId;
              }
            }
          }

          // Recalculate item discount based on new quantity and price
          const newItemSubtotal = newPrice * newQuantity;
          let updatedDiscountAmount = item.discountAmount || 0;
          let updatedDiscountPercentage = item.discountPercentage || 0;

          if (item.discountPercentage && item.discountPercentage > 0) {
            // If percentage discount exists, recalculate amount based on new subtotal
            updatedDiscountAmount = Number(
              ((newItemSubtotal * item.discountPercentage) / 100).toFixed(2)
            );
            updatedDiscountPercentage = item.discountPercentage;
          } else if (item.discountAmount && item.discountAmount > 0) {
            // If only fixed discount amount exists, recalculate percentage based on new subtotal
            updatedDiscountPercentage =
              newItemSubtotal > 0
                ? Number(
                    ((item.discountAmount / newItemSubtotal) * 100).toFixed(2)
                  )
                : 0;
            // Keep the fixed discount amount as is
            updatedDiscountAmount = item.discountAmount;
          }

          // Clear error when quantity is updated by omitting stockError
          const { stockError, ...itemWithoutError } = item;
          return {
            ...itemWithoutError,
            quantity: newQuantity,
            price: newPrice,
            ...(newPriceTypeId && { priceTypeId: newPriceTypeId }),
            discountAmount: updatedDiscountAmount,
            discountPercentage: updatedDiscountPercentage,
          };
        }
        return item;
      });

      setCartItems(updatedItems);

      // Recalculate percentage-based discounts after quantity/price update
      recalculatePercentageDiscounts(updatedItems);
    },
    [
      cartItems,
      handleRemoveItem,
      selectPriceForQuantity,
      recalculatePercentageDiscounts,
      toast,
      t,
    ]
  );

  const handleUpdateItemDiscount = useCallback(
    (productVariantId: string, discountAmount: number) => {
      const { clampedDiscountAmount, shouldShowWarning } =
        validateItemDiscountAmount(
          discountAmount,
          cartItems,
          productVariantId,
          discountCodeInfo,
          manualOrderDiscount
        );

      if (shouldShowWarning) {
        toast({
          type: "warning",
          title: t("errors.discountExceedsSubtotal") || "Discount Too High",
          description:
            t("errors.itemDiscountExceedsSubtotalDescription", {
              max: clampedDiscountAmount.toFixed(2),
            }) ||
            `Item discount cannot exceed item subtotal or total invoice amount. Maximum allowed: ${CURRENCY_SIGN}${clampedDiscountAmount.toFixed(2)}`,
        });
      }

      setCartItems(
        cartItems.map(item => {
          if (item.productVariantId === productVariantId) {
            const itemSubtotal = item.price * item.quantity;
            const discountPercentage =
              itemSubtotal > 0
                ? Number(
                    ((clampedDiscountAmount / itemSubtotal) * 100).toFixed(2)
                  )
                : 0;
            return {
              ...item,
              discountAmount: clampedDiscountAmount,
              discountPercentage,
            };
          }
          return item;
        })
      );
    },
    [cartItems, discountCodeInfo, manualOrderDiscount, toast, t]
  );

  const handleUpdateItemDiscountPercentage = useCallback(
    (productVariantId: string, discountPercentage: number) => {
      const { clampedPercentage, clampedDiscountAmount, shouldShowWarning } =
        validateItemDiscountPercentage(
          discountPercentage,
          cartItems,
          productVariantId,
          discountCodeInfo,
          manualOrderDiscount
        );

      if (shouldShowWarning) {
        toast({
          type: "warning",
          title: t("errors.discountExceedsSubtotal") || "Discount Too High",
          description:
            t("errors.itemDiscountExceedsSubtotalDescription", {
              max: clampedDiscountAmount.toFixed(2),
            }) ||
            `Item discount cannot exceed item subtotal or total invoice amount. Maximum allowed: ${CURRENCY_SIGN}${clampedDiscountAmount.toFixed(2)}`,
        });
      }

      setCartItems(
        cartItems.map(item => {
          if (item.productVariantId === productVariantId) {
            return {
              ...item,
              discountPercentage: clampedPercentage,
              discountAmount: clampedDiscountAmount,
            };
          }
          return item;
        })
      );
    },
    [cartItems, discountCodeInfo, manualOrderDiscount, toast, t]
  );

  const handleUpdatePriceType = useCallback(
    (productVariantId: string, priceTypeId: string) => {
      const updatedItems = cartItems.map(item => {
        if (item.productVariantId === productVariantId) {
          if (!item.productPrices || item.productPrices.length === 0) {
            return item;
          }

          // Find the selected price type
          const selectedPrice = item.productPrices.find(
            p => p.priceTypeId === priceTypeId
          );

          if (!selectedPrice) {
            return item;
          }

          // Recalculate item discount based on new price and quantity
          const newItemSubtotal = selectedPrice.price * item.quantity;
          let updatedDiscountAmount = item.discountAmount || 0;
          let updatedDiscountPercentage = item.discountPercentage || 0;

          if (item.discountPercentage && item.discountPercentage > 0) {
            // If percentage discount exists, recalculate amount based on new price and quantity
            updatedDiscountAmount = Number(
              ((newItemSubtotal * item.discountPercentage) / 100).toFixed(2)
            );
            updatedDiscountPercentage = item.discountPercentage;
          } else if (item.discountAmount && item.discountAmount > 0) {
            // If only fixed discount amount exists, recalculate percentage based on new price and quantity
            updatedDiscountPercentage =
              newItemSubtotal > 0
                ? Number(
                    ((item.discountAmount / newItemSubtotal) * 100).toFixed(2)
                  )
                : 0;
            // Keep the fixed discount amount as is
            updatedDiscountAmount = item.discountAmount;
          }

          return {
            ...item,
            price: selectedPrice.price,
            priceTypeId: selectedPrice.priceTypeId,
            discountAmount: updatedDiscountAmount,
            discountPercentage: updatedDiscountPercentage,
          };
        }
        return item;
      });

      setCartItems(updatedItems);
      // Recalculate percentage-based discounts after price type update
      recalculatePercentageDiscounts(updatedItems);
    },
    [cartItems, recalculatePercentageDiscounts]
  );

  // Check if cart has items with insufficient stock
  const hasInsufficientStock = useCallback(() => {
    return cartItems.some(
      item => item.quantity > item.availableStock || item.stockError
    );
  }, [cartItems]);

  const calculateTotals = useCallback(() => {
    // Calculate items subtotal (before discounts)
    const itemsSubtotal = Number(
      cartItems
        .reduce((sum, item) => {
          return sum + item.price * item.quantity;
        }, 0)
        .toFixed(2)
    );

    const itemsDiscountTotal = calculateItemsDiscountTotal(cartItems);

    // Calculate discount code value based on subtotal (for percentage discounts)
    let discountCodeValue = 0;
    if (discountCodeInfo) {
      if (discountCodeInfo.discountType === "PERCENTAGE") {
        discountCodeValue = Number(
          ((itemsSubtotal * discountCodeInfo.value) / 100).toFixed(2)
        );
        // Apply max discount if set
        if (
          discountCodeInfo.maxDiscount &&
          discountCodeValue > discountCodeInfo.maxDiscount
        ) {
          discountCodeValue = Number(discountCodeInfo.maxDiscount.toFixed(2));
        }
      } else {
        // FIXED discount
        discountCodeValue = Number(discountCodeInfo.value.toFixed(2));
      }
    }

    // Calculate order discount (discount code value + manual order discount)
    const orderDiscount = Number(
      (discountCodeValue + manualOrderDiscount).toFixed(2)
    );

    // Calculate total discount (order discount + items discount total)
    let totalDiscount = Number((orderDiscount + itemsDiscountTotal).toFixed(2));

    // Prevent discounts from exceeding subtotal (clamp to prevent negative totals)
    if (totalDiscount > itemsSubtotal) {
      totalDiscount = itemsSubtotal;
    }

    // Apply discounts to subtotal
    const subtotalAfterDiscounts = Number(
      (itemsSubtotal - totalDiscount).toFixed(2)
    );

    // Calculate taxes (15% default)
    const taxes = includeTax
      ? Number((subtotalAfterDiscounts * DEFAULT_TAX_RATE).toFixed(2))
      : 0;

    // Calculate total
    const totalAmount = Number((subtotalAfterDiscounts + taxes).toFixed(2));

    return {
      subtotal: itemsSubtotal,
      itemsDiscountTotal,
      orderDiscount,
      discountCodeValue,
      manualOrderDiscount,
      discountAmount: totalDiscount,
      taxes,
      totalAmount,
    };
  }, [cartItems, discountCodeInfo, manualOrderDiscount, includeTax]);

  const handleCheckout = useCallback(() => {
    // Prevent opening checkout if mutation is already in progress
    if (createOrderMutation.isPending || isSubmittingOrderRef.current) {
      return;
    }

    if (cartItems.length === 0) {
      toast({
        type: "error",
        title: t("errors.cartEmpty"),
        description: t("errors.cartEmptyDescription"),
      });
      return;
    }

    if (!selectedLocation) {
      toast({
        type: "error",
        title: t("errors.locationRequired"),
        description: t("errors.locationRequiredDescription"),
      });
      return;
    }

    if (!selectedCashier) {
      toast({
        type: "error",
        title: t("errors.cashierRequired"),
        description: t("errors.cashierRequiredDescription"),
      });
      return;
    }

    // Block POS usage if no cash session is open
    if (!effectiveCashSession) {
      toast({
        type: "error",
        title: t("errors.noCashSession"),
        description: t("errors.noCashSessionMessage"),
      });
      setIsOpenCashModalOpen(true);
      return;
    }

    // Check for insufficient stock before opening checkout modal
    if (hasInsufficientStock()) {
      toast({
        type: "error",
        title: t("errors.insufficientStockAtCheckout") || "Insufficient Stock",
        description:
          t("errors.insufficientStockAtCheckoutGeneric") ||
          "One or more items in your cart have insufficient stock. Please adjust quantities or remove items before checkout.",
      });
      return;
    }

    setIsCheckoutOpen(true);
  }, [
    cartItems,
    selectedLocation,
    selectedCashier,
    effectiveCashSession,
    createOrderMutation.isPending,
    hasInsufficientStock,
    toast,
    t,
  ]);

  const resetCart = useCallback(() => {
    setCartItems([]);
    setDiscountCodeInfo(null);
    setManualOrderDiscount(0);
    setManualOrderDiscountPercentage(0);
    setDiscountCode("");
    setSelectedCustomer(null);
    // Reset ProductSearch by incrementing key
    setProductSearchKey(prev => prev + 1);
  }, []);

  const handleConfirmSale = async (
    payments: Payment[],
    creditData?: {
      creditType: "SHORT_TERM" | "EMPLOYEE_CREDIT" | "PROMOTIONAL";
      paymentFrequency: "WEEKLY" | "BI_WEEKLY" | "MONTHLY";
      durationDays: number;
      firstDueDate: string;
      initialPayment: number;
    }
  ) => {
    // Prevent duplicate submissions using both mutation state and ref guard
    if (
      createOrderMutation.isPending ||
      isSubmittingOrderRef.current ||
      isSubmittingOrder
    ) {
      return;
    }

    // Set ref and state to prevent concurrent submissions and show loading state
    isSubmittingOrderRef.current = true;
    setIsSubmittingOrder(true);

    let updatedCartItems: CartItem[] = [];

    try {
      const totals = calculateTotals();

      // Determine payment method
      const paymentMethod = creditData ? "CREDIT" : "CASH";

      // Validate cash session is open (required only for CASH payment method)
      // Use effectiveCashSession which includes shared sessions at the location
      if (paymentMethod === "CASH" && !effectiveCashSession) {
        // Reset ref and state since we're returning early
        isSubmittingOrderRef.current = false;
        setIsSubmittingOrder(false);
        toast({
          title: t("errors.noCashSession"),
          description: t("errors.noCashSessionMessage"),
          type: "error",
        });
        setIsOpenCashModalOpen(true);
        return;
      }
      const hasCashPayment = payments.some(
        p => p.paymentType === "CASH" || p.paymentType === "DOWN_PAYMENT"
      );

      // Pre-checkout stock validation: Refresh stock levels before submitting order
      if (!selectedLocation?.id || cartItems.length === 0) {
        isSubmittingOrderRef.current = false;
        setIsSubmittingOrder(false);
        return;
      }

      try {
        // --- STAGE 1: IDENTIFY ALL REQUIRED IDS ---
        const allRequiredVariantIds = new Set<string>();
        cartItems.forEach(item => {
          const normalized = normalizeProductWithMetadata(item);
          allRequiredVariantIds.add(item.productVariantId);
          if (normalized.type === "KIT" && Array.isArray(normalized.kitItems)) {
            normalized.kitItems.forEach((ki: any) => {
              allRequiredVariantIds.add(ki.productVariantId);
            });
          }
        });

        // --- STAGE 2: BATCH FETCH ALL STOCK LEVELS ---
        const stockLevels = await getStockLevelsByProductVariantsAndLocation(
          Array.from(allRequiredVariantIds),
          selectedLocation.id
        );
        const stockMap = new Map(
          stockLevels.map(sl => [
            sl.productVariantId || "",
            Number(sl.quantity || 0) - Number(sl.reserved || 0),
          ])
        );

        // --- STAGE 3: VALIDATE CART ITEMS AGAINST FRESH STOCK ---
        const itemsWithInsufficientStock: Array<{
          item: CartItem;
          availableStock: number;
          requested: number;
        }> = [];

        updatedCartItems = cartItems.map(item => {
          const normalized = normalizeProductWithMetadata(item);
          let finalAvailableStock = 0;
          let currentUpdatedKitItems = item.kitItems;

          if (normalized.type === "KIT" && Array.isArray(normalized.kitItems)) {
            let minBuildable = Infinity;
            currentUpdatedKitItems = normalized.kitItems.map((kitItem: any) => {
              const componentStock =
                stockMap.get(kitItem.productVariantId) ?? 0;
              const buildableWithThis = Math.floor(
                componentStock / (kitItem.quantity || 1)
              );
              if (buildableWithThis < minBuildable) {
                minBuildable = buildableWithThis;
              }
              return { ...kitItem, availableStock: componentStock };
            });
            finalAvailableStock = minBuildable === Infinity ? 0 : minBuildable;
          } else {
            finalAvailableStock = stockMap.get(item.productVariantId) ?? 0;
          }

          if (item.quantity > finalAvailableStock) {
            itemsWithInsufficientStock.push({
              item,
              availableStock: finalAvailableStock,
              requested: item.quantity,
            });
          }

          const updatedItem: CartItem = {
            ...item,
            availableStock: finalAvailableStock,
            ...(currentUpdatedKitItems && { kitItems: currentUpdatedKitItems }),
          };

          if (item.quantity <= finalAvailableStock) {
            delete updatedItem.stockError;
          } else {
            updatedItem.stockError =
              t("errors.insufficientStockAtCheckoutDescription", {
                productName: item.name,
                available: finalAvailableStock.toString(),
                requested: item.quantity.toString(),
              }) ||
              `Insufficient stock for ${item.name}. Available: ${finalAvailableStock}, Requested: ${item.quantity}.`;
          }
          return updatedItem;
        });

        // If any items have insufficient stock, update cart and show error
        if (itemsWithInsufficientStock.length > 0) {
          setCartItems(updatedCartItems);

          const firstError = itemsWithInsufficientStock[0];
          if (!firstError) {
            isSubmittingOrderRef.current = false;
            setIsSubmittingOrder(false);
            return;
          }

          const errorMessage =
            itemsWithInsufficientStock.length === 1
              ? t("errors.insufficientStockAtCheckoutDescription", {
                  productName: firstError.item.name,
                  available: firstError.availableStock.toString(),
                  requested: firstError.requested.toString(),
                }) ||
                `Insufficient stock for ${firstError.item.name}. Available: ${firstError.availableStock}, Requested: ${firstError.requested}. Please adjust the quantity or remove the item.`
              : t("errors.insufficientStockAtCheckoutGeneric") ||
                `Multiple items have insufficient stock. Please review your cart and adjust quantities.`;

          toast({
            type: "error",
            title:
              t("errors.insufficientStockAtCheckout") || "Insufficient Stock",
            description: errorMessage,
          });

          isSubmittingOrderRef.current = false;
          setIsSubmittingOrder(false);
          return;
        }

        // Update cart items with latest stock levels (even if all are valid)
        setCartItems(updatedCartItems);
      } catch (validationError) {
        console.error(
          "Error during pre-checkout stock validation:",
          validationError
        );
        // If validation fails, use original cart items for submission
        updatedCartItems = [...cartItems];
      }

      // Create order via server action
      // Store all discount values calculated in the frontend
      let discountCodeValue = 0;
      if (discountCodeInfo) {
        if (discountCodeInfo.discountType === "PERCENTAGE") {
          discountCodeValue = Number(
            ((totals.subtotal * discountCodeInfo.value) / 100).toFixed(2)
          );
          // Apply max discount if set
          if (
            discountCodeInfo.maxDiscount &&
            discountCodeValue > discountCodeInfo.maxDiscount
          ) {
            discountCodeValue = Number(discountCodeInfo.maxDiscount.toFixed(2));
          }
        } else {
          // FIXED discount
          discountCodeValue = Number(discountCodeInfo.value.toFixed(2));
        }
      }

      const orderData: CreateOrderRequest = {
        ...(selectedCustomer?.id && { customerId: selectedCustomer.id }),
        ...(selectedLocation?.branchId && {
          branchId: selectedLocation.branchId,
        }),
        locationId: selectedLocation!.id,
        ...(selectedSeller?.id && { sellerId: selectedSeller.id }),
        cashierId: selectedCashier!.id,
        ...(discountCodeInfo?.id && { discountCodeId: discountCodeInfo.id }),
        ...(discountCodeValue > 0 && { discountCodeValue }),
        ...(manualOrderDiscount > 0 && { manualDiscount: manualOrderDiscount }),
        itemsDiscountTotal: totals.itemsDiscountTotal,
        discountAmount: totals.discountAmount, // Total discount (all discounts combined)
        includeTax,
        paymentMethod,
        ...(hasCashPayment &&
          effectiveCashSession && { cashSessionId: effectiveCashSession.id }),
        items: updatedCartItems.map(item => ({
          productVariantId: item.productVariantId,
          ...(item.priceTypeId && { priceTypeId: item.priceTypeId }),
          quantity: item.quantity,
          unitPrice: item.price,
          discountAmount: lineDiscountAmountForCartItem(item),
        })),
        payments,
        // Credit-related fields
        ...(creditData && {
          creditType: creditData.creditType,
          paymentFrequency: creditData.paymentFrequency,
          durationDays: creditData.durationDays,
          firstDueDate: creditData.firstDueDate,
          initialPayment: creditData.initialPayment,
        }),
      };

      const order = await createOrderMutation.mutateAsync(orderData);

      setLastOrder(order);
      setIsCheckoutOpen(false);
      setIsReceiptOpen(true);

      // Reset cart
      resetCart();

      // Invalidate product variant search queries to refresh inventory data
      queryClient.invalidateQueries({
        queryKey: productVariantKeys.searches(),
      });

      toast({
        type: "success",
        title: t("errors.saleCompleted"),
        description: t("errors.saleCompletedDescription", {
          orderNumber: order.orderNumber,
        }),
      });
    } catch (error: any) {
      // Extract error message from various possible formats
      let errorMessage = error?.response?.message || error?.message || "";
      const prefixMatch = errorMessage.match(/^API Error: \d+ - (.+)$/);
      if (prefixMatch && prefixMatch[1]) {
        errorMessage = prefixMatch[1];
      }

      const isStockError =
        errorMessage.toLowerCase().includes("insufficient stock") ||
        error?.status === 409 ||
        error?.response?.statusCode === 409;

      if (isStockError) {
        const stockMatch = errorMessage.match(
          /Insufficient stock for (.+?)\. Available: (\d+), Requested: (\d+)/i
        );

        if (stockMatch && stockMatch[1] && stockMatch[2] && stockMatch[3]) {
          const [, productName, available, requested] = stockMatch;

          //  Deep Search: Find if the failing product is a component inside a Kit
          const matchingItem = cartItems.find(item => {
            if (item.name === productName.trim()) return true; // Standard product check
            if (item.type === "KIT" && Array.isArray(item.kitItems)) {
              // Deep search inside kit components
              return item.kitItems.some(
                ki => ki.productVariant?.name === productName.trim()
              );
            }
            return false;
          });

          if (matchingItem) {
            // Always show the main item's name (e.g., the Kit's name) to the user
            const errorDescription = t(
              "errors.insufficientStockAtCheckoutDescription",
              {
                productName: matchingItem.name,
                available,
                requested,
              }
            );

            toast({
              type: "error",
              title:
                t("errors.insufficientStockAtCheckout") || "Insufficient Stock",
              description: errorDescription,
            });

            setCartItems(prevItems =>
              prevItems.map(item =>
                item.productVariantId === matchingItem.productVariantId
                  ? {
                      ...item,
                      stockError: errorDescription,
                      // If it's a standard item, update to physical stock; if kit, keep buildable stock
                      availableStock:
                        item.type === "KIT"
                          ? item.availableStock
                          : Number.parseInt(available, 10),
                    }
                  : item
              )
            );
            // Early return to prevent generic error messages from showing
            return;
          }
        }

        // Generic fallback if we can't identify the specific failing item from the error message
        const genericError =
          errorMessage ||
          t("errors.insufficientStockAtCheckoutGeneric") ||
          "One or more items in your cart have insufficient stock. Please review your cart and try again.";

        toast({
          type: "error",
          title:
            t("errors.insufficientStockAtCheckout") || "Insufficient Stock",
          description: genericError,
        });

        // Mark all cart items with a generic error as a last resort
        setCartItems(prevItems =>
          prevItems.map(item => ({
            ...item,
            stockError: genericError,
          }))
        );
      } else {
        // Handle other non-stock errors
        toast({
          type: "error",
          title: t("errors.error") || "Error",
          description:
            errorMessage ||
            t("errors.errorDescription") ||
            "An error occurred while processing your request.",
        });
      }
    } finally {
      // Reset ref and state after operation completes (success or error)
      isSubmittingOrderRef.current = false;
      setIsSubmittingOrder(false);
    }
  };

  const handleNewSale = () => {
    setIsReceiptOpen(false);
    setLastOrder(null);
    setSelectedSeller(null);
  };

  // Show loading state only on initial user load (not during cash session refetches)
  // Cash session loading happens in the background and shouldn't block the UI
  if (isLoadingUser) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-lg dark:bg-gray-800">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#ff48b0]" />
          <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
            {t("common.loading") || "Loading..."}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col">
      <POSHeader
        selectedLocation={selectedLocation}
        onSelectLocation={setSelectedLocation}
        locationSelectDisabled={isCashier}
        selectedCashRegister={selectedCashRegister}
        onSelectCashRegister={setSelectedCashRegister}
        currentSession={
          selectedCashRegisterSession
            ? {
                employeeId: selectedCashRegisterSession.employeeId,
                ...(selectedCashRegister?.name
                  ? {
                      cashRegister: {
                        name: selectedCashRegister.name,
                      },
                    }
                  : {}),
              }
            : undefined
        }
        showCashRegisterSelect={true}
        selectedCashier={selectedCashier}
        onSelectCashier={setSelectedCashier}
        selectedSeller={selectedSeller}
        sellerSelectDisabled={false}
        onSelectSeller={setSelectedSeller}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={setSelectedCustomer}
        cashRegisterOptions={
          effectiveCashSession ? (
            <CashRegisterOptions
              cashSessionStatus={
                effectiveCashSession.status === "open" ? "open" : "closed"
              }
              onCloseCashRegister={() => setIsCloseCashModalOpen(true)}
              onCreateMovement={() => setIsMovementModalOpen(true)}
              onOpenCashRegister={() => {
                if (selectedCashRegister) {
                  setPendingCashRegisterId(selectedCashRegister.id);
                  setPendingCashRegisterName(selectedCashRegister.name || "");
                  setIsOpenCashModalOpen(true);
                }
              }}
            />
          ) : (
            <CashRegisterOptions
              cashSessionStatus={selectedCashRegister ? "closed" : null}
              onCloseCashRegister={() => setIsCloseCashModalOpen(true)}
              onCreateMovement={() => setIsMovementModalOpen(true)}
              onOpenCashRegister={() => {
                if (selectedCashRegister) {
                  setPendingCashRegisterId(selectedCashRegister.id);
                  setPendingCashRegisterName(selectedCashRegister.name || "");
                  setIsOpenCashModalOpen(true);
                }
              }}
            />
          )
        }
      />

      <div className="flex flex-1 flex-col gap-0 overflow-hidden lg:grid lg:grid-cols-[1fr,400px] xl:grid-cols-[1fr,480px]">
        {/* Product Search - Full width on mobile, left column on desktop */}
        <div className="border-border/50 min-h-0 flex-1 overflow-hidden border-r-0 bg-white/50 backdrop-blur-sm dark:bg-gray-800/50 lg:border-r">
          <ProductSearch
            key={productSearchKey}
            onAddToCart={handleAddToCart}
            locationId={selectedLocation?.id}
            selectedCustomer={selectedCustomer}
            hasCashSession={!!effectiveCashSession}
            cartItems={cartItems}
          />
        </div>

        {/* Shopping Cart - Hidden on mobile by default, shown via floating button */}
        <div className="hidden overflow-hidden bg-white/50 backdrop-blur-sm dark:bg-gray-800/50 lg:block">
          <ShoppingCart
            items={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onUpdateItemDiscount={handleUpdateItemDiscount}
            onUpdatePriceType={handleUpdatePriceType}
            customerId={selectedCustomer?.id ?? ""}
            selectedCustomer={selectedCustomer}
            onCheckout={handleCheckout}
            discountCode={discountCode}
            onDiscountCodeChange={code => {
              setDiscountCode(code);
              // Clear discount code info when code is cleared
              if (!code.trim()) {
                setDiscountCodeInfo(null);
              }
            }}
            discountCodeInfo={discountCodeInfo}
            onDiscountCodeInfoChange={setDiscountCodeInfo}
            manualOrderDiscount={manualOrderDiscount}
            onManualOrderDiscountChange={amount => {
              const itemsSubtotal = cartItems.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
              );
              const itemsDiscountTotal = calculateItemsDiscountTotal(cartItems);

              const { clampedAmount, shouldShowWarning } =
                validateManualDiscountAmount(
                  amount,
                  itemsSubtotal,
                  itemsDiscountTotal,
                  discountCodeInfo
                );

              if (shouldShowWarning) {
                toast({
                  type: "warning",
                  title:
                    t("errors.discountExceedsSubtotal") || "Discount Too High",
                  description:
                    t("errors.discountExceedsSubtotalDescription", {
                      max: clampedAmount.toFixed(2),
                    }) ||
                    `Discount cannot exceed subtotal. Maximum allowed: ${CURRENCY_SIGN}${clampedAmount.toFixed(2)}`,
                });
              }

              setManualOrderDiscount(clampedAmount);
              const percentage =
                itemsSubtotal > 0 ? (clampedAmount / itemsSubtotal) * 100 : 0;
              setManualOrderDiscountPercentage(percentage);
            }}
            manualOrderDiscountPercentage={manualOrderDiscountPercentage}
            onManualOrderDiscountPercentageChange={percentage => {
              const itemsSubtotal = cartItems.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
              );
              const itemsDiscountTotal = calculateItemsDiscountTotal(cartItems);

              const { clampedPercentage, clampedAmount, shouldShowWarning } =
                validateManualDiscountPercentage(
                  percentage,
                  itemsSubtotal,
                  itemsDiscountTotal,
                  discountCodeInfo
                );

              if (shouldShowWarning) {
                toast({
                  type: "warning",
                  title:
                    t("errors.discountExceedsSubtotal") || "Discount Too High",
                  description:
                    t("errors.discountExceedsSubtotalDescription", {
                      max: clampedAmount.toFixed(2),
                    }) ||
                    `Discount cannot exceed subtotal. Maximum allowed: ${CURRENCY_SIGN}${clampedAmount.toFixed(2)}`,
                });
              }

              setManualOrderDiscountPercentage(clampedPercentage);
              setManualOrderDiscount(clampedAmount);
            }}
            includeTax={includeTax}
            onIncludeTaxChange={setIncludeTax}
            totals={calculateTotals()}
            onUpdateItemDiscountPercentage={handleUpdateItemDiscountPercentage}
            onResetCart={resetCart}
          />
        </div>

        {/* Mobile Cart Drawer/Sheet */}
        <MobileCartDrawer
          isOpen={isMobileCartOpen}
          onClose={() => setIsMobileCartOpen(false)}
          items={cartItems}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onUpdateItemDiscount={handleUpdateItemDiscount}
          onUpdateItemDiscountPercentage={handleUpdateItemDiscountPercentage}
          onUpdatePriceType={handleUpdatePriceType}
          discountCode={discountCode}
          onDiscountCodeChange={code => {
            setDiscountCode(code);
            if (!code.trim()) {
              setDiscountCodeInfo(null);
            }
          }}
          discountCodeInfo={discountCodeInfo}
          onDiscountCodeInfoChange={setDiscountCodeInfo}
          manualOrderDiscount={manualOrderDiscount}
          onManualOrderDiscountChange={amount => {
            // Calculate current totals to determine max allowed discount
            const itemsSubtotal = cartItems.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0
            );
            const itemsDiscountTotal = cartItems.reduce(
              (sum, item) => sum + (item.discountAmount || 0),
              0
            );
            const discountCodeValue = discountCodeInfo
              ? discountCodeInfo.discountType === "PERCENTAGE"
                ? Math.min(
                    (itemsSubtotal * discountCodeInfo.value) / 100,
                    discountCodeInfo.maxDiscount || Infinity
                  )
                : discountCodeInfo.value
              : 0;

            // Calculate max allowed manual discount
            const maxManualDiscount = Math.max(
              0,
              itemsSubtotal - itemsDiscountTotal - discountCodeValue
            );

            // Clamp amount to max allowed
            const clampedAmount = Math.max(
              0,
              Math.min(amount, maxManualDiscount)
            );

            if (clampedAmount < amount) {
              toast({
                type: "warning",
                title:
                  t("errors.discountExceedsSubtotal") || "Discount Too High",
                description:
                  t("errors.discountExceedsSubtotalDescription", {
                    max: clampedAmount.toFixed(2),
                  }) ||
                  `Discount cannot exceed subtotal. Maximum allowed: ${CURRENCY_SIGN}${clampedAmount.toFixed(2)}`,
              });
            }

            setManualOrderDiscount(clampedAmount);
            const percentage =
              itemsSubtotal > 0
                ? Number(((clampedAmount / itemsSubtotal) * 100).toFixed(2))
                : 0;
            setManualOrderDiscountPercentage(percentage);
          }}
          manualOrderDiscountPercentage={manualOrderDiscountPercentage}
          onManualOrderDiscountPercentageChange={percentage => {
            setManualOrderDiscountPercentage(percentage);
            const subtotal = cartItems.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0
            );
            const amount = (subtotal * percentage) / 100;
            setManualOrderDiscount(amount);
          }}
          includeTax={includeTax}
          onIncludeTaxChange={setIncludeTax}
          totals={calculateTotals()}
          customerId={selectedCustomer?.id ?? ""}
          selectedCustomer={selectedCustomer}
          onCheckout={handleCheckout}
          onResetCart={resetCart}
        />

        {/* Floating Cart Button - Mobile Only */}
        <button
          onClick={() => setIsMobileCartOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#ff48b0] to-[#f5b1cc] text-white shadow-2xl transition-transform hover:scale-110 lg:hidden"
          aria-label="Open shopping cart"
        >
          <BiCart className="h-6 w-6" />
          {cartItems.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {cartItems.length}
            </span>
          )}
        </button>
      </div>

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        totals={calculateTotals()}
        onConfirm={handleConfirmSale}
        selectedCustomer={selectedCustomer}
        isSubmitting={isSubmittingOrder || createOrderMutation.isPending}
      />

      {lastOrder && (
        <ReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          order={lastOrder}
          onPrint={handlePrintReceipt}
          onNewSale={handleNewSale}
        />
      )}

      {effectiveCashSession && (
        <>
          <CloseCashSessionModal
            isOpen={isCloseCashModalOpen}
            onClose={() => setIsCloseCashModalOpen(false)}
            onSuccess={() => {
              setIsCloseCashModalOpen(false);
              // Refetch the cash session after closing (will return null since it's closed)
              refetchCashSession();
            }}
            session={effectiveCashSession}
          />
          <CashRegisterMovementModal
            isOpen={isMovementModalOpen}
            onClose={() => setIsMovementModalOpen(false)}
            session={effectiveCashSession}
          />
        </>
      )}

      {/* Open Cash Session Modal - Only shown when user selects a closed cash register */}
      <OpenCashSessionModal
        isOpen={isOpenCashModalOpen}
        onClose={() => {
          setIsOpenCashModalOpen(false);
          // Mark this cash register as dismissed so we don't auto-open the modal again
          if (pendingCashRegisterId) {
            dismissedCashRegisterIdRef.current = pendingCashRegisterId;
          }
          setPendingCashRegisterId(null);
          setPendingCashRegisterName(null);
        }}
        locationId={
          selectedLocation?.id ||
          userData?.location?.id ||
          userData?.employee?.location?.id
        }
        cashRegisterId={pendingCashRegisterId || undefined}
        cashRegisterName={pendingCashRegisterName || undefined}
        onSuccess={async () => {
          // Refetch the cash session for the selected cash register after opening
          await refetchCashSession?.();
          setIsOpenCashModalOpen(false);
          // Reset dismissed flag on success since session is now open
          dismissedCashRegisterIdRef.current = null;
          setPendingCashRegisterId(null);
          setPendingCashRegisterName(null);
        }}
      />
    </div>
  );
}
