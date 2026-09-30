"use client";

import { BiXCircle, BiDollar, BiLockOpen } from "react-icons/bi";
import { useTranslation } from "react-i18next";
import { FaCashRegister } from "react-icons/fa";

import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@esli-cosmetics/ui";

interface CashRegisterOptionsProps {
  cashSessionStatus?: "open" | "closed" | null;
  onCloseCashRegister: () => void;
  onCreateMovement: () => void;
  onOpenCashRegister?: () => void;
}

export function CashRegisterOptions({
  cashSessionStatus,
  onCloseCashRegister,
  onCreateMovement,
  onOpenCashRegister,
}: CashRegisterOptionsProps) {
  const { t } = useTranslation("cash-register");

  const isOpen = cashSessionStatus === "open";
  const isClosed = cashSessionStatus === "closed";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isOpen ? "primary" : "outline"}
          size="sm"
          className="flex items-center gap-2"
        >
          <FaCashRegister className="h-4 w-4" />
          <span className="hidden md:inline">{t("title")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {onOpenCashRegister && (
          <>
            <DropdownMenuItem
              onClick={onOpenCashRegister}
              disabled={!isClosed}
              className="flex items-center gap-2"
            >
              <BiLockOpen className="h-4 w-4" />
              <span>{t("actions.openCashRegister")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={onCloseCashRegister}
          disabled={!isOpen}
          className="flex items-center gap-2"
        >
          <BiXCircle className="h-4 w-4" />
          <span>{t("actions.close")}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onCreateMovement}
          disabled={!isOpen}
          className="flex items-center gap-2"
        >
          <BiDollar className="h-4 w-4" />
          <span>{t("actions.createMovement")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
