-- Variant fuzzy / full-text search support
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE OR REPLACE FUNCTION public.normalize_search_text(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    trim(
      regexp_replace(
        unaccent(COALESCE(input, '')),
        '[^a-zA-Z0-9\s]',
        ' ',
        'g'
      )
    )
  );
$$;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(512),
  ADD COLUMN IF NOT EXISTS search_text tsvector;

CREATE TABLE IF NOT EXISTS variant_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  alias VARCHAR(512) NOT NULL,
  normalized_alias VARCHAR(512) NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS variant_aliases_product_variant_id_idx ON variant_aliases (product_variant_id);
CREATE INDEX IF NOT EXISTS variant_aliases_normalized_alias_trgm_idx
  ON variant_aliases USING gin (normalized_alias gin_trgm_ops);

CREATE UNIQUE INDEX IF NOT EXISTS variant_aliases_variant_id_normalized_alias_key
  ON variant_aliases (product_variant_id, normalized_alias);

CREATE TABLE IF NOT EXISTS variant_embeddings (
  product_variant_id UUID PRIMARY KEY REFERENCES product_variants(id) ON DELETE CASCADE,
  embedding vector(384),
  model_version VARCHAR(64) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS variant_embeddings_hnsw_idx
  ON variant_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS product_variants_normalized_name_trgm_idx
  ON product_variants USING gin (normalized_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS product_variants_search_text_gin_idx
  ON product_variants USING gin (search_text);

CREATE INDEX IF NOT EXISTS product_variants_normalized_name_idx ON product_variants (normalized_name);

UPDATE product_variants v
SET normalized_name = public.normalize_search_text(
  COALESCE(NULLIF(v.name, ''), (SELECT p.name FROM products p WHERE p.id = v.product_id))
)
WHERE normalized_name IS NULL OR normalized_name = '';

UPDATE product_variants v
SET search_text = to_tsvector(
  'spanish',
  concat_ws(
    ' ',
    v.name,
    v.sku,
    v.barcode,
    (SELECT p.name FROM products p WHERE p.id = v.product_id),
    COALESCE((
      SELECT b.name
      FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.id = v.product_id
    ), ''),
    COALESCE((
      SELECT c.name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = v.product_id
    ), '')
  )
)
WHERE search_text IS NULL;
