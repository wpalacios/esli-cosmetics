"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  Button,
  Input,
  Label,
  DataTable,
  FileUpload,
} from "@esli-cosmetics/ui";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  BulkPurchaseImportRow,
  VariantDisplayNameResolveEntry,
} from "@esli-cosmetics/types";
import { useLocations } from "@/hooks/use-locations";
import { getPrices } from "@/actions/prices";
import {
  bulkPurchaseImport,
  resolveVariantDisplayNames,
} from "@/actions/stock-movements";
import {
  parsePurchaseExcelSheet,
  type ParsePurchaseExcelResult,
} from "@/lib/stock/purchase-excel-parse";
import {
  BULK_PURCHASE_MAX_ROWS_PER_REQUEST,
  RESOLVE_VARIANT_NAMES_CHUNK,
} from "@/lib/stock/purchase-excel-constants";
import { FileTextIcon } from "@radix-ui/react-icons";

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

interface RowPreviewIssue {
  /** Text from the Item column (Excel) so the user knows which row failed */
  itemLabel: string;
  /** 1-based row index in the spreadsheet (matches Excel row numbers) */
  sheetRow: number;
  message: string;
}

/** Row skipped from import with a non-blocking warning */
interface RowImportWarning {
  itemLabel: string;
  sheetRow: number;
  message: string;
}

/** One importable spreadsheet row, ordered by `sheetRow` for preview and batches. */
interface ImportableSheetRow {
  readonly sheetRow: number;
  readonly itemLabel: string;
  readonly row: BulkPurchaseImportRow;
}

interface PurchaseExcelImportModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

export function PurchaseExcelImportModal({
  open,
  onClose,
  onSuccess,
}: PurchaseExcelImportModalProps) {
  const { t } = useTranslation("stock");
  const { data: locData, isPending: locPending } = useLocations({
    page: 1,
    limit: 500,
  });
  const locations = useMemo(
    () => (locData?.locations ?? []).filter(l => !l.isDeleted),
    [locData?.locations]
  );

  const locationNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const loc of locations) {
      m.set(loc.id, loc.name);
    }
    return m;
  }, [locations]);

  const { data: pricesResponse, isPending: pricesPending } = useQuery({
    queryKey: ["price-types", "purchase-excel-import"],
    queryFn: () => getPrices({ page: 1, limit: 500 }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const priceTypes = pricesResponse?.data ?? [];
  const catalogReady = !locPending && !pricesPending;

  const priceTypeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const pt of priceTypes) {
      if (!pt.isDeleted) {
        m.set(pt.id, pt.name);
      }
    }
    return m;
  }, [priceTypes]);

  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] =
    useState<ParsePurchaseExcelResult | null>(null);
  const [importableRows, setImportableRows] = useState<
    ImportableSheetRow[] | null
  >(null);
  const [rowIssues, setRowIssues] = useState<RowPreviewIssue[]>([]);
  const [rowWarnings, setRowWarnings] = useState<RowImportWarning[]>([]);
  const [fatalMessage, setFatalMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [doneOk, setDoneOk] = useState(false);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  const reset = useCallback(() => {
    setReference("");
    setNote("");
    setFileName(null);
    setParseResult(null);
    setImportableRows(null);
    setRowIssues([]);
    setRowWarnings([]);
    setFatalMessage(null);
    setIsBusy(false);
    setProgressPct(0);
    setDoneOk(false);
    setLastSummary(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        return;
      }
      setFatalMessage(null);
      setRowIssues([]);
      setRowWarnings([]);
      setImportableRows(null);
      setParseResult(null);
      setDoneOk(false);
      setLastSummary(null);
      setFileName(file.name);
      setIsBusy(true);
      setProgressPct(5);
      try {
        const buf = await file.arrayBuffer();
        const parsed = parsePurchaseExcelSheet(buf, locations, priceTypes);
        setParseResult(parsed);
        setProgressPct(25);

        if (parsed.columnIssues.length > 0 && parsed.rows.length === 0) {
          setFatalMessage(t("movements.excelImport.parseBlocked"));
          setIsBusy(false);
          setProgressPct(0);
          return;
        }

        const uniqueNames = [
          ...new Set(parsed.rows.map(r => r.itemNormalized)),
        ].filter(s => s.length > 0);

        const resolveMap = new Map<string, VariantDisplayNameResolveEntry>();
        const nameChunks = chunkArray(uniqueNames, RESOLVE_VARIANT_NAMES_CHUNK);
        let chunkIdx = 0;
        for (const chunk of nameChunks) {
          const res = await resolveVariantDisplayNames({ names: chunk });
          for (const entry of res.results) {
            resolveMap.set(entry.normalizedName, entry);
          }
          chunkIdx += 1;
          setProgressPct(
            25 + Math.min(40, (chunkIdx / nameChunks.length) * 40)
          );
        }

        const importable: ImportableSheetRow[] = [];
        const issues: RowPreviewIssue[] = [];
        const warnings: RowImportWarning[] = [];

        for (const pr of parsed.rows) {
          const itemLabel =
            pr.itemLabel.trim() ||
            t("movements.excelImport.itemUnnamedPlaceholder");
          const hit = resolveMap.get(pr.itemNormalized);
          if (!hit || hit.status === "not_found") {
            issues.push({
              itemLabel,
              sheetRow: pr.sheetRow,
              message: t("movements.excelImport.variantNotFound"),
            });
            continue;
          }
          if (hit.status === "ambiguous") {
            issues.push({
              itemLabel,
              sheetRow: pr.sheetRow,
              message: t("movements.excelImport.variantAmbiguous"),
            });
            continue;
          }
          if (!hit.productVariantId || !hit.productId) {
            issues.push({
              itemLabel,
              sheetRow: pr.sheetRow,
              message: t("movements.excelImport.variantUnresolved"),
            });
            continue;
          }
          if (pr.locationQuantities.length === 0) {
            const locationList = pr.locationColumnsWithZeroQty.join(", ");
            warnings.push({
              itemLabel,
              sheetRow: pr.sheetRow,
              message:
                pr.locationColumnsWithZeroQty.length > 0
                  ? t("movements.excelImport.rowWarningZeroLocationsDetail", {
                      locationList,
                    })
                  : t("movements.excelImport.rowWarningOmittedFallback"),
            });
            continue;
          }
          const row: BulkPurchaseImportRow = {
            productVariantId: hit.productVariantId,
            productId: hit.productId,
            locationQuantities: pr.locationQuantities,
            costPrice: pr.costPrice,
            prices: pr.prices,
          };
          importable.push({ sheetRow: pr.sheetRow, itemLabel, row });
        }

        importable.sort((a, b) => a.sheetRow - b.sheetRow);
        setImportableRows(importable);
        setRowIssues(issues);
        setRowWarnings(warnings);
        setProgressPct(100);
      } catch (e) {
        setFatalMessage(
          e instanceof Error
            ? e.message
            : t("movements.excelImport.unknownError")
        );
        setProgressPct(0);
      } finally {
        setIsBusy(false);
      }
    },
    [locations, priceTypes, t]
  );

  const canProcess =
    !!importableRows &&
    importableRows.length > 0 &&
    rowIssues.length === 0 &&
    reference.trim().length > 0 &&
    !isBusy &&
    !doneOk;

  const handleProcess = useCallback(async () => {
    if (!importableRows || !reference.trim()) {
      return;
    }
    setIsBusy(true);
    setFatalMessage(null);
    setDoneOk(false);
    setProgressPct(0);
    try {
      const bulkPayload = importableRows.map(r => r.row);
      const batches = chunkArray(
        bulkPayload,
        BULK_PURCHASE_MAX_ROWS_PER_REQUEST
      );
      const total = batches.length;
      let movementsTotal = 0;
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        if (!batch || batch.length === 0) {
          continue;
        }
        const res = await bulkPurchaseImport({
          dryRun: false,
          reference: reference.trim(),
          ...(note.trim().length > 0 ? { note: note.trim() } : {}),
          batchIndex: i,
          batchCount: total,
          rows: batch,
        });
        if (!res.ok) {
          const detail = res.errors
            .map(e => `Fila ${e.rowIndex}: ${e.message}`)
            .join("; ");
          throw new Error(detail || t("movements.excelImport.batchFailed"));
        }
        movementsTotal += res.movementsCreated;
        setProgressPct(Math.round(((i + 1) / total) * 100));
      }
      setDoneOk(true);
      setLastSummary(
        t("movements.excelImport.successSummary", {
          rows: importableRows.length,
          movements: movementsTotal,
        })
      );
      onSuccess();
    } catch (e) {
      setFatalMessage(
        e instanceof Error ? e.message : t("movements.excelImport.unknownError")
      );
    } finally {
      setIsBusy(false);
    }
  }, [importableRows, note, onSuccess, reference, t]);

  const previewTableData = useMemo(() => {
    if (!importableRows) {
      return [];
    }
    return [...importableRows].sort((a, b) => a.sheetRow - b.sheetRow);
  }, [importableRows]);

  const importPreviewColumns = useMemo<ColumnDef<ImportableSheetRow>[]>(
    () => [
      {
        id: "sheetRow",
        header: t("movements.excelImport.colExcelRow"),
        accessorFn: row => row.sheetRow,
        cell: ({ row }) => (
          <span className="tabular-nums text-neutral-900 dark:text-neutral-100">
            {row.original.sheetRow}
          </span>
        ),
      },
      {
        id: "item",
        header: t("movements.excelImport.colItem"),
        accessorFn: row => row.itemLabel,
        cell: ({ row }) => (
          <span
            className="line-clamp-2 max-w-[220px] text-neutral-900 dark:text-neutral-100"
            title={row.original.itemLabel}
          >
            {row.original.itemLabel}
          </span>
        ),
      },
      {
        id: "locations",
        header: t("movements.excelImport.colLocationsBreakdown"),
        cell: ({ row }) => {
          const lqs = row.original.row.locationQuantities;
          const qtySum = lqs.reduce((s, l) => s + l.quantity, 0);
          return (
            <div className="min-w-[180px] text-left">
              <ul className="space-y-1">
                {lqs.map(lq => {
                  const locName =
                    locationNameById.get(lq.locationId) ?? lq.locationId;
                  return (
                    <li
                      key={`${row.original.sheetRow}-${lq.locationId}`}
                      className="text-xs leading-snug"
                    >
                      <span className="text-neutral-600 dark:text-neutral-400">
                        {locName}
                      </span>
                      <span className="text-neutral-400 dark:text-neutral-500">
                        {": "}
                      </span>
                      <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                        {lq.quantity}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {lqs.length > 1 ? (
                <p className="mt-1 border-t border-neutral-200 pt-1 text-[11px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                  {t("movements.excelImport.colQty")}:{" "}
                  <span className="font-medium tabular-nums text-neutral-800 dark:text-neutral-200">
                    {qtySum}
                  </span>
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "prices",
        header: t("movements.excelImport.colPricesBreakdown"),
        cell: ({ row }) => {
          const prices = row.original.row.prices;
          if (prices.length === 0) {
            return (
              <span className="text-neutral-400 dark:text-neutral-500">
                {t("movements.excelImport.previewNoPrices")}
              </span>
            );
          }
          return (
            <ul className="min-w-[140px] space-y-1 text-left">
              {prices.map(p => {
                const typeName =
                  priceTypeNameById.get(p.priceTypeId) ?? p.priceTypeId;
                return (
                  <li
                    key={`${row.original.sheetRow}-${p.priceTypeId}`}
                    className="text-xs leading-snug"
                  >
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {typeName}
                    </span>
                    <span className="text-neutral-400 dark:text-neutral-500">
                      {": "}
                    </span>
                    <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                      {p.price}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        },
      },
      {
        id: "cost",
        header: t("movements.excelImport.colCost"),
        accessorFn: row => row.row.costPrice,
        cell: ({ row }) => (
          <span className="tabular-nums text-neutral-900 dark:text-neutral-100">
            {row.original.row.costPrice}
          </span>
        ),
      },
    ],
    [locationNameById, priceTypeNameById, t]
  );

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isBusy) {
          onClose();
        }
      }}
      size="full"
    >
      <ModalContent
        size="full"
        className="max-h-[92vh] max-w-4xl overflow-y-auto"
        showCloseButton={!isBusy}
        onPointerDownOutside={e => {
          if (isBusy) {
            e.preventDefault();
          }
        }}
        onInteractOutside={e => {
          if (isBusy) {
            e.preventDefault();
          }
        }}
        hiddenTitle={t("movements.excelImport.title")}
      >
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" aria-hidden />
            {t("movements.excelImport.title")}
          </ModalTitle>
        </ModalHeader>

        <div className="space-y-4 px-1 pb-2">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            {t("movements.excelImport.atomicWarning")}
          </p>

          <div className="space-y-2">
            {catalogReady ? null : (
              <p className="text-sm text-neutral-500">
                {t("movements.excelImport.loadingCatalog")}
              </p>
            )}
            <FileUpload
              id="purchase-excel-file"
              label={t("movements.excelImport.fileLabel")}
              accept=".xlsx,.xls"
              disabled={isBusy || !catalogReady}
              selectedFileName={fileName}
              dropzoneTitle={t("movements.excelImport.fileUploadDropTitle")}
              dropzoneHint={t("movements.excelImport.fileUploadExtensionsHint")}
              browseButtonLabel={t("movements.excelImport.fileUploadBrowse")}
              onFileSelect={file => {
                void handleFile(file);
              }}
            />
          </div>

          {parseResult && parseResult.columnIssues.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
              <p className="font-medium">
                {t("movements.excelImport.columnIssuesTitle")}
              </p>
              <ul className="mt-1 list-inside list-disc text-neutral-800 dark:text-neutral-200">
                {parseResult.columnIssues.map((c, i) => (
                  <li key={`${i}-${c}`}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {fatalMessage ? (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
              {fatalMessage}
            </div>
          ) : null}

          {rowWarnings.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800/70 dark:bg-amber-950/35">
              <p className="font-medium text-amber-950 dark:text-amber-100">
                {t("movements.excelImport.rowWarningsTitle")}
              </p>
              <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/90">
                {t("movements.excelImport.rowWarningsHint")}
              </p>
              <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
                {rowWarnings.map((w, i) => (
                  <li
                    key={`w-${w.sheetRow}-${w.itemLabel}-${i}`}
                    className="rounded-md border border-amber-200/90 bg-white/80 p-2.5 dark:border-amber-800/50 dark:bg-neutral-900/40"
                  >
                    <div className="font-medium text-neutral-900 dark:text-neutral-50">
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {t("movements.excelImport.rowErrorProductLabel")}
                      </span>{" "}
                      <span title={w.itemLabel}>
                        {w.itemLabel.length > 90
                          ? `${w.itemLabel.slice(0, 87)}…`
                          : w.itemLabel}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                      {t("movements.excelImport.rowErrorExcelRow", {
                        row: w.sheetRow,
                      })}
                    </div>
                    <div className="mt-1.5 text-neutral-800 dark:text-neutral-200">
                      {w.message}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {importableRows !== null &&
          importableRows.length === 0 &&
          rowIssues.length === 0 &&
          rowWarnings.length === 0 &&
          !isBusy ? (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-300">
              {t("movements.excelImport.noImportableRows")}
            </p>
          ) : null}

          {importableRows && importableRows.length > 0 ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="purchase-ref">
                    {t("movements.form.reference")} *
                  </Label>
                  <Input
                    id="purchase-ref"
                    value={reference}
                    disabled={isBusy || doneOk}
                    onChange={e => setReference(e.target.value)}
                    placeholder={t(
                      "movements.form.referencePlaceholders.purchaseOrder"
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="purchase-note">
                    {t("movements.form.note")}
                  </Label>
                  <Input
                    id="purchase-note"
                    value={note}
                    disabled={isBusy || doneOk}
                    onChange={e => setNote(e.target.value)}
                    placeholder={t(
                      "movements.form.notePlaceholders.purchaseNotes"
                    )}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">
                  {t("movements.excelImport.previewTitle", {
                    count: importableRows.length,
                    issues: rowIssues.length,
                    warnings: rowWarnings.length,
                  })}
                </p>
                <div className="max-h-[min(28rem,50vh)] overflow-x-auto overflow-y-auto">
                  <DataTable
                    data={previewTableData}
                    columns={importPreviewColumns}
                    showTitle={false}
                    className="!p-3 shadow-none sm:!p-4"
                    empty={
                      <span className="text-sm text-neutral-500 dark:text-neutral-400">
                        {t("movements.excelImport.previewEmpty")}
                      </span>
                    }
                  />
                </div>
              </div>

              {rowIssues.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/30">
                  <p className="font-medium text-red-950 dark:text-red-100">
                    {t("movements.excelImport.rowErrorsTitle")}
                  </p>
                  <p className="mt-1 text-xs text-red-800/90 dark:text-red-200/90">
                    {t("movements.excelImport.rowErrorsHint")}
                  </p>
                  <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
                    {rowIssues.map((issue, i) => (
                      <li
                        key={`${issue.sheetRow}-${issue.itemLabel}-${i}`}
                        className="rounded-md border border-red-200/80 bg-white/80 p-2.5 dark:border-red-800/60 dark:bg-neutral-900/40"
                      >
                        <div className="font-medium text-neutral-900 dark:text-neutral-50">
                          <span className="text-neutral-500 dark:text-neutral-400">
                            {t("movements.excelImport.rowErrorProductLabel")}
                          </span>{" "}
                          <span title={issue.itemLabel}>
                            {issue.itemLabel.length > 90
                              ? `${issue.itemLabel.slice(0, 87)}…`
                              : issue.itemLabel}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                          {t("movements.excelImport.rowErrorExcelRow", {
                            row: issue.sheetRow,
                          })}
                        </div>
                        <div className="mt-1.5 text-neutral-800 dark:text-neutral-200">
                          {issue.message}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {isBusy ? (
                <div className="space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                    <div
                      className="h-full rounded-full bg-[#ff48b0] transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    {t("movements.excelImport.progress", { pct: progressPct })}
                  </p>
                </div>
              ) : null}

              {doneOk && lastSummary ? (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
                  {lastSummary}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => onClose()}
                >
                  {t("movements.form.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!canProcess}
                  onClick={() => void handleProcess()}
                >
                  {t("movements.excelImport.process")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </ModalContent>
    </Modal>
  );
}
