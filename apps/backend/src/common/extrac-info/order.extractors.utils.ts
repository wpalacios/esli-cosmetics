import { tryKeys, deepGet } from "../objects/object.utils";

// Utility functions for customer-related data extraction
type EntityLike = Record<string, unknown> | null | undefined;

function findStringValueByKeyPart(
  obj: EntityLike,
  part: string
): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase().includes(part.toLowerCase())) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) return v;
      if (typeof v === "number") return String(v);
      if (typeof v === "object" && v !== null) {
        let nested: string | undefined = undefined;
        if (typeof v === "object" && v !== null) {
          const vObj = v as Record<string, unknown>;
          nested =
            (tryKeys(vObj, ["name", "fullName", "displayName"]) as
              | string
              | undefined) ??
            (typeof vObj.person === "object" && vObj.person !== null
              ? `${tryKeys(vObj.person as Record<string, unknown>, ["firstName", "first_name"]) ?? ""} ${tryKeys(vObj.person as Record<string, unknown>, ["lastName", "last_name"]) ?? ""}`.trim()
              : undefined);
        }
        if (nested) return nested;
      }
    }
  }
  return undefined;
}

function getPersonFullName(obj: EntityLike): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  const person =
    (typeof o.person === "object" && o.person !== null
      ? o.person
      : undefined) ??
    (typeof o.Person === "object" && o.Person !== null
      ? o.Person
      : undefined) ??
    (typeof o.persona === "object" && o.persona !== null
      ? o.persona
      : undefined);

  if (person && typeof person === "object") {
    const p = person as Record<string, unknown>;
    const first =
      (tryKeys(p, ["firstName", "first_name", "firstname"]) as string) ?? "";
    const last =
      (tryKeys(p, ["lastName", "last_name", "lastname"]) as string) ?? "";
    const full = `${first} ${last}`.trim();
    if (full) return full;
  }
  return tryKeys(o, ["name", "fullName", "displayName"]) as string | undefined;
}

export function extractCustomerName(r: EntityLike): string {
  const direct = tryKeys(r, ["customerName", "customer_name", "customer"]) as
    | string
    | object
    | undefined;
  if (typeof direct === "string" && direct.trim()) return direct;
  if (typeof direct === "object" && direct !== null)
    return (
      getPersonFullName(direct as Record<string, unknown>) ??
      (tryKeys(direct as Record<string, unknown>, [
        "name",
        "displayName",
      ]) as string) ??
      ""
    );
  return (
    findStringValueByKeyPart(r, "customer") ??
    findStringValueByKeyPart(r, "client") ??
    ""
  );
}

export function extractOrderNumber(r: EntityLike): string {
  return (
    (tryKeys(r, [
      "orderNumber",
      "order_number",
      "orderNo",
      "order_no",
    ]) as string) ??
    (typeof r === "object" &&
    r !== null &&
    "id" in r &&
    typeof r.id === "string"
      ? r.id
      : "") ??
    ""
  );
}

export function extractBranchName(r: EntityLike): string {
  const direct = tryKeys(r, ["branchName", "branch_name", "branch"]);
  if (typeof direct === "string" && direct.trim()) return direct;
  if (typeof direct === "object" && direct !== null)
    return (
      getPersonFullName(direct as Record<string, unknown>) ??
      (tryKeys(direct as Record<string, unknown>, ["name"]) as string) ??
      ""
    );
  return findStringValueByKeyPart(r, "branch") ?? "";
}

export function extractEmployeeName(r: EntityLike): string {
  const direct = tryKeys(r, [
    "employeeName",
    "employee_name",
    "employee",
    "employeeFullName",
    "employee_full_name",
  ]);
  if (typeof direct === "string" && direct.trim()) return direct;
  if (typeof direct === "object" && direct !== null)
    return (
      getPersonFullName(direct as Record<string, unknown>) ??
      (tryKeys(direct as Record<string, unknown>, ["name"]) as string) ??
      ""
    );
  const nested =
    tryKeys(r, [
      "createdBy",
      "created_by",
      "creator",
      "seller",
      "salesperson",
      "createdByName",
      "created_by_name",
    ]) ??
    deepGet(r, "createdBy.person") ??
    deepGet(r, "seller.person");
  if (nested) {
    if (typeof nested === "string") return nested;
    if (typeof nested === "object")
      return (
        getPersonFullName(nested as Record<string, unknown>) ??
        (tryKeys(nested as Record<string, unknown>, ["name"]) as string) ??
        ""
      );
  }
  return (
    findStringValueByKeyPart(r, "employee") ??
    findStringValueByKeyPart(r, "seller") ??
    ""
  );
}

export function extractDiscountCode(r: EntityLike): string {
  return (
    (tryKeys(r, [
      "discountCode",
      "discount_code",
      "discount",
      "couponCode",
      "coupon_code",
    ]) as string) ??
    (typeof r === "object" &&
    r !== null &&
    typeof r["discountCode"] === "object"
      ? (tryKeys(r["discountCode"] as Record<string, unknown>, [
          "code",
        ]) as string)
      : undefined) ??
    ""
  );
}

export function extractOrderStatus(r: EntityLike): string {
  const v =
    tryKeys(r, [
      "status",
      "orderStatus",
      "order_status",
      "state",
      "order_state",
      "status_code",
    ]) ??
    tryKeys(r, [
      "paymentType",
      "payment_type",
      "paymentStatus",
      "payment_status",
    ]) ??
    deepGet(r, "meta.status") ??
    deepGet(r, "metadata.status") ??
    undefined;
  if (typeof v === "string" && v.trim()) return v;
  if (typeof v === "number") return String(v);
  return findStringValueByKeyPart(r, "status") ?? "";
}

export function extractOrderSubtotal(
  r: EntityLike,
  formatMoneyFn: (v: number | string | { toNumber: () => number }) => string
): string {
  const candidate =
    tryKeys(r, [
      "subtotal",
      "subtotalAmount",
      "subtotal_amount",
      "subTotal",
      "sub_total",
      "sub_total_amount",
      "orderSubtotal",
      "order_subtotal",
      "amounts.subtotal",
      "totals.subtotal",
    ]) ??
    deepGet(r, "amounts.subtotal") ??
    deepGet(r, "totals.subtotal") ??
    undefined;
  if (candidate !== undefined && candidate !== null && candidate !== "")
    return formatMoneyFn(
      candidate as number | string | { toNumber: () => number }
    );
  const maybeTotal = tryKeys(r, [
    "orderTotal",
    "order_total",
    "total",
    "totalAmount",
    "total_amount",
  ]);
  const maybeTaxes = tryKeys(r, [
    "orderTaxes",
    "order_taxes",
    "taxes",
    "tax_amount",
    "taxesAmount",
    "taxes_amount",
  ]);
  const nTotal = maybeTotal != null ? Number(maybeTotal) : NaN;
  const nTaxes = maybeTaxes != null ? Number(maybeTaxes) : NaN;
  if (!Number.isNaN(nTotal) && !Number.isNaN(nTaxes))
    return formatMoneyFn(nTotal - nTaxes);
  return "";
}

export function extractOrderTaxes(
  r: EntityLike,
  formatMoneyFn: (v: number | string | { toNumber: () => number }) => string
): string {
  const candidate =
    tryKeys(r, [
      "orderTaxes",
      "order_taxes",
      "taxes",
      "tax_amount",
      "taxesAmount",
      "taxes_amount",
      "totalTax",
    ]) ??
    deepGet(r, "amounts.tax") ??
    deepGet(r, "totals.tax") ??
    undefined;
  if (candidate !== undefined && candidate !== null && candidate !== "")
    return formatMoneyFn(
      candidate as number | string | { toNumber: () => number }
    );
  const maybeTotal = tryKeys(r, [
    "orderTotal",
    "order_total",
    "total",
    "totalAmount",
    "total_amount",
  ]);
  const maybeSubtotal = tryKeys(r, [
    "subtotal",
    "subtotalAmount",
    "subtotal_amount",
    "orderSubtotal",
    "order_subtotal",
  ]);
  const nTotal = maybeTotal != null ? Number(maybeTotal) : NaN;
  const nSub = maybeSubtotal != null ? Number(maybeSubtotal) : NaN;
  if (!Number.isNaN(nTotal) && !Number.isNaN(nSub))
    return formatMoneyFn(nTotal - nSub);
  return "";
}

export function extractOrderTotalAmount(
  r: EntityLike,
  formatMoneyFn: (v: number | string | { toNumber: () => number }) => string
): string {
  const value = tryKeys(r, [
    "orderTotal",
    "order_total",
    "totalAmount",
    "total",
    "total_amount",
    "orderTotalAmount",
  ]);
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    (typeof value === "object" &&
      value !== null &&
      typeof (value as { toNumber?: () => number }).toNumber === "function")
  ) {
    return formatMoneyFn(value as string | number | { toNumber: () => number });
  }
  return formatMoneyFn("");
}
