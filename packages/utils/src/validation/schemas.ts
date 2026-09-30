import { z } from "zod";
import { VALIDATION_LIMITS, REGEX_PATTERNS } from "../lib/constants";

// Common field schemas
export const emailSchema = z
  .string()
  .email("Email inválido")
  .max(
    VALIDATION_LIMITS.email.max,
    `Email debe tener máximo ${VALIDATION_LIMITS.email.max} caracteres`
  );

export const phoneSchema = z
  .string()
  .min(
    VALIDATION_LIMITS.phone.min,
    `Teléfono debe tener mínimo ${VALIDATION_LIMITS.phone.min} dígitos`
  )
  .max(
    VALIDATION_LIMITS.phone.max,
    `Teléfono debe tener máximo ${VALIDATION_LIMITS.phone.max} dígitos`
  )
  .regex(REGEX_PATTERNS.phone, "Formato de teléfono inválido");

export const nameSchema = z
  .string()
  .min(
    VALIDATION_LIMITS.name.min,
    `Nombre debe tener mínimo ${VALIDATION_LIMITS.name.min} caracteres`
  )
  .max(
    VALIDATION_LIMITS.name.max,
    `Nombre debe tener máximo ${VALIDATION_LIMITS.name.max} caracteres`
  );

export const skuSchema = z
  .string()
  .min(
    VALIDATION_LIMITS.sku.min,
    `SKU debe tener mínimo ${VALIDATION_LIMITS.sku.min} caracteres`
  )
  .max(
    VALIDATION_LIMITS.sku.max,
    `SKU debe tener máximo ${VALIDATION_LIMITS.sku.max} caracteres`
  )
  .regex(
    REGEX_PATTERNS.sku,
    "SKU solo puede contener letras, números, guiones y guiones bajos"
  );

export const barcodeSchema = z
  .string()
  .min(
    VALIDATION_LIMITS.barcode.min,
    `Código de barras debe tener mínimo ${VALIDATION_LIMITS.barcode.min} dígitos`
  )
  .max(
    VALIDATION_LIMITS.barcode.max,
    `Código de barras debe tener máximo ${VALIDATION_LIMITS.barcode.max} dígitos`
  )
  .regex(
    REGEX_PATTERNS.barcode,
    "Código de barras solo puede contener números"
  );

// Auth schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, "Contraseña debe tener mínimo 6 caracteres"),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(6, "Contraseña debe tener mínimo 6 caracteres"),
    confirmPassword: z.string().min(6, "Confirmación requerida"),
    firstName: nameSchema,
    lastName: nameSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

// Product schemas
export const productSchema = z.object({
  name: nameSchema,
  description: z.string().max(VALIDATION_LIMITS.description.max).optional(),
  sku: skuSchema.optional(),
  barcode: barcodeSchema.optional(),
  brand: z.string().max(100).optional(),
  categoryId: z.string().uuid("Categoría requerida"),
  taxRateId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

export const productVariantSchema = z.object({
  productId: z.string().uuid("Producto requerido"),
  name: nameSchema.optional(),
  sku: skuSchema.optional(),
  barcode: barcodeSchema.optional(),
  price: z.number().min(0, "Precio debe ser positivo"),
  retailPrice: z
    .number()
    .min(0, "Precio de venta debe ser positivo")
    .optional(),
  costPrice: z.number().min(0, "Costo debe ser positivo").optional(),
  minimumStock: z
    .number()
    .int()
    .min(0, "Stock mínimo debe ser positivo")
    .optional(),
  maximumStock: z
    .number()
    .int()
    .min(0, "Stock máximo debe ser positivo")
    .optional(),
  isActive: z.boolean().default(true),
});

// Customer schemas
export const customerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  docType: z.string().optional(),
  docNumber: z.string().optional(),
});

// Category schemas
export const categorySchema = z.object({
  name: nameSchema,
  slug: z.string().regex(REGEX_PATTERNS.slug, "Slug inválido").optional(),
  description: z.string().max(VALIDATION_LIMITS.description.max).optional(),
  parentId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

// Order schemas
export const orderItemSchema = z.object({
  productVariantId: z.string().uuid("Producto requerido"),
  quantity: z.number().int().min(1, "Cantidad debe ser mayor a 0"),
  unitPrice: z.number().min(0, "Precio debe ser positivo"),
  discountAmount: z.number().min(0, "Descuento debe ser positivo").default(0),
});

export const orderSchema = z.object({
  customerId: z.string().uuid().optional(),
  branchId: z.string().uuid("Sucursal requerida"),
  locationId: z.string().uuid("Ubicación requerida"),
  items: z
    .array(orderItemSchema)
    .min(1, "Orden debe tener al menos un producto"),
  metadata: z.record(z.unknown()).optional(),
});

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ProductFormData = z.infer<typeof productSchema>;
export type ProductVariantFormData = z.infer<typeof productVariantSchema>;
export type CustomerFormData = z.infer<typeof customerSchema>;
export type CategoryFormData = z.infer<typeof categorySchema>;
export type OrderFormData = z.infer<typeof orderSchema>;
export type OrderItemFormData = z.infer<typeof orderItemSchema>;
