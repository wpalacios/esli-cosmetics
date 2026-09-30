/** Must match backend BulkPurchaseImportDto max rows */
export const BULK_PURCHASE_MAX_ROWS_PER_REQUEST = 150;

/** Max unique variant names per resolve request (must stay within body limits) */
export const RESOLVE_VARIANT_NAMES_CHUNK = 800;

/** Optional cap on rows read from sheet (UX guard) */
export const PURCHASE_EXCEL_MAX_DATA_ROWS = 5000;
