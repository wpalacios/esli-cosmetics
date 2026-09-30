"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@esli-cosmetics/ui";
import { CheckCircledIcon, CrossCircledIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { BiShoppingBag, BiChevronDown, BiLock } from "react-icons/bi";

interface ConvertToOrderButtonProps {
  onCheckout: () => void | Promise<void>;
  onAnnul: () => void;
  onApproveAndReserve?: () => void | Promise<void>;
  /** Show "approve and reserve" (DRAFT only) */
  showApproveAndReserve?: boolean;
  isApproving?: boolean;
  isConverting?: boolean;
  /** True while opening checkout (e.g. async stock validation before modal). */
  isCheckoutPreparing?: boolean;
  isAnnulling?: boolean;
  disabled?: boolean;
  /** Disables only the "complete sale" row (e.g. no open cash session) */
  disableCheckout?: boolean;
  /** Disables "approve and reserve" row */
  disableApproveAndReserve?: boolean;
}

export function ConvertToOrderButton({
  onCheckout,
  onAnnul,
  onApproveAndReserve,
  showApproveAndReserve = false,
  isApproving = false,
  isConverting = false,
  isCheckoutPreparing = false,
  isAnnulling = false,
  disabled = false,
  disableCheckout = false,
  disableApproveAndReserve = false,
}: ConvertToOrderButtonProps) {
  const { t } = useTranslation("quotes");
  const busy =
    isConverting || isAnnulling || isApproving || isCheckoutPreparing;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={disabled || busy}
          variant="primary"
          size="sm"
          className="flex items-center gap-2 pr-2 font-normal transition-all active:scale-95"
          leftIcon={
            busy ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <BiShoppingBag className="h-4 w-4" />
            )
          }
          rightIcon={
            <div className="ml-1 border-l border-white/20 pl-1">
              <BiChevronDown className="h-4 w-4" />
            </div>
          }
        >
          {busy ? t("processing") : t("actions")}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
      >
        <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {t("actions") || "Acciones"}
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="mx-1 mb-1 bg-gray-100 dark:bg-gray-700" />

        {showApproveAndReserve && onApproveAndReserve && (
          <>
            <DropdownMenuItem
              onClick={() => void onApproveAndReserve()}
              disabled={isApproving || disableApproveAndReserve}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#ff48b0] transition-colors focus:bg-pink-50 focus:text-pink-800 dark:focus:bg-pink-900/20"
            >
              <BiLock className="h-5 w-5 shrink-0" />
              <span className="whitespace-nowrap font-normal">
                {t("dropdown.approveAndReserve") || "Aprobar y reservar stock"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1 bg-gray-100 dark:bg-gray-700" />
          </>
        )}

        <DropdownMenuItem
          onClick={() => void onCheckout()}
          disabled={isConverting || isCheckoutPreparing || disableCheckout}
          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-green-600 transition-colors focus:bg-green-50 focus:text-green-700 dark:focus:bg-green-900/20"
        >
          <CheckCircledIcon className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap font-normal">
            {t("dropdown.approveAndSell") || "Aprobar y completar venta"}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 bg-gray-100 dark:bg-gray-700" />

        <DropdownMenuItem
          onClick={onAnnul}
          disabled={isAnnulling}
          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-600 transition-colors focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-900/20"
        >
          <CrossCircledIcon className="h-4 w-4 shrink-0" />
          <span className="font-normal">{t("dropdown.annul") || "Anular"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
