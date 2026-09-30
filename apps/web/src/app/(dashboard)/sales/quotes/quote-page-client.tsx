"use client";

import { DEFAULT_TAX_RATE } from "@esli-cosmetics/utils";
import { getCustomer } from "@/actions/customers";
import { exportReceiptPdf } from "@/actions/orders";
import { getReportExportMeta } from "@/lib/report-export-meta";
import { getStockLevelsByProductVariantsAndLocation } from "@/actions/stock-levels";
import { useToast } from "@/hooks/toast/use-toast";
import { useCurrentUser, useHasRole } from "@/hooks/use-auth";
import {
  useCashSessionByCashRegisterId,
  useOpenCashSessionsByLocation,
} from "@/hooks/use-cash-register";
import {
  quoteKeys,
  useAnnulQuote,
  useApproveQuote,
  useConvertQuoteToOrder,
  useCreateQuote,
  useUpdateQuote,
} from "@/hooks/use-quotes";
import type {
  CashRegister,
  ConvertQuoteToOrder,
  CreateQuote,
  CreateQuoteItem,
  EmployeeWithRelations,
  LocationInfo,
  Quote,
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
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BiCart } from "react-icons/bi";
import { CheckoutModal } from "../pos/_components/checkout-modal";
import { MobileCartDrawer } from "../pos/_components/mobile-cart-drawer";
import { OpenCashSessionModal } from "../pos/_components/open-cash-session-modal";
import { POSHeader } from "../pos/_components/pos-header";
import { ProductSearch } from "../pos/_components/product-search";
import { ShoppingCart } from "../pos/_components/shopping-cart";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  CartItem,
  Payment,
  SelectedCustomer,
  SelectedEmployee,
} from "../pos/pos-page-client";
import { ConvertToOrderButton } from "./_components/convert-to-order-button";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import {
  validateCartItemsAgainstStockLevels,
  type CartLineForStockValidation,
} from "@/lib/cart-stock-validation";

function downloadBase64Pdf(fileName: string, base64String: string) {
  const byteCharacters = atob(base64String);
  const byteNumbers = new Array<number>(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

export const normalizeProductWithMetadata = (product: any): any => {
  const existingKitItems = product.kitItems || product.product?.kitItems;
  if (existingKitItems && existingKitItems.length > 0)
    return { ...product, kitItems: existingKitItems };

  const type = (product.type || product.product?.type || "").toUpperCase();
  const metadata =
    product.metadata ||
    product.productVariant?.metadata ||
    product.product?.metadata;

  if (type === "KIT" && metadata?.composition) {
    const kitItems = metadata.composition.map((comp: any) => ({
      productVariantId: comp.variantId,
      quantity: comp.quantity,
      name: comp.name,
      availableStock: 0,
    }));

    return {
      ...product,
      type: "KIT",
      kitItems,
      product: { ...product.product, kitItems, type: "KIT" },
    };
  }

  return { ...product, type: type || "STANDARD" };
};

export function useValidateCartStock(
  cartItems: CartItem[],
  locationId: string | null
) {
  return useMemo(() => {
    if (!locationId)
      return { updatedCart: cartItems, hasError: false, isLoadingStock: false };

    const validatedItems = cartItems.map(item => {
      const normalized = normalizeProductWithMetadata(item);

      if (normalized.type === "KIT" && normalized.kitItems) {
        let minBuildable = Infinity;

        const kitWithStock = normalized.kitItems.map((comp: any) => {
          const physicalStock = comp.availableStock ?? 0;
          const buildableWithThis = Math.floor(
            physicalStock / (comp.quantity || 1)
          );
          if (buildableWithThis < minBuildable)
            minBuildable = buildableWithThis;
          return { ...comp, availableStock: physicalStock };
        });

        const finalKitStock = minBuildable === Infinity ? 0 : minBuildable;
        return {
          ...item,
          kitItems: kitWithStock,
          availableStock: finalKitStock,
          stockError:
            item.quantity > finalKitStock ? `Stock insuficiente` : undefined,
        };
      }

      const available = item.availableStock ?? 0;
      return {
        ...item,
        availableStock: available,
        stockError: item.quantity > available ? `Sin stock` : undefined,
      };
    });

    return {
      updatedCart: validatedItems as CartItem[],
      hasError: validatedItems.some(i => !!i.stockError),
      isLoadingStock: false,
    };
  }, [cartItems, locationId]);
}

interface QuotePageProps {
  title?: string;
  existingQuote?: Quote;
}

export function QuotePage({ title, existingQuote }: QuotePageProps) {
  const { t } = useTranslation("quotes");
  const { t: tPos } = useTranslation("pos");
  const router = useRouter();
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
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [productSearchKey, setProductSearchKey] = useState(0);
  const [validUntil, setValidUntil] = useState<string | undefined>(undefined);
  const [quoteStatus, setQuoteStatus] = useState<"DRAFT" | "APPROVED">("DRAFT");
  const [cashRegisterError, setCashRegisterError] = useState<string | null>(
    null
  );

  // Determine if we're in edit mode
  const isEditMode = existingQuote && existingQuote?.id;

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
  const [currentCustomerObject, setCurrentCustomerObject] = useState<any>(null);

  const { toast } = useToast();
  const { data: userData, isLoading: isLoadingUser } = useCurrentUser();
  const isCashier = useHasRole("cashier");
  const isSalesRep = useHasRole("sales_rep");
  const isStoreManager = useHasRole("store_manager");
  const isAdmin = useHasRole("admin");
  const hasSalesRole = isAdmin || isStoreManager || isCashier || isSalesRep;

  const createQuoteMutation = useCreateQuote();
  const updateQuoteMutation = useUpdateQuote();
  const convertQuoteToOrderMutation = useConvertQuoteToOrder();
  const annulQuoteMutation = useAnnulQuote();
  const approveQuoteMutation = useApproveQuote();
  const confirmationDialog = useConfirmationDialog();
  const { updatedCart, hasError, isLoadingStock } = useValidateCartStock(
    cartItems,
    selectedLocation?.id || null
  );

  // Fetch cash session for the selected cash register
  const {
    data: selectedCashRegisterSession,
    isLoading: isLoadingCashSession,
    refetch: refetchCashSession,
  } = useCashSessionByCashRegisterId(selectedCashRegister?.id);

  // Get open sessions for the selected location (used to check if cash register is open)
  const { data: openSessions } = useOpenCashSessionsByLocation(
    selectedLocation?.id
  );

  // Use the cash session from the selected cash register
  const effectiveCashSession = selectedCashRegisterSession;

  // Checkout modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const [isValidatingCart, setIsValidatingCart] = useState(false);
  const [isOpenCashModalOpen, setIsOpenCashModalOpen] = useState(false);
  const [pendingCashRegisterId, setPendingCashRegisterId] = useState<
    string | null
  >(null);
  const [pendingCashRegisterName, setPendingCashRegisterName] = useState<
    string | null
  >(null);
  const [isLoadingQuoteData, setIsLoadingQuoteData] = useState(false);
  const [isSavingQuote, setIsSavingQuote] = useState(false);
  const previousLocationIdRef = useRef<string | null>(null);
  const cartItemsRef = useRef<CartItem[]>(cartItems);
  cartItemsRef.current = cartItems;
  const isSavingQuoteRef = useRef(false);
  const isConvertingQuoteRef = useRef(false);
  const isCheckoutPreparingRef = useRef(false);
  const [isCheckoutPreparing, setIsCheckoutPreparing] = useState(false);
  const dismissedCashRegisterIdRef = useRef<string | null>(null);
  const locationChangeInProgressRef = useRef(false);
  const quoteInitialLoadCompleteRef = useRef(false);
  const quoteDataLoadedRef = useRef<string | null>(null);
  const justSavedQuoteIdRef = useRef<string | null>(null);

  // Load existing quote data into form when in edit mode
  useEffect(() => {
    // Early return if not in edit mode or quote not available
    if (!isEditMode || !existingQuote?.id) {
      if (!isEditMode) {
        quoteInitialLoadCompleteRef.current = false;
        quoteDataLoadedRef.current = null;
      }
      return;
    }

    // CRITICAL: If items are not available yet, wait for them (don't mark as loaded)
    // This prevents the effect from marking the quote as loaded before items arrive
    if (!existingQuote.items) {
      // Reset the loaded ref so we can try again when items arrive
      if (
        quoteDataLoadedRef.current &&
        quoteDataLoadedRef.current.startsWith(existingQuote.id)
      ) {
        quoteDataLoadedRef.current = null;
      }
      return;
    }

    // Skip if we've already loaded this specific quote
    // Use a composite key that includes items length to detect when items change
    const items = existingQuote.items || [];
    const itemsSignature =
      items.length > 0
        ? `${existingQuote.id}-${existingQuote.updatedAt}-${items.length}-${existingQuote.totalAmount}`
        : `${existingQuote.id}-empty`;

    // If we just saved this quote, don't reload - the form state is already correct
    // Clear the flag after checking to allow future updates
    if (justSavedQuoteIdRef.current === existingQuote.id) {
      justSavedQuoteIdRef.current = null; // Clear the flag
      // Update the loaded ref to prevent reload on next render
      quoteDataLoadedRef.current = itemsSignature;
      return; // Don't reload - the data is already in the form state
    }

    // Calculate current totals to compare with the quote from DB
    const currentTotals = calculateTotals();
    const hasTotalMismatch =
      existingQuote.totalAmount !== undefined &&
      existingQuote.totalAmount !== null &&
      Math.abs(Number(existingQuote.totalAmount) - currentTotals.totalAmount) >
        0.1;

    // Early return if already loaded with the same signature - prevents duplicate loads
    if (quoteDataLoadedRef.current === itemsSignature) {
      // If the signature is the same but the totals don't match,
      // it means the UI is out of sync with the DB (the "ghosting" problem).
      if (hasTotalMismatch) {
        quoteDataLoadedRef.current = null;
      } else {
        return;
      }
    }

    // Prevent concurrent loads
    if (isLoadingQuoteData) {
      return;
    }

    // Verify that quote has items before proceeding
    if (items.length === 0) {
      quoteDataLoadedRef.current = itemsSignature;
      setCartItems([]);
      quoteInitialLoadCompleteRef.current = true;
      return;
    }

    // DON'T mark as loaded yet - wait until items are actually set in cart
    // This prevents the effect from skipping on the next render before items are loaded
    // quoteDataLoadedRef.current = itemsSignature; // MOVED TO AFTER setCartItems

    // Prevent validation effect from running during initial load
    quoteInitialLoadCompleteRef.current = false;
    previousLocationIdRef.current = null;

    // Load quote data - async function to handle all async operations
    const loadQuoteData = async () => {
      setIsLoadingQuoteData(true);
      try {
        const locationId = existingQuote.location?.id;
        const isApprovedQuote = existingQuote.status === "APPROVED";

        // Set location first to prevent validation from running prematurely
        if (existingQuote.location) {
          setSelectedLocation(existingQuote.location as LocationInfo);
        }

        // Set other quote properties synchronously
        setIncludeTax(existingQuote.includeTax || false);
        setManualOrderDiscount(existingQuote.manualDiscount || 0);
        setDiscountCodeInfo(
          existingQuote.discountCode
            ? {
                id: existingQuote.discountCode.id,
                discountType: existingQuote.discountCode.discountType,
                value: existingQuote.discountCode.value,
              }
            : null
        );

        if (existingQuote.validUntil) {
          setValidUntil(
            new Date(existingQuote.validUntil).toISOString().split("T")[0] ||
              undefined
          );
        }

        setQuoteStatus(existingQuote.status as "DRAFT" | "APPROVED");

        // Set employees
        if (existingQuote.cashier && existingQuote.cashier.id) {
          const person = existingQuote.cashier.person;
          setSelectedCashier({
            id: existingQuote.cashier.id,
            name: person
              ? `${person.firstName || ""} ${person.lastName || ""}`.trim()
              : "",
            fullEmployeeObject: existingQuote.cashier as EmployeeWithRelations,
          });
        }

        if (existingQuote.seller && existingQuote.seller.id) {
          const person = existingQuote.seller.person;
          setSelectedSeller({
            id: existingQuote.seller.id,
            name: person
              ? `${person.firstName || ""} ${person.lastName || ""}`.trim()
              : "",
            fullEmployeeObject: existingQuote.seller as EmployeeWithRelations,
          });
        }

        // Load customer data
        if (existingQuote.customer) {
          const customerId = existingQuote.customer.id;
          const person = existingQuote.customer.person;

          try {
            const customer = await getCustomer(customerId);
            if (customer) {
              setCurrentCustomerObject(customer);
              setSelectedCustomer({
                id: customer.id,
                name: person
                  ? `${person.firstName || ""} ${person.lastName || ""}`.trim()
                  : "",
                ...(person?.email && { email: person.email }),
                ...(person?.phone && { phone: person.phone }),
                customerType:
                  customer.customerType ||
                  existingQuote.customer?.customerType ||
                  null,
                priceTypes: customer.priceTypes || [],
                creditAllowed: customer.creditAllowed,
                creditLimit: customer.creditLimit,
              });
            }
          } catch (error) {
            console.error("Failed to fetch customer details:", error);
            // Fallback to basic customer data from quote
            const fallbackCustomer = existingQuote.customer;
            if (fallbackCustomer) {
              setCurrentCustomerObject(fallbackCustomer);
              setSelectedCustomer({
                id: fallbackCustomer.id,
                name: person
                  ? `${person.firstName || ""} ${person.lastName || ""}`.trim()
                  : "",
                ...(person?.email && { email: person.email }),
                ...(person?.phone && { phone: person.phone }),
                ...(fallbackCustomer.customerType && {
                  customerType: fallbackCustomer.customerType,
                }),
                priceTypes: [],
              });
            }
          }
        }

        // Load cart items (items already declared in outer scope)
        if (!locationId) {
          const cartItems: CartItem[] = items.map(item => {
            const stockLevel = item.productVariant?.stockLevels?.[0];
            const savedLineQty = item.quantity || 1;
            const net = stockLevel
              ? Number(stockLevel.quantity || 0) -
                Number(stockLevel.reserved || 0)
              : 0;
            const availableStock = isApprovedQuote ? net + savedLineQty : net;

            return {
              id: item.id,
              productVariantId: item.productVariantId || item.id,
              name:
                item.productVariant?.product?.name || item.product?.name || "",
              brand:
                item.productVariant?.product?.brand?.name ||
                item.product?.brand?.name ||
                "",
              sku: item.productVariant?.sku || item.product?.sku || "",
              barcode: item.productVariant?.barcode || null,
              price: item.unitPrice || 0,
              quantity: savedLineQty,
              availableStock,
              ...(isApprovedQuote && {
                approvedQuoteReservedQuantity: savedLineQty,
              }),
              discountAmount: item.discountAmount || 0,
              discountPercentage:
                item.discountAmount && item.unitPrice
                  ? (item.discountAmount / (item.unitPrice * item.quantity)) *
                    100
                  : 0,

              product: item.productVariant?.product || item.product || {},
            };
          });

          setCartItems(cartItems);
          quoteInitialLoadCompleteRef.current = true;
          previousLocationIdRef.current = null;
          return;
        }

        // Product prices are now included in the quote response from backend
        // No need to fetch them separately - this eliminates N+1 query problem

        // Map items to cart items with productPrices
        const cartItems: CartItem[] = items.map(item => {
          const variant = item.productVariant;
          const productData = variant?.product || item.product;
          const normalized = normalizeProductWithMetadata(productData);
          const isKit =
            normalized.type === "KIT" || normalized.product?.type === "KIT";
          const savedLineQty = item.quantity || 0;

          let availableStock = 0;
          let kitItemsWithStock: any[] = [];

          if (
            isKit &&
            normalized.kitItems &&
            Array.isArray(normalized.kitItems)
          ) {
            let minBuildable = Infinity;
            kitItemsWithStock = normalized.kitItems.map((comp: any) => {
              const compStockLevel = comp.productVariant?.stockLevels?.find(
                (sl: any) => sl.locationId === locationId
              );
              const compNet = compStockLevel
                ? Number(compStockLevel.quantity || 0) -
                  Number(compStockLevel.reserved || 0)
                : 0;
              const compAvailable = isApprovedQuote
                ? compNet + savedLineQty * Number(comp.quantity || 1)
                : compNet;
              const buildableWithThis = Math.floor(
                compAvailable / (comp.quantity || 1)
              );
              if (buildableWithThis < minBuildable)
                minBuildable = buildableWithThis;
              return { ...comp, availableStock: compAvailable };
            });
            availableStock = minBuildable === Infinity ? 0 : minBuildable;
          } else {
            const stockLevel = item.productVariant?.stockLevels?.[0];
            const net = stockLevel
              ? Number(stockLevel.quantity || 0) -
                Number(stockLevel.reserved || 0)
              : 0;
            availableStock = isApprovedQuote ? net + savedLineQty : net;
          }

          const productVariantId = item.productVariantId || item.id;

          // Extract product prices directly from the quote item's productVariant
          let productPrices: Array<{
            priceTypeId: string;
            priceTypeName: string;
            price: number;
            minQuantity: number;
            priority: number;
          }> = [];
          if (
            item.productVariant?.prices &&
            Array.isArray(item.productVariant.prices)
          ) {
            productPrices = item.productVariant.prices.map((price: any) => ({
              priceTypeId: price.priceTypeId,
              priceTypeName: price.priceTypeName || price.priceType?.name || "",
              price:
                typeof price.price === "number"
                  ? price.price
                  : Number(price.price),
              minQuantity: price.minQuantity || 1,
              priority: price.priority || price.priceType?.priority || 999,
            }));
          }

          // Use priceTypeId if available (new quotes), otherwise match by price (backward compatibility)
          const storedUnitPrice = item.unitPrice || 0;
          let matchedPriceTypeId: string | undefined;
          let shouldMarkAsManual = false;

          if (item.priceTypeId) {
            matchedPriceTypeId = item.priceTypeId;
            shouldMarkAsManual = true;
          } else if (storedUnitPrice > 0 && productPrices.length > 0) {
            // Find all prices that match the stored unitPrice (with tolerance for floating point)
            const matchingPrices = productPrices.filter(
              p => Math.abs(p.price - storedUnitPrice) < 0.01
            );
            if (matchingPrices.length > 0) {
              const itemQuantity = item.quantity || 1;
              const firstPrice = matchingPrices[0]!;
              const bestMatch = matchingPrices
                .slice(1)
                .reduce((best, current) => {
                  const bestMatchesQuantity = best.minQuantity <= itemQuantity;
                  const currentMatchesQuantity =
                    current.minQuantity <= itemQuantity;
                  if (currentMatchesQuantity && !bestMatchesQuantity)
                    return current;
                  if (bestMatchesQuantity && !currentMatchesQuantity)
                    return best;
                  return (current.priority || 999) < (best.priority || 999)
                    ? current
                    : best;
                }, firstPrice);
              matchedPriceTypeId = bestMatch.priceTypeId;
              shouldMarkAsManual = true;
            }
          }

          return {
            id: item.id,
            productVariantId: productVariantId,
            name: normalized.name || productData?.name || "Producto",
            brand:
              normalized.brand?.name ||
              normalized.brand ||
              productData?.brand?.name ||
              "Unknown",
            sku: variant?.sku || "",
            barcode: variant?.barcode || null,
            price: storedUnitPrice,
            quantity: item.quantity,
            availableStock: availableStock,
            type: isKit ? "KIT" : "STANDARD",
            kitItems: kitItemsWithStock,
            productPrices: productPrices,
            priceTypeId: matchedPriceTypeId,
            manualPriceTypeSelection: shouldMarkAsManual,
            product: normalized,
            discountAmount: item.discountAmount || 0,
            multiple: normalized.multiple || 1,
            ...(isApprovedQuote && {
              approvedQuoteReservedQuantity: savedLineQty,
            }),
          } as CartItem;
        });

        // Set cart items
        setCartItems(cartItems);

        // Mark quote as loaded NOW (after items are set) to prevent duplicate loads
        quoteDataLoadedRef.current = itemsSignature;

        // Mark as complete and set previousLocationId to prevent validation from running
        quoteInitialLoadCompleteRef.current = true;
        previousLocationIdRef.current = locationId;
      } catch (error) {
        console.error("Error loading quote data:", error);
        toast({
          type: "error",
          title: t("errors.error") || "Error",
          description:
            t("errors.errorLoadingQuote") || "Failed to load quote data",
        });
        // Mark as loaded to prevent infinite retries, but don't set itemsSignature
        // so the effect can retry if the quote data changes
        quoteInitialLoadCompleteRef.current = true;
        // Don't set itemsSignature on error - allow retry on next render if data changes
      } finally {
        setIsLoadingQuoteData(false);
      }
    };

    // Execute async load only if not already loading
    if (!isLoadingQuoteData) {
      loadQuoteData();
    }
    // Include items in dependencies so effect re-runs when items become available
    // Use useMemo to stabilize the items signature for dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    existingQuote?.id,
    isEditMode,
    existingQuote?.id,
    existingQuote?.items?.length,
    // Create a stable signature for items IDs to detect changes
    existingQuote?.items?.map(i => i.id).join(",") || "",
  ]);

  // Auto-select location, seller and cashier from user's employee data
  useEffect(() => {
    if (!userData || isEditMode) return;

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
        id: locationRest.id,
        name: locationRest.name?.trim() || "Location",
        branchId,
        address: locationRest.address || null,
        locationType: locationRest.locationType || "STORE",
      } as LocationInfo);
    }
  }, [
    userData,
    hasSalesRole,
    selectedCashier,
    selectedSeller,
    selectedLocation,
    isEditMode,
  ]);

  const resetCart = useCallback(() => {
    setCartItems([]);
    setDiscountCodeInfo(null);
    setManualOrderDiscount(0);
    setManualOrderDiscountPercentage(0);
    setDiscountCode("");
    setSelectedCustomer(null);
    setCurrentCustomerObject(null);
    setProductSearchKey(prev => prev + 1);
  }, []);

  // Clear selected cash register when location changes
  useEffect(() => {
    // Skip if location hasn't actually changed
    if (selectedLocation?.id === previousLocationIdRef.current) {
      return;
    }

    // Skip if we're in the middle of loading quote data
    if (isEditMode && !quoteInitialLoadCompleteRef.current) {
      // Just update the ref, don't reset cart
      previousLocationIdRef.current = selectedLocation?.id || null;
      return;
    }

    locationChangeInProgressRef.current = true;
    setSelectedCashRegister(null);
    // Close the modal if it's open when location changes
    setIsOpenCashModalOpen(false);
    setPendingCashRegisterId(null);
    setPendingCashRegisterName(null);
    setCashRegisterError(null);

    // Reset cart when editing a quote and location changes (but not during initial load)
    if (isEditMode && quoteInitialLoadCompleteRef.current) {
      resetCart();
    }

    previousLocationIdRef.current = selectedLocation?.id || null;
    // Reset dismissed cash register when location changes
    dismissedCashRegisterIdRef.current = null;
    // Reset the flag after a brief delay to allow effects to complete
    setTimeout(() => {
      locationChangeInProgressRef.current = false;
    }, 0);
  }, [selectedLocation?.id, isEditMode, resetCart]);

  // Check if selected cash register is closed and show error
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

      // If cash register is closed (no open session), set error and open modal
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
        setCashRegisterError(
          t("errors.cashRegisterClosed", { name: selectedCashRegister.name }) ||
            `Cash register "${selectedCashRegister.name}" is closed. Please open a cash session.`
        );
        setPendingCashRegisterId(selectedCashRegister.id);
        setPendingCashRegisterName(selectedCashRegister.name || "");
        setIsOpenCashModalOpen(true);
      } else if (isOpen) {
        // Clear error if cash register is open
        setCashRegisterError(null);
        // Reset dismissed flag when session opens
        dismissedCashRegisterIdRef.current = null;
      }
    } else if (!selectedCashRegister) {
      setCashRegisterError(null);
    }
  }, [
    selectedCashRegister,
    openSessions,
    isOpenCashModalOpen,
    selectedLocation,
    t,
  ]);

  // Close the open cash modal when a session is detected after opening
  useEffect(() => {
    if (effectiveCashSession && isOpenCashModalOpen) {
      setIsOpenCashModalOpen(false);
      setPendingCashRegisterId(null);
      setPendingCashRegisterName(null);
      setCashRegisterError(null);
      // Reset dismissed flag when session opens
      dismissedCashRegisterIdRef.current = null;
    }
  }, [effectiveCashSession, isOpenCashModalOpen]);

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
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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

      if (discountCodeInfo && discountCodeInfo.discountType === "PERCENTAGE") {
        // Recalculation handled in calculateTotals
      }

      if (manualOrderDiscountPercentage > 0) {
        const newManualDiscount = Number(
          ((newSubtotal * manualOrderDiscountPercentage) / 100).toFixed(2)
        );
        setManualOrderDiscount(newManualDiscount);
      }
    },
    [discountCodeInfo, manualOrderDiscountPercentage]
  );

  const getApprovedQuoteReservedBoost = useCallback(
    (item: CartLineForStockValidation, productVariantId: string) => {
      if (quoteStatus !== "APPROVED") return 0;
      const cartLine = item as unknown as CartItem;
      const reserved = cartLine.approvedQuoteReservedQuantity;
      if (reserved == null || reserved <= 0) return 0;
      const normalized = normalizeProductWithMetadata(cartLine) as {
        type?: string;
        kitItems?: Array<{ productVariantId: string; quantity?: number }>;
      };
      if (normalized.type === "KIT" && Array.isArray(normalized.kitItems)) {
        const comp = normalized.kitItems.find(
          ki => ki.productVariantId === productVariantId
        );
        if (!comp) return 0;
        return reserved * Number(comp.quantity || 1);
      }
      if (cartLine.productVariantId === productVariantId) return reserved;
      return 0;
    },
    [quoteStatus]
  );

  const runCartStockValidation = useCallback(
    async (
      items: CartItem[],
      locationId: string
    ): Promise<{
      ok: boolean;
      items: CartItem[];
      hasStockIssues: boolean;
    }> => {
      if (!locationId || items.length === 0) {
        return { ok: true, items, hasStockIssues: false };
      }
      setIsValidatingCart(true);
      try {
        const { updatedItems } = await validateCartItemsAgainstStockLevels(
          items as unknown as CartLineForStockValidation[],
          locationId,
          getStockLevelsByProductVariantsAndLocation,
          {
            normalizeProduct: normalizeProductWithMetadata,
            selectPriceForQuantity,
            annotateOnly: true,
            approvedQuoteReservedBoost: getApprovedQuoteReservedBoost,
          }
        );

        const cartUpdated = updatedItems as unknown as CartItem[];
        setCartItems(cartUpdated);
        recalculatePercentageDiscounts(cartUpdated);

        const hasStockIssues = cartUpdated.some(
          item =>
            item.quantity > Number(item.availableStock ?? 0) ||
            Boolean(item.stockError)
        );

        return {
          ok: !hasStockIssues,
          items: cartUpdated,
          hasStockIssues,
        };
      } catch (e) {
        console.error(e);
        toast({
          type: "error",
          title: tPos("errors.validationError") || "Validation error",
          description:
            tPos("errors.validationErrorDescription") ||
            "Could not validate stock for this location.",
        });
        return { ok: false, items, hasStockIssues: true };
      } finally {
        setIsValidatingCart(false);
      }
    },
    [
      selectPriceForQuantity,
      recalculatePercentageDiscounts,
      getApprovedQuoteReservedBoost,
      toast,
      tPos,
    ]
  );

  useEffect(() => {
    if (!quoteInitialLoadCompleteRef.current) {
      return;
    }
    if (
      !selectedLocation?.id ||
      cartItemsRef.current.length === 0 ||
      isValidatingCart ||
      previousLocationIdRef.current === selectedLocation.id
    ) {
      if (selectedLocation?.id) {
        previousLocationIdRef.current = selectedLocation.id;
      }
      return;
    }
    const locId = selectedLocation.id;
    const timeoutId = setTimeout(() => {
      runCartStockValidation(cartItemsRef.current, locId).then(() => {
        if (selectedLocation?.id) {
          previousLocationIdRef.current = selectedLocation.id;
        }
      });
    }, 100);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- validate only on location change
  }, [selectedLocation?.id, runCartStockValidation]);

  // Update cart item prices when customer changes
  useEffect(() => {
    if (cartItems.length === 0) {
      return;
    }

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
        let updatedDiscountAmount = item.discountAmount || 0;
        let updatedDiscountPercentage = item.discountPercentage || 0;

        if (item.discountPercentage && item.discountPercentage > 0) {
          const newItemSubtotal = selectedPrice.price * item.quantity;
          updatedDiscountAmount = Number(
            ((newItemSubtotal * item.discountPercentage) / 100).toFixed(2)
          );
          updatedDiscountPercentage = item.discountPercentage;
        } else if (item.discountAmount && item.discountAmount > 0) {
          const newItemSubtotal = selectedPrice.price * item.quantity;
          updatedDiscountPercentage =
            newItemSubtotal > 0
              ? Number(
                  ((item.discountAmount / newItemSubtotal) * 100).toFixed(2)
                )
              : 0;
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
      const normalized = normalizeProductWithMetadata(product);
      const isKit = normalized.kitItems && normalized.kitItems.length > 0;

      setCartItems(prev => {
        const existingItem = prev.find(
          item => item.productVariantId === normalized.id
        );

        if (existingItem) {
          // If quantity is provided, use it; otherwise add the default increment
          let newQuantity =
            quantity !== undefined
              ? existingItem.quantity + quantity
              : existingItem.quantity +
                (normalized.multiple && normalized.multiple > 0
                  ? normalized.multiple
                  : 1);

          if (existingItem.availableStock < newQuantity) {
            newQuantity = existingItem.availableStock;
          }

          // Recalculate price based on new quantity
          let newPrice = existingItem.price;
          let newPriceTypeId = existingItem.priceTypeId;
          let shouldMarkAsManual = existingItem.manualPriceTypeSelection;

          if (
            existingItem.productPrices &&
            existingItem.productPrices.length > 0
          ) {
            if (priceTypeId) {
              const manualPrice = existingItem.productPrices.find(
                p => p.priceTypeId === priceTypeId
              );
              if (manualPrice) {
                newPrice = manualPrice.price;
                newPriceTypeId = priceTypeId;
                shouldMarkAsManual = true;
              }
            } else if (
              existingItem.manualPriceTypeSelection &&
              existingItem.priceTypeId
            ) {
              const manualPrice = existingItem.productPrices.find(
                p => p.priceTypeId === existingItem.priceTypeId
              );
              if (manualPrice) {
                newPrice = manualPrice.price;
              }
            } else {
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

          const updatedItems = prev.map(item =>
            item.productVariantId === normalized.id
              ? {
                  ...item,
                  quantity: newQuantity,
                  price: newPrice,
                  ...(newPriceTypeId && { priceTypeId: newPriceTypeId }),
                  ...(shouldMarkAsManual && { manualPriceTypeSelection: true }),
                }
              : item
          );
          recalculatePercentageDiscounts(updatedItems);
          return updatedItems;
        } else {
          // Use provided priceTypeId to find price, or selectedPrice, or fallback to first price
          let priceToUse = 0;
          let selectedPriceTypeId: string | undefined;

          if (priceTypeId && normalized.prices) {
            const selectedPrice = normalized.prices.find(
              (p: any) => p.priceTypeId === priceTypeId
            );
            if (selectedPrice) {
              priceToUse = selectedPrice.price;
              selectedPriceTypeId = priceTypeId;
            }
          }

          if (priceToUse === 0) {
            priceToUse =
              normalized.selectedPrice?.price ||
              normalized.prices?.[0]?.price ||
              0;
            selectedPriceTypeId =
              normalized.selectedPrice?.priceTypeId ||
              normalized.prices?.[0]?.priceTypeId;
          }

          // Use provided quantity, or if product has multiple, set initial quantity to the multiple value
          let initialQuantity =
            quantity !== undefined
              ? quantity
              : normalized.multiple && normalized.multiple > 0
                ? normalized.multiple
                : 1;

          let availableStock = normalized.stockLevel?.available ?? 999;
          if (isKit && typeof normalized.availableStock === "number") {
            availableStock = normalized.availableStock;
          }
          if (availableStock < initialQuantity) {
            initialQuantity = availableStock;
          }

          const newItem: CartItem = {
            id: normalized.id,
            productVariantId: normalized.id,
            name: normalized.name || normalized.product?.name,
            brand: normalized.product?.brand?.name || "Unknown",
            sku: normalized.sku || "",
            barcode: normalized.barcode || null,
            price: priceToUse,
            quantity: initialQuantity,
            availableStock,
            discountAmount: 0,
            multiple: normalized.multiple || null,
            productPrices: normalized.prices || [],
            ...(selectedPriceTypeId && {
              priceTypeId: selectedPriceTypeId,
              manualPriceTypeSelection: !!priceTypeId,
            }),
            type: (isKit ? "KIT" : "STANDARD") as ProductType,
            kitItems: isKit ? normalized.kitItems : undefined,
            product: normalized,
          };
          return [...prev, newItem];
        }
      });
    },
    [recalculatePercentageDiscounts, selectPriceForQuantity]
  );

  const handleRemoveItem = useCallback(
    (productVariantId: string) => {
      const updatedItems = cartItems.filter(
        item => item.productVariantId !== productVariantId
      );
      setCartItems(updatedItems);
      recalculatePercentageDiscounts(updatedItems);
    },
    [cartItems, recalculatePercentageDiscounts]
  );

  const handleUpdateQuantity = useCallback(
    (productVariantId: string, quantity: number) => {
      if (quantity <= 0) {
        handleRemoveItem(productVariantId);
        return;
      }

      const updatedItems = cartItems.map(item => {
        if (item.productVariantId === productVariantId) {
          let validatedQuantity = quantity;
          if (item.multiple && item.multiple > 0) {
            validatedQuantity =
              Math.floor(quantity / item.multiple) * item.multiple;
            if (validatedQuantity < item.multiple) {
              validatedQuantity = item.multiple;
            }
          }
          let newPrice = item.price;
          let newPriceTypeId = item.priceTypeId;

          if (item.productPrices && item.productPrices.length > 0) {
            if (item.manualPriceTypeSelection && item.priceTypeId) {
              const manualPrice = item.productPrices.find(
                p => p.priceTypeId === item.priceTypeId
              );
              if (manualPrice) {
                newPrice = manualPrice.price;
              }
            } else {
              // Auto-select price based on quantity
              const selectedPrice = selectPriceForQuantity(
                item.productPrices,
                quantity
              );
              if (selectedPrice) {
                newPrice = selectedPrice.price;
                newPriceTypeId = selectedPrice.priceTypeId;
              }
            }
          }

          const newItemSubtotal = newPrice * validatedQuantity;
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
            quantity: validatedQuantity,
            price: newPrice,
            ...(newPriceTypeId && { priceTypeId: newPriceTypeId }),
            discountAmount: updatedDiscountAmount,
            discountPercentage: updatedDiscountPercentage,
          };
        }
        return item;
      });

      setCartItems(updatedItems);
      recalculatePercentageDiscounts(updatedItems);
    },
    [
      cartItems,
      handleRemoveItem,
      selectPriceForQuantity,
      recalculatePercentageDiscounts,
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
            manualPriceTypeSelection: true, // Mark as manually selected
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

  const calculateTotals = useCallback(() => {
    const itemsSubtotal = Number(
      updatedCart
        .reduce((sum, item) => sum + item.price * item.quantity, 0)
        .toFixed(2)
    );

    const itemsDiscountTotal = calculateItemsDiscountTotal(updatedCart);

    let discountCodeValue = 0;
    if (discountCodeInfo) {
      if (discountCodeInfo.discountType === "PERCENTAGE") {
        discountCodeValue = Number(
          ((itemsSubtotal * discountCodeInfo.value) / 100).toFixed(2)
        );
        if (
          discountCodeInfo.maxDiscount &&
          discountCodeValue > discountCodeInfo.maxDiscount
        ) {
          discountCodeValue = Number(discountCodeInfo.maxDiscount.toFixed(2));
        }
      } else {
        discountCodeValue = Number(discountCodeInfo.value.toFixed(2));
      }
    }

    const orderDiscount = Number(
      (discountCodeValue + manualOrderDiscount).toFixed(2)
    );
    let totalDiscount = Number((orderDiscount + itemsDiscountTotal).toFixed(2));

    if (totalDiscount > itemsSubtotal) totalDiscount = itemsSubtotal;

    const subtotalAfterDiscounts = Number(
      (itemsSubtotal - totalDiscount).toFixed(2)
    );
    const taxes = includeTax
      ? Number((subtotalAfterDiscounts * DEFAULT_TAX_RATE).toFixed(2))
      : 0;

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
  }, [updatedCart, discountCodeInfo, manualOrderDiscount, includeTax]);

  const computeTotalsFromCartItems = useCallback(
    (items: CartItem[]) => {
      const itemsSubtotal = Number(
        items
          .reduce((sum, item) => sum + item.price * item.quantity, 0)
          .toFixed(2)
      );
      const itemsDiscountTotal = calculateItemsDiscountTotal(items);
      let discountCodeValue = 0;
      if (discountCodeInfo) {
        if (discountCodeInfo.discountType === "PERCENTAGE") {
          discountCodeValue = Number(
            ((itemsSubtotal * discountCodeInfo.value) / 100).toFixed(2)
          );
          if (
            discountCodeInfo.maxDiscount &&
            discountCodeValue > discountCodeInfo.maxDiscount
          ) {
            discountCodeValue = Number(discountCodeInfo.maxDiscount.toFixed(2));
          }
        } else {
          discountCodeValue = Number(discountCodeInfo.value.toFixed(2));
        }
      }
      const orderDiscount = Number(
        (discountCodeValue + manualOrderDiscount).toFixed(2)
      );
      let totalDiscount = Number(
        (orderDiscount + itemsDiscountTotal).toFixed(2)
      );
      if (totalDiscount > itemsSubtotal) totalDiscount = itemsSubtotal;
      const subtotalAfterDiscounts = Number(
        (itemsSubtotal - totalDiscount).toFixed(2)
      );
      const taxes = includeTax
        ? Number((subtotalAfterDiscounts * DEFAULT_TAX_RATE).toFixed(2))
        : 0;
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
    },
    [discountCodeInfo, manualOrderDiscount, includeTax]
  );

  const mapCartToQuoteItems = useCallback(
    (items: CartItem[]): CreateQuoteItem[] =>
      items.map(item => ({
        productVariantId: item.productVariantId,
        quantity: Math.max(1, Math.round(Number(item.quantity)) || 1),
        unitPrice: Number(Number(item.price).toFixed(4)),
        discountAmount: lineDiscountAmountForCartItem(item),
        ...(item.priceTypeId ? { priceTypeId: item.priceTypeId } : {}),
      })),
    []
  );

  // Get totals for checkout - use current cart totals if there are unsaved changes, otherwise use saved quote totals
  // Get totals for checkout - use current cart totals if there are unsaved changes, otherwise use saved quote totals
  const getCheckoutTotals = useCallback(() => {
    // If we're editing a quote, check if there are unsaved changes
    if (isEditMode && existingQuote && existingQuote.totalAmount != null) {
      // Check if cart has unsaved changes by comparing with saved quote
      const hasUnsavedChanges =
        cartItems.length !== (existingQuote.items?.length || 0) ||
        cartItems.some((item, index) => {
          const savedItem = existingQuote.items?.[index];
          return (
            !savedItem ||
            item.productVariantId !== savedItem.productVariantId ||
            item.quantity !== savedItem.quantity ||
            item.price !== savedItem.unitPrice ||
            (item.discountAmount || 0) !== (savedItem.discountAmount || 0)
          );
        }) ||
        // Also check if discounts or tax settings changed
        discountCodeInfo?.id !== existingQuote.discountCodeId ||
        manualOrderDiscount !== (existingQuote.manualDiscount || 0) ||
        includeTax !== existingQuote.includeTax;

      // If there are unsaved changes, use current cart totals to match backend recalculation
      // This ensures payment validation uses the same totals the backend will calculate
      if (hasUnsavedChanges) {
        return calculateTotals();
      }

      // If no changes, use saved quote totals (locked-in price)
      return {
        subtotal: existingQuote.subtotal ?? 0,
        itemsDiscountTotal: existingQuote.itemsDiscountTotal ?? 0,
        orderDiscount: Number(
          (
            (existingQuote.discountCodeValue ?? 0) +
            (existingQuote.manualDiscount ?? 0)
          ).toFixed(2)
        ),
        discountCodeValue: existingQuote.discountCodeValue ?? 0,
        manualOrderDiscount: existingQuote.manualDiscount ?? 0,
        discountAmount: existingQuote.discountAmount ?? 0,
        taxes: existingQuote.taxes ?? 0,
        totalAmount: existingQuote.totalAmount,
      };
    }
    // For new quotes or quotes without totalAmount, calculate from current cart state
    // For new quotes or quotes without totalAmount, calculate from current cart state
    return calculateTotals();
  }, [
    isEditMode,
    existingQuote,
    cartItems,
    discountCodeInfo,
    manualOrderDiscount,
    includeTax,
    calculateTotals,
  ]);

  const handleSaveQuote = useCallback(async () => {
    // Prevent duplicate submissions using ref for immediate synchronous check
    if (
      createQuoteMutation.isPending ||
      updateQuoteMutation.isPending ||
      isSavingQuoteRef.current
    ) {
      return;
    }

    try {
      // Set ref immediately after validation to prevent concurrent submissions
      isSavingQuoteRef.current = true;
      setIsSavingQuote(true);

      // Check if quote is already converted (cannot update converted quotes)
      if (isEditMode && existingQuote && existingQuote.status === "CONVERTED") {
        toast({
          type: "error",
          title: t("errors.error") || "Error",
          description:
            t("errors.cannotUpdateConvertedQuote") ||
            "Cannot update a converted quote",
        });
        return;
      }

      if (cartItems.length === 0) {
        toast({
          type: "error",
          title: t("errors.cartEmpty") || "Cart Empty",
          description:
            t("errors.cartEmptyDescription") || "Please add items to the quote",
        });
        return;
      }

      if (!selectedLocation) {
        toast({
          type: "error",
          title: t("errors.locationRequired") || "Location Required",
          description:
            t("errors.locationRequiredDescription") ||
            "Please select a location",
        });
        return;
      }

      if (!selectedCashier) {
        toast({
          type: "error",
          title: t("errors.cashierRequired") || "Cashier Required",
          description:
            t("errors.cashierRequiredDescription") || "Please select a cashier",
        });
        return;
      }

      if (!selectedSeller) {
        toast({
          type: "error",
          title: t("errors.sellerRequired") || "Seller Required",
          description:
            t("errors.sellerRequiredDescription") || "Please select a seller",
        });
        return;
      }

      const { items: validatedItems, hasStockIssues } =
        await runCartStockValidation(cartItems, selectedLocation.id);
      if (hasStockIssues) {
        toast({
          type: "error",
          title: t("errors.cannotSaveStockTitle") || "Stock unavailable",
          description:
            t("errors.cannotSaveStockDescription") ||
            "Some lines are out of stock at this location. Update the cart and try again.",
        });
        return;
      }

      const totals = computeTotalsFromCartItems(validatedItems);

      let discountCodeValue = 0;
      if (discountCodeInfo) {
        if (discountCodeInfo.discountType === "PERCENTAGE") {
          discountCodeValue = Number(
            ((totals.subtotal * discountCodeInfo.value) / 100).toFixed(2)
          );
          if (
            discountCodeInfo.maxDiscount &&
            discountCodeValue > discountCodeInfo.maxDiscount
          ) {
            discountCodeValue = Number(discountCodeInfo.maxDiscount.toFixed(2));
          }
        } else {
          discountCodeValue = Number(discountCodeInfo.value.toFixed(2));
        }
      }

      const quoteData: CreateQuote = {
        ...(selectedCustomer?.id && { customerId: selectedCustomer.id }),
        ...(selectedLocation.branchId && {
          branchId: selectedLocation.branchId,
        }),
        locationId: selectedLocation.id,
        sellerId: selectedSeller.id,
        cashierId: selectedCashier.id,
        ...(discountCodeInfo?.id && { discountCodeId: discountCodeInfo.id }),
        ...(discountCodeValue > 0 && { discountCodeValue }),
        ...(manualOrderDiscount > 0 && { manualDiscount: manualOrderDiscount }),
        itemsDiscountTotal: totals.itemsDiscountTotal,
        discountAmount: totals.discountAmount,
        includeTax,
        status: quoteStatus,
        ...(validUntil && { validUntil: new Date(validUntil).toISOString() }),
        items: mapCartToQuoteItems(validatedItems),
      };

      if (isEditMode && existingQuote?.id) {
        await updateQuoteMutation.mutateAsync({
          id: existingQuote.id,
          data: quoteData,
        });

        setCartItems(prev =>
          prev.map(it => {
            if (quoteStatus === "APPROVED") {
              return { ...it, approvedQuoteReservedQuantity: it.quantity };
            }
            const { approvedQuoteReservedQuantity: _reserved, ...rest } = it;
            return rest;
          })
        );

        queryClient.invalidateQueries({
          queryKey: ["quote", existingQuote.id],
        });
        queryClient.invalidateQueries({ queryKey: ["quotes"] });

        toast({
          type: "success",
          title: t("toast.quoteUpdated") || "Quote Updated",
          description:
            t("toast.quoteUpdatedDescription") ||
            "Quote has been updated successfully",
        });
        router.refresh();
      } else {
        const quote = await createQuoteMutation.mutateAsync(quoteData);
        queryClient.invalidateQueries({ queryKey: ["quotes"] });
        toast({
          type: "success",
          title: t("toast.quoteCreated") || "Quote Created",
          description:
            t("toast.quoteCreatedDescription", {
              quoteNumber: quote.quoteNumber || quote.id,
            }) ||
            `Quote ${quote.quoteNumber || quote.id} has been created successfully`,
        });
        router.refresh();
        router.replace(`/sales/quotes/${quote.id}/edit`);
      }
    } catch (error: any) {
      let errorMessage = error?.message || "";
      // clean up error message by removing "API Error: <status> - " prefix if present
      const prefixMatch = errorMessage.match(/^API Error: \d+ - (.+)$/);
      if (prefixMatch && prefixMatch[1]) {
        errorMessage = prefixMatch[1];
      }
      const statusMatch = errorMessage.match(/API Error: (\d+)/);
      const statusCode =
        error?.status ||
        (statusMatch && statusMatch[1]
          ? Number.parseInt(statusMatch[1], 10)
          : null);

      // Check for unique constraint violation (quote number conflict)
      const isUniqueConstraintError =
        errorMessage.includes("Unique constraint failed") ||
        errorMessage.includes("quote_number") ||
        statusCode === 409; // Conflict status code

      // Check for stock error
      const isStockError =
        errorMessage.includes("Insufficient stock") ||
        errorMessage.includes("insufficient stock") ||
        (statusCode === 409 && errorMessage.toLowerCase().includes("stock"));

      if (statusCode === 404) {
        toast({
          type: "error",
          title: t("errors.quoteNotFound") || "Quote Not Found",
          description:
            t("errors.quoteNotFoundDescription") ||
            "The quote you are trying to update no longer exists. It may have been deleted or is no longer available.",
        });
        setTimeout(() => {
          router.push("/sales/quotes");
        }, 2000);
      } else if (isStockError) {
        // Show stock error
        toast({
          type: "error",
          title:
            t("errors.insufficientStockAtCheckout") || "Insufficient Stock",
          description:
            errorMessage ||
            t("errors.insufficientStockAtCheckoutGeneric") ||
            "One or more items in your cart have insufficient stock. Please review your cart and try again.",
        });
      } else if (isUniqueConstraintError) {
        // Handle unique constraint violation (race condition)
        toast({
          type: "error",
          title: t("errors.duplicateQuote") || "Duplicate Quote Number",
          description:
            t("errors.duplicateQuoteDescription") ||
            "A quote with this number already exists. This may happen if you clicked save multiple times. Please wait a moment and try again, or refresh the page.",
        });
      } else {
        toast({
          type: "error",
          title: t("errors.error") || "Error",
          description:
            error?.message ||
            t("errors.errorDescription") ||
            "An error occurred",
        });
      }
    } finally {
      isSavingQuoteRef.current = false;
      setIsSavingQuote(false);
    }
  }, [
    cartItems,
    selectedLocation,
    selectedCashier,
    selectedSeller,
    selectedCustomer,
    discountCodeInfo,
    manualOrderDiscount,
    includeTax,
    quoteStatus,
    validUntil,
    runCartStockValidation,
    computeTotalsFromCartItems,
    mapCartToQuoteItems,
    isEditMode,
    existingQuote,
    createQuoteMutation,
    updateQuoteMutation,
    queryClient,
    router,
    toast,
    t,
  ]);

  const handleCheckout = useCallback(async () => {
    if (convertQuoteToOrderMutation.isPending || isConvertingQuoteRef.current) {
      return;
    }
    if (isCheckoutPreparingRef.current) {
      return;
    }

    if (existingQuote && existingQuote.status === "CONVERTED") {
      toast({
        type: "error",
        title: t("errors.error") || "Error",
        description:
          t("errors.quoteAlreadyConverted") ||
          "Quote has already been converted",
      });
      return;
    }

    if (cartItems.length === 0) {
      toast({
        type: "error",
        title: t("errors.cartEmpty") || "Cart Empty",
        description:
          t("errors.cartEmptyDescription") || "Please add items to the quote",
      });
      return;
    }

    if (!selectedLocation) {
      toast({
        type: "error",
        title: t("errors.locationRequired") || "Location Required",
        description:
          t("errors.locationRequiredDescription") || "Please select a location",
      });
      return;
    }

    if (!selectedCashier) {
      toast({
        type: "error",
        title: t("errors.cashierRequired") || "Cashier Required",
        description:
          t("errors.cashierRequiredDescription") || "Please select a cashier",
      });
      return;
    }

    if (!selectedSeller) {
      toast({
        type: "error",
        title: t("errors.sellerRequired") || "Seller Required",
        description:
          t("errors.sellerRequiredDescription") || "Please select a seller",
      });
      return;
    }

    isCheckoutPreparingRef.current = true;
    setIsCheckoutPreparing(true);
    try {
      const { hasStockIssues } = await runCartStockValidation(
        cartItems,
        selectedLocation.id
      );
      if (hasStockIssues) {
        toast({
          type: "error",
          title:
            t("errors.insufficientStockAtCheckout") || "Insufficient Stock",
          description:
            t("errors.insufficientStockAtCheckoutGeneric") ||
            "One or more items have insufficient stock at this location.",
        });
        return;
      }

      setIsCheckoutOpen(true);
    } finally {
      isCheckoutPreparingRef.current = false;
      setIsCheckoutPreparing(false);
    }
  }, [
    cartItems,
    selectedLocation,
    selectedCashier,
    selectedSeller,
    existingQuote,
    convertQuoteToOrderMutation.isPending,
    runCartStockValidation,
    toast,
    t,
  ]);

  const handleApproveAndReserve = useCallback(async () => {
    if (
      !existingQuote?.id ||
      !userData?.id ||
      quoteStatus !== "DRAFT" ||
      isSavingQuoteRef.current ||
      approveQuoteMutation.isPending ||
      updateQuoteMutation.isPending
    ) {
      return;
    }
    try {
      isSavingQuoteRef.current = true;
      setIsSavingQuote(true);
      if (
        cartItems.length === 0 ||
        !selectedLocation ||
        !selectedCashier ||
        !selectedSeller
      ) {
        toast({
          type: "error",
          title: t("errors.error") || "Error",
          description:
            t("errors.approveReserveMissingFields") ||
            "Complete location, cashier, seller and cart before approving.",
        });
        return;
      }
      const { items: validatedItems, hasStockIssues } =
        await runCartStockValidation(cartItems, selectedLocation.id);
      if (hasStockIssues) {
        toast({
          type: "error",
          title:
            t("errors.insufficientStockAtCheckout") || "Insufficient Stock",
          description:
            t("errors.insufficientStockAtCheckoutGeneric") ||
            "One or more items have insufficient stock at this location.",
        });
        return;
      }

      const totals = computeTotalsFromCartItems(validatedItems);
      let discountCodeValue = 0;
      if (discountCodeInfo) {
        if (discountCodeInfo.discountType === "PERCENTAGE") {
          discountCodeValue = Number(
            ((totals.subtotal * discountCodeInfo.value) / 100).toFixed(2)
          );
          if (
            discountCodeInfo.maxDiscount &&
            discountCodeValue > discountCodeInfo.maxDiscount
          ) {
            discountCodeValue = Number(discountCodeInfo.maxDiscount.toFixed(2));
          }
        } else {
          discountCodeValue = Number(discountCodeInfo.value.toFixed(2));
        }
      }
      const quoteData: CreateQuote = {
        ...(selectedCustomer?.id && { customerId: selectedCustomer.id }),
        ...(selectedLocation.branchId && {
          branchId: selectedLocation.branchId,
        }),
        locationId: selectedLocation.id,
        sellerId: selectedSeller.id,
        cashierId: selectedCashier.id,
        ...(discountCodeInfo?.id && { discountCodeId: discountCodeInfo.id }),
        ...(discountCodeValue > 0 && { discountCodeValue }),
        ...(manualOrderDiscount > 0 && { manualDiscount: manualOrderDiscount }),
        itemsDiscountTotal: totals.itemsDiscountTotal,
        discountAmount: totals.discountAmount,
        includeTax,
        status: "DRAFT",
        ...(validUntil && { validUntil: new Date(validUntil).toISOString() }),
        items: mapCartToQuoteItems(validatedItems),
      };
      await updateQuoteMutation.mutateAsync({
        id: existingQuote.id,
        data: quoteData,
      });
      const approved = await approveQuoteMutation.mutateAsync({
        id: existingQuote.id,
        userId: userData.id,
      });

      // Skip full quote reload in useEffect (avoids skeleton + empty cart flash).
      justSavedQuoteIdRef.current = existingQuote.id;

      setQuoteStatus("APPROVED");
      setCartItems(
        validatedItems.map(it => ({
          ...it,
          approvedQuoteReservedQuantity: it.quantity,
        }))
      );
      if (approved.validUntil) {
        setValidUntil(
          typeof approved.validUntil === "string"
            ? approved.validUntil.slice(0, 10)
            : new Date(approved.validUntil).toISOString().slice(0, 10)
        );
      }

      queryClient.setQueryData(
        quoteKeys.detail(existingQuote.id),
        (prev: Quote | undefined): Quote => {
          const base = prev ?? existingQuote!;
          const items =
            approved.items != null && approved.items.length > 0
              ? approved.items
              : (base.items ?? []);
          return {
            ...base,
            ...approved,
            items,
          };
        }
      );
      // Refresh list views only; invalidating all "quotes" refetches detail and fights justSaved / cart state.
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
      toast({
        type: "success",
        title: t("toast.approvedReserved") || "Proforma approved",
        description:
          t("toast.approvedReservedDescription") ||
          "Inventory has been reserved for this quote.",
      });
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("errors.errorDescription");
      toast({
        type: "error",
        title: t("errors.error") || "Error",
        description: msg,
      });
    } finally {
      isSavingQuoteRef.current = false;
      setIsSavingQuote(false);
    }
  }, [
    existingQuote,
    userData?.id,
    quoteStatus,
    approveQuoteMutation,
    updateQuoteMutation,
    cartItems,
    selectedLocation,
    selectedCashier,
    selectedSeller,
    selectedCustomer,
    discountCodeInfo,
    manualOrderDiscount,
    includeTax,
    validUntil,
    runCartStockValidation,
    computeTotalsFromCartItems,
    mapCartToQuoteItems,
    queryClient,
    toast,
    t,
    router,
  ]);

  const handleAnnulQuoteFromPage = useCallback(async () => {
    if (!existingQuote?.id || !userData?.id) return;
    const confirmed = await confirmationDialog.openDialog({
      title: t("confirm.annulTitle") || "Annul Quote",
      description:
        t("confirm.annulDesc", {
          quoteNumber: existingQuote.quoteNumber || existingQuote.id,
        }) ||
        `Are you sure you want to annul quote ${existingQuote.quoteNumber || existingQuote.id}?`,
      confirmText: t("confirm.annulButton") || "Annul",
      cancelText: t("confirm.cancel") || "Cancel",
    });
    if (!confirmed) return;
    try {
      await annulQuoteMutation.mutateAsync({
        id: existingQuote.id,
        userId: userData.id,
      });
      toast({
        title: t("toast.success") || "Success",
        description:
          t("toast.annulledQuoteDescription") ||
          "Quote has been annulled successfully",
        type: "success",
      });
      router.push("/sales/quotes");
    } catch (error) {
      toast({
        title: t("toast.error") || "Error",
        description:
          error instanceof Error
            ? error.message
            : t("toast.annulFailed") || "Failed to annul quote",
        type: "error",
      });
    }
  }, [
    annulQuoteMutation,
    confirmationDialog,
    existingQuote,
    router,
    t,
    toast,
    userData?.id,
  ]);

  const handleConvertQuoteToOrder = useCallback(
    async (
      payments: Payment[],
      creditData?: {
        creditType: "SHORT_TERM" | "EMPLOYEE_CREDIT" | "PROMOTIONAL";
        paymentFrequency: "WEEKLY" | "BI_WEEKLY" | "MONTHLY";
        durationDays: number;
        firstDueDate: string;
        initialPayment: number;
      }
    ) => {
      // Prevent duplicate submissions using ref for immediate synchronous check
      if (
        convertQuoteToOrderMutation.isPending ||
        isConvertingQuoteRef.current
      ) {
        return;
      }

      if (!existingQuote?.id) {
        toast({
          type: "error",
          title: t("errors.error") || "Error",
          description: t("errors.errorDescription") || "Quote not found",
        });
        return;
      }

      // Check if quote is already converted
      if (existingQuote.status === "CONVERTED") {
        toast({
          type: "error",
          title: t("errors.error") || "Error",
          description:
            t("errors.quoteAlreadyConverted") ||
            "Quote has already been converted",
        });
        return;
      }

      // Validate that quote has a totalAmount (required for payment validation)
      if (existingQuote.totalAmount == null) {
        toast({
          type: "error",
          title: t("errors.quoteMissingTotal") || "Quote Missing Total",
          description:
            t("errors.quoteMissingTotalDescription") ||
            "Quote is missing total amount. Please save the quote first.",
        });
        return;
      }

      if (!selectedLocation?.id) {
        toast({
          type: "error",
          title: t("errors.locationRequired") || "Location Required",
          description:
            t("errors.locationRequiredDescription") ||
            "Please select a location",
        });
        return;
      }

      const { hasStockIssues: convertHasStockIssues } =
        await runCartStockValidation(cartItems, selectedLocation.id);
      if (convertHasStockIssues) {
        toast({
          type: "error",
          title:
            t("errors.insufficientStockAtCheckout") || "Insufficient Stock",
          description:
            t("errors.insufficientStockAtCheckoutGeneric") ||
            "One or more items have insufficient stock at this location.",
        });
        return;
      }

      // Set ref immediately after validation to prevent concurrent submissions
      isConvertingQuoteRef.current = true;

      try {
        //Auto-save the quote before converting to ensure data consistency
        // This ensures the backend has the latest cart state (quantities, discounts, items)
        // We'll save silently in the background, but also send current cart items as a fallback
        if (isEditMode && existingQuote?.id) {
          try {
            // Check if there are any unsaved changes by comparing cart with saved quote
            const hasUnsavedChanges =
              cartItems.length !== (existingQuote.items?.length || 0) ||
              cartItems.some((item, index) => {
                const savedItem = existingQuote.items?.[index];
                return (
                  !savedItem ||
                  item.productVariantId !== savedItem.productVariantId ||
                  item.quantity !== savedItem.quantity ||
                  item.price !== savedItem.unitPrice ||
                  (item.discountAmount || 0) !== (savedItem.discountAmount || 0)
                );
              });

            // Auto-save if there are unsaved changes
            // Validate required fields before saving
            if (
              hasUnsavedChanges &&
              selectedLocation &&
              selectedCashier &&
              selectedSeller
            ) {
              const totals = calculateTotals();

              let discountCodeValue = 0;
              if (discountCodeInfo) {
                if (discountCodeInfo.discountType === "PERCENTAGE") {
                  discountCodeValue = Number(
                    ((totals.subtotal * discountCodeInfo.value) / 100).toFixed(
                      2
                    )
                  );
                  if (
                    discountCodeInfo.maxDiscount &&
                    discountCodeValue > discountCodeInfo.maxDiscount
                  ) {
                    discountCodeValue = Number(
                      discountCodeInfo.maxDiscount.toFixed(2)
                    );
                  }
                } else {
                  discountCodeValue = Number(discountCodeInfo.value.toFixed(2));
                }
              }

              const quoteData: CreateQuote = {
                ...(selectedCustomer?.id && {
                  customerId: selectedCustomer.id,
                }),
                ...(selectedLocation.branchId && {
                  branchId: selectedLocation.branchId,
                }),
                locationId: selectedLocation.id,
                sellerId: selectedSeller.id,
                cashierId: selectedCashier.id,
                ...(discountCodeInfo?.id && {
                  discountCodeId: discountCodeInfo.id,
                }),
                ...(discountCodeValue > 0 && { discountCodeValue }),
                ...(manualOrderDiscount > 0 && {
                  manualDiscount: manualOrderDiscount,
                }),
                itemsDiscountTotal: totals.itemsDiscountTotal,
                discountAmount: totals.discountAmount,
                includeTax,
                status: quoteStatus,
                ...(validUntil && {
                  validUntil: new Date(validUntil).toISOString(),
                }),
                items: cartItems.map(item => ({
                  productVariantId: item.productVariantId,
                  quantity: item.quantity,
                  unitPrice: item.price,
                  discountAmount: item.discountAmount || 0,
                })),
              };

              // Save quote silently (don't show toast to avoid interrupting conversion flow)
              await updateQuoteMutation.mutateAsync({
                id: existingQuote.id,
                data: quoteData,
              });

              if (quoteStatus === "APPROVED") {
                setCartItems(prev =>
                  prev.map(it => ({
                    ...it,
                    approvedQuoteReservedQuantity: it.quantity,
                  }))
                );
              }

              // Mark that we just saved to prevent useEffect from reloading
              justSavedQuoteIdRef.current = existingQuote.id;
            }
          } catch (saveError: any) {
            // If save fails, log but continue with conversion using current cart items
            // The backend will use the provided items as fallback
            console.warn(
              "Failed to auto-save quote before conversion:",
              saveError
            );
          }
        }

        // BEST PRACTICE: Auto-save the quote before converting to ensure data consistency
        // This ensures the backend has the latest cart state (quantities, discounts, items)
        // We'll save silently in the background, but also send current cart items as a fallback
        if (isEditMode && existingQuote?.id) {
          try {
            // Check if there are any unsaved changes by comparing cart with saved quote
            const hasUnsavedChanges =
              cartItems.length !== (existingQuote.items?.length || 0) ||
              cartItems.some((item, index) => {
                const savedItem = existingQuote.items?.[index];
                return (
                  !savedItem ||
                  item.productVariantId !== savedItem.productVariantId ||
                  item.quantity !== savedItem.quantity ||
                  item.price !== savedItem.unitPrice ||
                  (item.discountAmount || 0) !== (savedItem.discountAmount || 0)
                );
              });

            // Auto-save if there are unsaved changes
            // Validate required fields before saving
            if (
              hasUnsavedChanges &&
              selectedLocation &&
              selectedCashier &&
              selectedSeller
            ) {
              const totals = calculateTotals();

              let discountCodeValue = 0;
              if (discountCodeInfo) {
                if (discountCodeInfo.discountType === "PERCENTAGE") {
                  discountCodeValue = Number(
                    ((totals.subtotal * discountCodeInfo.value) / 100).toFixed(
                      2
                    )
                  );
                  if (
                    discountCodeInfo.maxDiscount &&
                    discountCodeValue > discountCodeInfo.maxDiscount
                  ) {
                    discountCodeValue = Number(
                      discountCodeInfo.maxDiscount.toFixed(2)
                    );
                  }
                } else {
                  discountCodeValue = Number(discountCodeInfo.value.toFixed(2));
                }
              }

              const quoteData: CreateQuote = {
                ...(selectedCustomer?.id && {
                  customerId: selectedCustomer.id,
                }),
                ...(selectedLocation.branchId && {
                  branchId: selectedLocation.branchId,
                }),
                locationId: selectedLocation.id,
                sellerId: selectedSeller.id,
                cashierId: selectedCashier.id,
                ...(discountCodeInfo?.id && {
                  discountCodeId: discountCodeInfo.id,
                }),
                ...(discountCodeValue > 0 && { discountCodeValue }),
                ...(manualOrderDiscount > 0 && {
                  manualDiscount: manualOrderDiscount,
                }),
                itemsDiscountTotal: totals.itemsDiscountTotal,
                discountAmount: totals.discountAmount,
                includeTax,
                status: quoteStatus,
                ...(validUntil && {
                  validUntil: new Date(validUntil).toISOString(),
                }),
                items: cartItems.map(item => ({
                  productVariantId: item.productVariantId,
                  ...(item.priceTypeId && { priceTypeId: item.priceTypeId }),
                  quantity: item.quantity,
                  unitPrice: item.price,
                  discountAmount: item.discountAmount || 0,
                })),
              };

              // Save quote silently (don't show toast to avoid interrupting conversion flow)
              await updateQuoteMutation.mutateAsync({
                id: existingQuote.id,
                data: quoteData,
              });

              if (quoteStatus === "APPROVED") {
                setCartItems(prev =>
                  prev.map(it => ({
                    ...it,
                    approvedQuoteReservedQuantity: it.quantity,
                  }))
                );
              }

              // Mark that we just saved to prevent useEffect from reloading
              justSavedQuoteIdRef.current = existingQuote.id;
            }
          } catch (saveError: any) {
            // If save fails, log but continue with conversion using current cart items
            // The backend will use the provided items as fallback
            console.warn(
              "Failed to auto-save quote before conversion:",
              saveError
            );
          }
        }

        // Determine payment method
        const paymentMethod = creditData ? "CREDIT" : "CASH";

        // Validate cash session is open (required only for CASH payment method)
        if (paymentMethod === "CASH" && !effectiveCashSession) {
          isConvertingQuoteRef.current = false;
          toast({
            title: t("errors.noCashSession") || "No Cash Session",
            description:
              t("errors.noCashSessionMessage") ||
              "Please open a cash session before converting quote to order",
            type: "error",
          });
          setIsOpenCashModalOpen(true);
          return;
        }

        const hasCashPayment = payments.some(
          p => p.paymentType === "CASH" || p.paymentType === "DOWN_PAYMENT"
        );

        // Calculate current totals to get discount values
        const currentTotals = calculateTotals();

        // Calculate current discount code value
        let currentDiscountCodeValue = 0;
        if (discountCodeInfo) {
          if (discountCodeInfo.discountType === "PERCENTAGE") {
            currentDiscountCodeValue = Number(
              ((currentTotals.subtotal * discountCodeInfo.value) / 100).toFixed(
                2
              )
            );
            if (
              discountCodeInfo.maxDiscount &&
              currentDiscountCodeValue > discountCodeInfo.maxDiscount
            ) {
              currentDiscountCodeValue = Number(
                discountCodeInfo.maxDiscount.toFixed(2)
              );
            }
          } else {
            currentDiscountCodeValue = Number(
              discountCodeInfo.value.toFixed(2)
            );
          }
        }

        // Include current cart items and discount/tax values in conversion request
        // Backend will use these if provided, otherwise use saved quote values
        // This ensures backend recalculates totals using the same values the frontend used

        // Calculate current totals to get discount values

        // Calculate current discount code value

        // Include current cart items and discount/tax values in conversion request
        // Backend will use these if provided, otherwise use saved quote values
        // This ensures backend recalculates totals using the same values the frontend used

        // Calculate current totals to get discount values

        // Calculate current discount code value

        // Include current cart items and discount/tax values in conversion request
        // Backend will use these if provided, otherwise use saved quote values
        // This ensures backend recalculates totals using the same values the frontend used
        const convertData: ConvertQuoteToOrder = {
          ...(hasCashPayment &&
            effectiveCashSession && {
              cashSessionId: effectiveCashSession.id,
            }),
          paymentMethod,
          payments: payments.map(p => ({
            paymentType: p.paymentType,
            amount: Number(p.amount),
            ...(p.provider && { provider: p.provider }),
            ...(p.transactionReference && {
              transactionReference: p.transactionReference,
            }),
          })),
          // Credit-related fields
          ...(creditData && {
            creditType: creditData.creditType,
            paymentFrequency: creditData.paymentFrequency,
            durationDays: Number(creditData.durationDays),
            firstDueDate: creditData.firstDueDate,
            initialPayment: Number(creditData.initialPayment || 0),
          }),
          // Include current cart items to ensure backend uses latest state
          // This is a fallback in case auto-save didn't complete or failed
          // IMPORTANT: Calculate discountAmount from discountPercentage if discountAmount is not set
          // This ensures backend receives the same discount value the frontend calculated

          items: updatedCart.map(item => {
            // If discountAmount is set, use it; otherwise calculate from discountPercentage
            let itemDiscountAmount = item.discountAmount || 0;
            if (
              !itemDiscountAmount &&
              item.discountPercentage &&
              item.discountPercentage > 0
            ) {
              const itemSubtotal = item.price * item.quantity;
              itemDiscountAmount = Number(
                ((itemSubtotal * item.discountPercentage) / 100).toFixed(2)
              );
            }

            const mappedItem = {
              productVariantId: item.productVariantId,
              quantity: Number(item.quantity),
              unitPrice: Number(item.price),
              discountAmount: Number(itemDiscountAmount),
              ...(item.priceTypeId && { priceTypeId: item.priceTypeId }),
              ...(item.type && { type: item.type }),

              ...(item.type === "KIT" &&
                item.kitItems &&
                item.kitItems.length > 0 && {
                  kitItems: item.kitItems.map((kitItem: any) => ({
                    productVariantId: kitItem.productVariantId,
                    quantity: Math.round(Number(kitItem.quantity)),
                  })),
                }),
              metadata: {
                fromQuoteId: existingQuote?.id,
                fromQuoteItemId: (item as any).id,
                ...((item as any).metadata || {}),
              },
            };

            return mappedItem;
          }),
          // Include current discount/tax values so backend recalculates with same values
          // This prevents mismatches when these values changed but quote wasn't saved yet
          // IMPORTANT: Always send these values (even if 0) when items are provided
          // This ensures backend uses current state, not saved quote values
          discountCodeValue:
            typeof currentDiscountCodeValue === "number"
              ? currentDiscountCodeValue
              : 0,
          manualDiscount:
            typeof manualOrderDiscount === "number" ? manualOrderDiscount : 0,
          includeTax: !!includeTax,
        };

        // items integrity check - ensure all items have unitPrice defined
        const missingPrices = convertData.items?.filter(i => !i.unitPrice);
        if (missingPrices && missingPrices.length > 0) {
        }

        const order = await convertQuoteToOrderMutation.mutateAsync({
          id: existingQuote.id,
          data: convertData,
        });

        setIsCheckoutOpen(false);

        try {
          const { timeZone } = getReportExportMeta();
          const pdf = await exportReceiptPdf(order.id, { timeZone });
          downloadBase64Pdf(pdf.fileName, pdf.base64);
        } catch (pdfErr) {
          console.error(pdfErr);
          toast({
            type: "warning",
            title: tPos("receipt.pdfDownloadFailed") || "Receipt PDF",
            description:
              tPos("receipt.pdfDownloadFailedDescription") ||
              "The sale was completed but the receipt could not be downloaded. You can print it from the order detail.",
          });
        }

        toast({
          type: "success",
          title: t("toast.quoteConverted") || "Quote Converted",
          description:
            t("toast.quoteConvertedDescription", {
              orderNumber: order.orderNumber || order.id,
            }) ||
            `Quote has been converted to order ${order.orderNumber || order.id}`,
        });

        router.push("/sales/quotes");
      } catch (error: any) {
        // Extract error message from various possible formats
        let errorMessage = "";
        if (error?.response?.message) {
          // Error from ServerApiClient with response object
          errorMessage = error.response.message;
        } else if (error?.message) {
          // Standard error message (may include "API Error: 409 - " prefix)
          errorMessage = error.message;
          // Remove "API Error: XXX - " prefix if present
          const prefixMatch = errorMessage.match(/^API Error: \d+ - (.+)$/);
          if (prefixMatch && prefixMatch[1]) {
            errorMessage = prefixMatch[1];
          }
        }

        const isAlreadyConvertedError =
          errorMessage.toLowerCase().includes("already been converted") ||
          errorMessage.toLowerCase().includes("already converted");
        const isExpiredError =
          errorMessage.toLowerCase().includes("expired quote") ||
          errorMessage.toLowerCase().includes("cannot convert an expired");
        const isStockError =
          errorMessage.includes("Insufficient stock") ||
          errorMessage.includes("insufficient stock") ||
          error?.status === 409 ||
          error?.response?.statusCode === 409;

        if (isAlreadyConvertedError) {
          toast({
            type: "error",
            title:
              t("errors.quoteAlreadyConverted") || "Quote Already Converted",
            description:
              t("errors.quoteAlreadyConvertedDescription") ||
              "This quote has already been converted to an order and cannot be converted again.",
          });
        } else if (isExpiredError) {
          toast({
            type: "error",
            title: t("errors.quoteExpired") || "Quote Expired",
            description:
              t("errors.quoteExpiredDescription") ||
              "This quote has expired and cannot be converted to an order.",
          });
        } else if (isStockError) {
          // Extract product name and stock info from error message if available
          const stockMatch = errorMessage.match(
            /Insufficient stock for (.+?)\. Available: (\d+), Requested: (\d+)/i
          );

          let errorDescription = "";
          if (stockMatch && stockMatch[1] && stockMatch[2] && stockMatch[3]) {
            const [, productName, available, requested] = stockMatch;
            errorDescription =
              t("errors.insufficientStockAtCheckoutDescription", {
                productName,
                available,
                requested,
              }) ||
              `Insufficient stock for ${productName}. Available: ${available}, Requested: ${requested}. Please adjust the quantity or remove the item.`;

            toast({
              type: "error",
              title:
                t("errors.insufficientStockAtCheckout") || "Insufficient Stock",
              description: errorDescription,
            });

            // Find and mark the cart item with the error
            const matchingItem = cartItems.find(
              item => item.name === productName.trim()
            );

            if (matchingItem) {
              // Update the cart item to include the error
              setCartItems(prevItems =>
                prevItems.map(item =>
                  item.productVariantId === matchingItem.productVariantId
                    ? {
                        ...item,
                        stockError: errorDescription,
                        // Update available stock from error if available
                        availableStock: Number.parseInt(available, 10),
                      }
                    : item
                )
              );
            }
          } else {
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

            // Mark all cart items with generic error if we can't identify the specific product
            setCartItems(prevItems =>
              prevItems.map(item => ({
                ...item,
                stockError: genericError,
              }))
            );
          }
        } else {
          toast({
            type: "error",
            title: t("errors.error") || "Error",
            description:
              errorMessage ||
              t("errors.errorDescription") ||
              "An error occurred",
          });
        }
      } finally {
        // Reset ref after operation completes (success or error)
        isConvertingQuoteRef.current = false;
      }
    },
    [
      existingQuote,
      effectiveCashSession,
      convertQuoteToOrderMutation,
      cartItems,
      isEditMode,
      selectedLocation,
      selectedCashier,
      selectedSeller,
      selectedCustomer,
      discountCodeInfo,
      manualOrderDiscount,
      includeTax,
      quoteStatus,
      validUntil,
      calculateTotals,
      updateQuoteMutation,
      updatedCart,
      runCartStockValidation,
      toast,
      router,
      t,
      tPos,
    ]
  );

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

  // Show skeleton loader when loading quote data in edit mode
  if (isEditMode && isLoadingQuoteData) {
    return (
      <div className="flex h-screen flex-col">
        {/* Header Skeleton */}
        <div className="border-border/50 border-b bg-white/50 backdrop-blur-sm dark:bg-gray-800/50">
          <div className="px-3 py-3 sm:px-4 sm:py-4 md:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton className="h-8 w-48" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="flex flex-1 flex-col gap-0 overflow-hidden lg:grid lg:grid-cols-[1fr,400px] xl:grid-cols-[1fr,480px]">
          {/* Product Search Skeleton */}
          <div className="border-border/50 flex-1 space-y-4 overflow-hidden border-r-0 bg-white/50 p-4 backdrop-blur-sm dark:bg-gray-800/50 lg:border-r">
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-32 w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          </div>

          {/* Shopping Cart Skeleton */}
          <div className="hidden space-y-4 overflow-hidden bg-white/50 p-4 backdrop-blur-sm dark:bg-gray-800/50 lg:block">
            <Skeleton className="h-8 w-32" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="border-border space-y-3 rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-6 rounded" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
            <div className="border-border space-y-3 border-t pt-4">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <POSHeader
        title={title || t("page.title")}
        isQuoteMode
        disabled={Boolean(isEditMode && existingQuote?.status === "CONVERTED")}
        quoteStatus={existingQuote?.status}
        quoteNumber={existingQuote?.quoteNumber}
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
        showCashRegisterSelect={!isSalesRep && Boolean(isEditMode)}
        selectedCashier={selectedCashier}
        onSelectCashier={setSelectedCashier}
        selectedSeller={selectedSeller}
        onSelectSeller={setSelectedSeller}
        sellerSelectDisabled={false}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={setSelectedCustomer}
        currentCustomerObject={currentCustomerObject}
        cashRegisterOptions={
          existingQuote &&
          existingQuote.status !== "CONVERTED" &&
          (isAdmin ||
            isCashier ||
            (isSalesRep && existingQuote.status === "DRAFT") ||
            (isStoreManager && existingQuote.status === "DRAFT")) && (
            <ConvertToOrderButton
              onCheckout={handleCheckout}
              onAnnul={handleAnnulQuoteFromPage}
              onApproveAndReserve={handleApproveAndReserve}
              showApproveAndReserve={quoteStatus === "DRAFT"}
              isApproving={approveQuoteMutation.isPending}
              isConverting={convertQuoteToOrderMutation.isPending}
              isCheckoutPreparing={isCheckoutPreparing}
              isAnnulling={annulQuoteMutation.isPending}
              disableCheckout={
                !selectedCashRegister ||
                selectedCashRegister.openSessionId == null ||
                hasError
              }
              disableApproveAndReserve={
                !userData?.id || updateQuoteMutation.isPending || hasError
              }
              disabled={
                !existingQuote ||
                convertQuoteToOrderMutation.isPending ||
                approveQuoteMutation.isPending ||
                cartItems.length === 0
              }
            />
          )
        }
      />

      <div className="flex flex-1 flex-col gap-0 overflow-hidden lg:grid lg:grid-cols-[1fr,400px] xl:grid-cols-[1fr,480px]">
        {/* Product Search */}
        <div className="border-border/50 min-h-0 flex-1 overflow-hidden border-r-0 bg-white/50 backdrop-blur-sm dark:bg-gray-800/50 lg:border-r">
          <ProductSearch
            key={productSearchKey}
            onAddToCart={handleAddToCart}
            locationId={selectedLocation?.id}
            selectedCustomer={selectedCustomer}
            cartItems={updatedCart as CartItem[]}
          />
        </div>

        {/* Shopping Cart */}
        <div className="hidden overflow-hidden bg-white/50 backdrop-blur-sm dark:bg-gray-800/50 lg:block">
          <ShoppingCart
            items={updatedCart as CartItem[]}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onUpdateItemDiscount={handleUpdateItemDiscount}
            onUpdatePriceType={handleUpdatePriceType}
            customerId={selectedCustomer?.id ?? ""}
            selectedCustomer={selectedCustomer}
            onCheckout={handleSaveQuote}
            checkoutButtonText={t("saveQuote") || "Save Quote"}
            isSubmitting={
              isLoadingStock ||
              createQuoteMutation.isPending ||
              updateQuoteMutation.isPending ||
              isSavingQuoteRef.current ||
              isSavingQuote
            }
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
                itemsSubtotal > 0
                  ? Number(((clampedAmount / itemsSubtotal) * 100).toFixed(2))
                  : 0;
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
            showCancelButton={!isEditMode}
            stockValidationBlocked={hasError}
            isQuoteMode
            quoteStatus={existingQuote?.status ?? quoteStatus}
          />
        </div>

        {/* Mobile Cart Drawer */}
        <MobileCartDrawer
          isOpen={isMobileCartOpen}
          onClose={() => setIsMobileCartOpen(false)}
          items={updatedCart as CartItem[]}
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
              itemsSubtotal > 0
                ? Number(((clampedAmount / itemsSubtotal) * 100).toFixed(2))
                : 0;
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
          customerId={selectedCustomer?.id ?? ""}
          selectedCustomer={selectedCustomer}
          onCheckout={handleSaveQuote}
          onResetCart={resetCart}
          onApproveQuote={handleApproveAndReserve}
          checkoutButtonText={t("saveQuote") || "Save Quote"}
          isSubmitting={
            isLoadingStock ||
            createQuoteMutation.isPending ||
            updateQuoteMutation.isPending ||
            approveQuoteMutation.isPending ||
            isSavingQuoteRef.current ||
            isSavingQuote
          }
          stockValidationBlocked={hasError}
          isQuoteMode
          quoteStatus={existingQuote?.status ?? quoteStatus}
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

      {/* Checkout Modal */}
      {existingQuote && (
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          totals={getCheckoutTotals()}
          onConfirm={handleConvertQuoteToOrder}
          selectedCustomer={selectedCustomer}
          isSubmitting={convertQuoteToOrderMutation.isPending}
        />
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

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}
