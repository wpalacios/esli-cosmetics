import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getUserIdFromToken } from "@/lib/auth/session";
import {
  getSupabaseServerClient,
  getProductImagesBucketName,
  getProductVariantImagesBucketName,
} from "@/lib/supabase/server";
import { FILE_UPLOAD } from "@esli-cosmetics/utils";

function getExtension(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[mime] ?? "jpg";
}

const MAX_FILE_SIZE = FILE_UPLOAD.maxSize;
const ALLOWED_TYPES: readonly ("image/jpeg" | "image/png" | "image/webp")[] =
  FILE_UPLOAD.allowedImageTypes;

/** Minimal validation: productId or variantId must be a non-empty string that looks like an ID (UUID or similar). */
function isValidId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  );
}

/**
 * POST /api/products/upload-image
 * Body: multipart/form-data with "file" (image file), and either:
 *   - "productId" for product images → product-images/{productId}/{uuid}.{ext}
 *   - "variantId" for variant images → product-variant-images/{variantId}/{uuid}.{ext}
 * Returns: { url: string } or { error: string }.
 */
export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        {
          error:
            "Storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const variantIdRaw = formData.get("variantId");
    const productIdRaw = formData.get("productId");
    const isVariantUpload = isValidId(variantIdRaw);

    if (!isVariantUpload && !isValidId(productIdRaw)) {
      return NextResponse.json(
        {
          error:
            "Send 'productId' for product images or 'variantId' for variant images (non-empty id).",
        },
        { status: 400 }
      );
    }

    const folderId = isVariantUpload ? variantIdRaw : productIdRaw;

    const file = formData.get("file");
    // File extends Blob; some runtimes may return File, others Blob
    const isBlob =
      file &&
      typeof file === "object" &&
      "size" in file &&
      "arrayBuffer" in file &&
      typeof (file as Blob).arrayBuffer === "function";
    if (!isBlob) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid file in form field 'file'. Send multipart/form-data with key 'file'.",
        },
        { status: 400 }
      );
    }

    const blob = file as Blob;
    const size = blob.size;
    const mime = blob.type || "image/jpeg";
    if (size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.includes(mime as (typeof ALLOWED_TYPES)[number])) {
      return NextResponse.json(
        { error: `Invalid type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const ext = getExtension(mime);
    const path = `${folderId}/${randomUUID()}.${ext}`;
    const bucket = isVariantUpload
      ? getProductVariantImagesBucketName()
      : getProductImagesBucketName();

    // Ensure bucket exists (create if not; ignore error if already exists)
    const { error: bucketErr } = await supabase.storage.createBucket(bucket, {
      public: true,
    });
    const alreadyExists =
      bucketErr &&
      /already exists|BucketAlreadyExists|ResourceAlreadyExists/i.test(
        bucketErr.message
      );
    if (bucketErr && !alreadyExists) {
      console.error("Supabase bucket create error:", bucketErr);
    }

    const buffer = await blob.arrayBuffer();
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: mime,
        upsert: false,
      });

    if (error) {
      console.error("Supabase storage upload error:", error);
      return NextResponse.json(
        {
          error: error.message || "Upload failed",
          code: error.message?.toLowerCase().includes("bucket")
            ? "BUCKET_ERROR"
            : undefined,
        },
        { status: 502 }
      );
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("Product image upload error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
