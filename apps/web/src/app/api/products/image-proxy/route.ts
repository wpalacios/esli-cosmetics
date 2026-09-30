import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseServerClient,
  getProductImagesBucketName,
  getProductVariantImagesBucketName,
} from "@/lib/supabase/server";

// Supports product-images or product-variant-images buckets
const SUPABASE_PUBLIC_IMAGE_PATTERN =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/(product-images|product-variant-images)\/([a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*)$/i;

/**
 * GET /api/products/image-proxy?url=<encoded-supabase-public-url>
 * Proxies product images from Supabase Storage (via SDK) to avoid ERR_BLOCKED_BY_ORB.
 * Only allows product-images bucket URLs. Uses service role so download always works.
 */
export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  if (!urlParam) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(urlParam);
  } catch {
    return NextResponse.json(
      { error: "Invalid url parameter" },
      { status: 400 }
    );
  }

  const match = SUPABASE_PUBLIC_IMAGE_PATTERN.exec(decoded);
  const bucketName = match?.[1];
  const objectPath = match?.[2]?.replace(/\.\./g, ""); // path after bucket name
  if (!bucketName || !objectPath) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 503 }
    );
  }

  const bucket =
    bucketName === "product-variant-images"
      ? getProductVariantImagesBucketName()
      : getProductImagesBucketName();

  const maxAttempts = 2;
  let lastError: string | null = null;
  let data: Blob | null = null;
  let error: { message: string } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await supabase.storage.from(bucket).download(objectPath);
    data = result.data;
    error = result.error;
    if (!error && data) break;
    lastError = error?.message ?? "No data";
    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, 400 * attempt));
    }
  }

  try {
    if (error || !data) {
      console.error(
        "Product image proxy download error:",
        lastError,
        objectPath
      );
      return NextResponse.json(
        { error: lastError || "Download failed" },
        {
          status: lastError?.toLowerCase().includes("not found") ? 404 : 502,
        }
      );
    }

    const buffer = await data.arrayBuffer();
    const ext = objectPath.split(".").pop()?.toLowerCase();
    let contentType = "image/jpeg";
    if (ext === "png") contentType = "image/png";
    else if (ext === "webp") contentType = "image/webp";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Product image proxy error:", message, objectPath ?? decoded);
    return NextResponse.json(
      { error: "Failed to fetch image", detail: message },
      { status: 502 }
    );
  }
}
