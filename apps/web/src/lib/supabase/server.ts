import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BUCKET_PRODUCT_IMAGES = "product-images";
const BUCKET_PRODUCT_VARIANT_IMAGES = "product-variant-images";

let serverSupabaseClient: SupabaseClient | null = null;

/**
 * Server-side Supabase client with service role key.
 * Use only in API routes or server components for uploads and admin operations.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  if (serverSupabaseClient) {
    return serverSupabaseClient;
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "⚠️ Supabase server credentials not found (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Product image upload will be disabled."
    );
    return null;
  }

  serverSupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return serverSupabaseClient;
}

export function getProductImagesBucketName(): string {
  return BUCKET_PRODUCT_IMAGES;
}

export function getProductVariantImagesBucketName(): string {
  return BUCKET_PRODUCT_VARIANT_IMAGES;
}
