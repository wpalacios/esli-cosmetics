"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  Button,
  Input,
  Label,
} from "@esli-cosmetics/ui";
import {
  useOpenCashSession,
  useOpenCashSessionsByLocation,
  useCashRegisters,
} from "@/hooks/use-cash-register";
import { useToast } from "@/hooks/toast/use-toast";
import { formatDateTimeWithTimezone } from "@esli-cosmetics/utils";
import { CashRegisterSelect } from "@/components/ui/cash-register-select";
import { useCurrentUser, useHasRole } from "~/hooks/use-auth";
import { CashRegister } from "@esli-cosmetics/types";

const createOpenSessionSchema = (
  t: (key: string) => string,
  hasPreSelectedCashRegister: boolean = false
) =>
  z.object({
    cashRegisterId: hasPreSelectedCashRegister
      ? z.string().optional()
      : z.string().min(1, t("validation.cashRegisterRequired")),
    openingBalance: z.number().min(0, t("validation.openingBalanceMin")),
  });

type OpenSessionFormData = z.infer<ReturnType<typeof createOpenSessionSchema>>;

interface OpenCashSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (
    session?: any, // CashSession object when admin accesses an existing session, or undefined after creating a new one
    cashRegisterId?: string
  ) => void | Promise<void>;
  locationId?: string | undefined;
  cashRegisterId?: string | undefined; // Pre-selected cash register ID
  cashRegisterName?: string | undefined; // Pre-selected cash register name
}

export function OpenCashSessionModal({
  isOpen,
  onClose,
  onSuccess,
  locationId,
  cashRegisterId: preSelectedCashRegisterId,
  cashRegisterName: preSelectedCashRegisterName,
}: OpenCashSessionModalProps) {
  const { t } = useTranslation("cash-register");
  const { toast } = useToast();
  const openSessionMutation = useOpenCashSession();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<OpenSessionFormData>({
    resolver: zodResolver(
      createOpenSessionSchema(t, !!preSelectedCashRegisterId)
    ),
    defaultValues: {
      openingBalance: 0,
      ...(preSelectedCashRegisterId && {
        cashRegisterId: preSelectedCashRegisterId,
      }),
    },
  });

  const cashRegisterId = watch("cashRegisterId");
  const effectiveCashRegisterId = preSelectedCashRegisterId || cashRegisterId;
  const { data: user } = useCurrentUser();
  const isCashier = useHasRole("cashier");
  const isAdmin = user?.roles?.includes("admin");

  // For cashier users, use their location; otherwise use the passed locationId
  // The location is available directly on the user profile (not nested in employee)
  const employeeLocationId = user?.location?.id;

  // Determine the effective location ID to use:
  // - If cashier (not admin) and has location: use employee location
  // - If cashier (not admin) and NO location: use undefined (will show error, not all registers)
  // - Otherwise: use the passed locationId prop
  const effectiveLocationId =
    isCashier && !isAdmin
      ? employeeLocationId || undefined // Explicitly undefined if no location (prevents showing all)
      : locationId;

  // Check if cashier has no location assigned
  const cashierHasNoLocation = isCashier && !isAdmin && !employeeLocationId;

  const { data: openSessions } =
    useOpenCashSessionsByLocation(effectiveLocationId);

  const cashSessionOpen = !!openSessions?.find(
    session =>
      session.cashRegisterId === effectiveCashRegisterId &&
      session.status === "open"
  );

  const onSubmit = async (data: OpenSessionFormData) => {
    // Use pre-selected cash register ID if available, otherwise use form data
    const finalCashRegisterId: string =
      preSelectedCashRegisterId || data.cashRegisterId || "";

    if (!finalCashRegisterId) {
      toast({
        title: t("messages.error"),
        description: t("validation.cashRegisterRequired"),
        type: "error",
      });
      return;
    }

    const openSession = openSessions?.find(
      session =>
        session.cashRegisterId === finalCashRegisterId &&
        session.status === "open"
    );

    // If register already has an open session, join it (for all users)
    // The backend will return the existing session when we call openSession
    if (openSession) {
      try {
        // Call openSession - backend will return existing session if one exists
        const session = await openSessionMutation.mutateAsync({
          cashRegisterId: finalCashRegisterId,
          openingBalance: 0, // Opening balance not needed when joining existing session
          openedAt: formatDateTimeWithTimezone(),
        });
        toast({
          title: t("messages.sessionJoined") || t("messages.sessionOpened"),
          description:
            t("messages.joinedExistingSession") ||
            "Joined existing cash register session",
          type: "success",
        });
        reset();
        await onSuccess(session, finalCashRegisterId);
        handleClose();
        return;
      } catch (error: any) {
        toast({
          title: t("messages.error"),
          description: error?.message || t("messages.openFailed"),
          type: "error",
        });
        return;
      }
    }

    // Register is closed, create new session
    try {
      await openSessionMutation.mutateAsync({
        cashRegisterId: finalCashRegisterId,
        openingBalance: data.openingBalance,
        openedAt: formatDateTimeWithTimezone(),
      });
      toast({
        title: t("messages.sessionOpened"),
        type: "success",
      });
      reset();
      await onSuccess();
    } catch (error: any) {
      toast({
        title: t("messages.error"),
        description: error?.message || t("messages.openFailed"),
        type: "error",
      });
    }
  };

  const handleClose = () => {
    if (!openSessionMutation.isPending) {
      reset();
      onClose();
    }
  };

  // Get all cash registers for the location
  // For cashier users without location, don't fetch (will show error message)
  // For cashier users with location, only fetch their location's registers
  // For admin/other roles, use the passed locationId or fetch all if undefined
  // Note: When cashierHasNoLocation is true, we don't want to fetch any registers
  const shouldFetchRegisters = !cashierHasNoLocation;
  const cashRegistersParams = effectiveLocationId
    ? { locationId: effectiveLocationId }
    : undefined; // If no effectiveLocationId, fetch all (for admin) or none (for cashier without location)

  // Only fetch if we should (prevents fetching all registers when cashier has no location)
  const { data: cashRegistersResponse } = useCashRegisters(
    shouldFetchRegisters ? cashRegistersParams : undefined
  );

  useEffect(() => {
    if (isOpen) {
      // If a cash register is pre-selected, use it
      if (preSelectedCashRegisterId) {
        setValue("cashRegisterId", preSelectedCashRegisterId, {
          shouldValidate: true,
        });
      } else if (cashRegistersResponse?.data) {
        const cashRegisters: CashRegister[] = cashRegistersResponse.data;
        const firstClosed = cashRegisters.find(
          cashRegister => cashRegister.openSessionId == null
        );
        let selectedId = "";
        if (firstClosed) {
          selectedId = firstClosed.id;
        } else if (isAdmin && cashRegisters.length > 0 && cashRegisters[0]) {
          selectedId = cashRegisters[0].id;
        }
        setValue("cashRegisterId", selectedId, { shouldValidate: true });
      }
    }
  }, [
    isOpen,
    preSelectedCashRegisterId,
    cashRegistersResponse,
    setValue,
    isAdmin,
  ]);

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent
        size="lg"
        onInteractOutside={e => {
          // Prevent modal from closing when clicking on Select dropdown
          const target = e.target as HTMLElement;
          // Check if click is on the Select dropdown (portal content)
          const isSelectContent =
            target.closest("[data-radix-select-content]") ||
            target.closest("[data-radix-select-viewport]") ||
            target.closest("[data-radix-select-item]") ||
            target.closest("[data-radix-popper-content-wrapper]");
          if (isSelectContent) {
            e.preventDefault();
          }
        }}
      >
        <ModalHeader>
          <ModalTitle>{t("open.title")}</ModalTitle>
        </ModalHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="space-y-6 px-6 py-4">
            {/* Show cash register name if pre-selected, otherwise show select */}
            {preSelectedCashRegisterId && preSelectedCashRegisterName ? (
              <div>
                <Label htmlFor="cashRegisterId">{t("open.cashRegister")}</Label>
                <div className="mt-1 rounded-md bg-gray-100 px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-white">
                  {preSelectedCashRegisterName}
                </div>
                <input
                  type="hidden"
                  {...register("cashRegisterId")}
                  value={preSelectedCashRegisterId}
                />
                {cashSessionOpen && (
                  <div className="mt-2 rounded bg-blue-50 p-2 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                    {t("session.sessionAlreadyOpen") ||
                      "This cash register already has an open session. You will join the existing session."}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <Label htmlFor="cashRegisterId">{t("open.cashRegister")}</Label>
                {cashierHasNoLocation ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">
                      {t("messages.noLocationAssigned") ||
                        "No location assigned"}
                    </p>
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {t("messages.contactAdminForLocation") ||
                        "Please contact an administrator to assign a location to your account."}
                    </p>
                  </div>
                ) : (
                  <CashRegisterSelect
                    value={cashRegisterId}
                    onChange={value => {
                      setValue("cashRegisterId", value || "", {
                        shouldValidate: true,
                      });
                    }}
                    placeholder={t("open.selectRegister")}
                    disabled={openSessionMutation.isPending}
                    error={errors.cashRegisterId?.message}
                    locationId={effectiveLocationId}
                    renderOption={option => {
                      const isOpenSession = openSessions?.some(
                        session =>
                          session.cashRegisterId === option.data?.id &&
                          session.status === "open"
                      );
                      // Show all registers to all users - allow joining existing sessions
                      const status = isOpenSession ? "open" : "closed";
                      const openSession = openSessions?.find(
                        session =>
                          session.cashRegisterId === option.data?.id &&
                          session.status === "open"
                      );

                      return (
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-gray-900 dark:text-white">
                            {option.data?.name || option.label}
                          </span>
                          <div className="mt-0.5 flex items-center gap-2">
                            {option.data?.location?.name && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {option.data.location.name}
                              </span>
                            )}
                            <span
                              className={`ml-2 rounded px-2 py-0.5 text-xs font-bold ${
                                status === "open"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                                  : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
                              } `}
                            >
                              {t(`status.${status}`)}
                            </span>
                            {isOpenSession && openSession?.employee?.person && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                • {t("session.openedBy") || "Opened by"}:{" "}
                                {`${openSession.employee.person.firstName || ""} ${openSession.employee.person.lastName || ""}`.trim()}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                )}
                {cashSessionOpen && (
                  <div className="mt-2 rounded bg-blue-50 p-2 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                    {t("session.sessionAlreadyOpen") ||
                      "This cash register already has an open session. You will join the existing session."}
                  </div>
                )}
              </div>
            )}

            {/* Only show opening balance input when opening a new session (not joining existing) */}
            {!cashSessionOpen && (
              <div>
                <Label htmlFor="openingBalance">
                  {t("open.openingBalance")}
                </Label>
                <Input
                  id="openingBalance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={t("open.openingBalance")}
                  disabled={openSessionMutation.isPending}
                  {...register("openingBalance", { valueAsNumber: true })}
                  {...(errors.openingBalance?.message && {
                    error: errors.openingBalance.message,
                  })}
                />
              </div>
            )}
          </div>

          <ModalFooter>
            <Button
              type="submit"
              disabled={openSessionMutation.isPending || cashierHasNoLocation}
            >
              {(() => {
                if (openSessionMutation.isPending) {
                  return t("common.loading");
                }
                if (cashSessionOpen) {
                  return (
                    t("session.joinSession") ||
                    t("session.accessToRegister") ||
                    "Join Session"
                  );
                }
                return t("open.submit");
              })()}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={openSessionMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
