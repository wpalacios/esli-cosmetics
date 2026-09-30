// Utility function to format a value as NIO currency string (Nicaraguan Cordoba)

type MoneyLike =
  | number
  | string
  | { toNumber: () => number }
  | null
  | undefined;

export function formatMoney(v: MoneyLike): string {
  if (v === null || v === undefined || v === "") return "";
  try {
    if (
      typeof v === "object" &&
      v !== null &&
      typeof (v as { toNumber?: () => number }).toNumber === "function"
    ) {
      const n = v.toNumber();
      if (typeof n === "number" && !Number.isNaN(n)) {
        return new Intl.NumberFormat("es-NI", {
          style: "currency",
          currency: "NIO",
          minimumFractionDigits: 2,
        }).format(n);
      }
      return String(v);
    }
  } catch {}
  const n = Number(v);
  if (!Number.isNaN(n)) {
    return new Intl.NumberFormat("es-NI", {
      style: "currency",
      currency: "NIO",
      minimumFractionDigits: 2,
    }).format(n);
  }
  return String(v);
}

export function formatUSDLocal(v: number): string {
  return v.toLocaleString("es-NI", { style: "currency", currency: "NIO" });
}
