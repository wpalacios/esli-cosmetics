"use server";

import { randomUUID } from "node:crypto";
import { ServerApiClient } from "@/lib/api/server-api-client";
import { getUserIdFromToken } from "@/lib/auth/session";
import {
  getSupabaseServerClient,
  getProductImagesBucketName,
} from "@/lib/supabase/server";
import type {
  ApiProductImage,
  ApiProductVariantImage,
} from "@esli-cosmetics/types";
import { FILE_UPLOAD } from "@esli-cosmetics/utils";

const apiClient = new ServerApiClient();
const MAX_FILE_SIZE = FILE_UPLOAD.maxSize;

function getExtension(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[mime] ?? "jpg";
}

function isValidProductId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  );
}

/**
 * Upload a product image file to Supabase Storage.
 * Call from client with FormData containing "file" and "productId".
 * Files are stored under product-images/{productId}/{uuid}.{ext}.
 * Returns the public URL or an error message.
 */
export async function uploadProductImageFile(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const userId = await getUserIdFromToken();
  if (!userId) {
    return { error: "Unauthorized" };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      error:
        "Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const productIdRaw = formData.get("productId");
  if (!isValidProductId(productIdRaw)) {
    return {
      error: "Missing or invalid 'productId' in form data.",
    };
  }
  const productId = productIdRaw;

  const fileEntry = formData.get("file");
  // Server may receive File or Blob depending on Next.js/Node runtime
  const isFileLike =
    fileEntry &&
    typeof fileEntry === "object" &&
    "size" in fileEntry &&
    "type" in fileEntry &&
    typeof (fileEntry as Blob).arrayBuffer === "function";
  if (!isFileLike) {
    return { error: "Missing or invalid file in form field 'file'" };
  }
  const file = fileEntry as Blob;

  const size = file.size;
  const mime = file.type || "image/jpeg";
  if (size > MAX_FILE_SIZE) {
    return {
      error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  if (
    !FILE_UPLOAD.allowedImageTypes.includes(
      mime as "image/jpeg" | "image/png" | "image/webp"
    )
  ) {
    return {
      error: `Invalid type. Allowed: ${FILE_UPLOAD.allowedImageTypes.join(", ")}`,
    };
  }

  try {
    const ext = getExtension(mime);
    const path = `${productId}/${randomUUID()}.${ext}`;
    const bucket = getProductImagesBucketName();
    const buffer = await file.arrayBuffer();

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: mime,
        upsert: false,
      });

    if (error) {
      console.error("Supabase storage upload error:", error);
      return { error: error.message || "Upload failed" };
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);
    return { url: urlData.publicUrl };
  } catch (err) {
    console.error("Product image upload error:", err);
    return { error: "Internal server error" };
  }
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const r = (
      error as { response?: { data?: { message?: string }; message?: string } }
    ).response;
    if (r?.data?.message) return r.data.message;
    if (r?.message) return r.message;
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
}

export async function addProductImage(
  productId: string,
  payload: { url: string; sortOrder?: number; isPrimary?: boolean }
): Promise<ApiProductImage> {
  const image = await apiClient.post(`/products/${productId}/images`, payload);
  return image as ApiProductImage;
}

export async function listProductImages(
  productId: string
): Promise<ApiProductImage[]> {
  const list = await apiClient.get(`/products/${productId}/images`);
  return Array.isArray(list) ? list : [];
}

export async function setPrimaryProductImage(
  productId: string,
  imageId: string
): Promise<ApiProductImage> {
  const image = await apiClient.patch(
    `/products/${productId}/images/${imageId}/primary`
  );
  return image as ApiProductImage;
}

export async function reorderProductImages(
  productId: string,
  images: { id: string; sortOrder: number }[]
): Promise<ApiProductImage[]> {
  const list = await apiClient.put(`/products/${productId}/images/reorder`, {
    images,
  });
  return Array.isArray(list) ? list : [];
}

export async function removeProductImage(
  productId: string,
  imageId: string
): Promise<void> {
  await apiClient.delete(`/products/${productId}/images/${imageId}`);
}

// ---------- Product variant images ----------

export async function addProductVariantImage(
  variantId: string,
  payload: { url: string; sortOrder?: number; isPrimary?: boolean }
): Promise<ApiProductVariantImage> {
  const image = await apiClient.post(
    `/products/variants/${variantId}/images`,
    payload
  );
  return image as ApiProductVariantImage;
}

export async function listProductVariantImages(
  variantId: string
): Promise<ApiProductVariantImage[]> {
  const list = await apiClient.get(`/products/variants/${variantId}/images`);
  return Array.isArray(list) ? list : [];
}

export async function setPrimaryProductVariantImage(
  variantId: string,
  imageId: string
): Promise<ApiProductVariantImage> {
  const image = await apiClient.patch(
    `/products/variants/${variantId}/images/${imageId}/primary`
  );
  return image as ApiProductVariantImage;
}

export async function reorderProductVariantImages(
  variantId: string,
  images: { id: string; sortOrder: number }[]
): Promise<ApiProductVariantImage[]> {
  const list = await apiClient.put(
    `/products/variants/${variantId}/images/reorder`,
    { images }
  );
  return Array.isArray(list) ? list : [];
}

export async function removeProductVariantImage(
  variantId: string,
  imageId: string
): Promise<void> {
  await apiClient.delete(`/products/variants/${variantId}/images/${imageId}`);
}
