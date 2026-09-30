const PRODUCT_IMAGES_PREFIX = "/storage/v1/object/public/product-images/";
const VARIANT_IMAGES_PREFIX =
  "/storage/v1/object/public/product-variant-images/";

/**
 * Returns a same-origin URL for product or variant images stored in Supabase Storage.
 * Proxying avoids ERR_BLOCKED_BY_ORB when embedding cross-origin images.
 */
export function getProductImageSrc(url: string): string {
  if (typeof url !== "string" || !url.includes("supabase")) {
    return url;
  }
  if (
    url.includes(PRODUCT_IMAGES_PREFIX) ||
    url.includes(VARIANT_IMAGES_PREFIX)
  ) {
    return `/api/products/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}
