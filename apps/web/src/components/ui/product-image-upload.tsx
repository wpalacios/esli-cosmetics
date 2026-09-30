"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import Image from "next/image";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import {
  addProductImage,
  addProductVariantImage,
  listProductImages,
  listProductVariantImages,
  setPrimaryProductImage,
  setPrimaryProductVariantImage,
  reorderProductImages,
  reorderProductVariantImages,
  removeProductImage,
  removeProductVariantImage,
} from "@/actions/product-images";
import type { ApiProductImage } from "@esli-cosmetics/types";
import { FILE_UPLOAD, cn } from "@esli-cosmetics/utils";
import { Button } from "@esli-cosmetics/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { getProductImageSrc } from "@/lib/product-image-url";
import { useQueryClient } from "@tanstack/react-query";
import { productKeys } from "@/hooks/use-products";
import { isSessionExpiredError } from "@/lib/errors/session-expired-error";
import {
  BiTrash,
  BiStar,
  BiImageAdd,
  BiLoaderAlt,
  BiMove,
} from "react-icons/bi";

const DROPZONE_HINT = "JPG, PNG o WebP · Máx. 5 MB";
const DROPZONE_MULTI_HINT = "Puedes seleccionar varias imágenes a la vez";
const UPLOAD_DELAY_MS = 120;
const UPLOAD_RETRY_ON_STATUS = [502, 503];
const UPLOAD_RETRY_DELAY_MS = 600;

/** Normalized image shape for list (product or variant). */
type ImageItem = Pick<
  ApiProductImage,
  "id" | "url" | "sortOrder" | "isPrimary" | "createdAt"
>;

function getErrorMessage(e: unknown): string {
  if (isSessionExpiredError(e))
    return "Sesión expirada. Inicia sesión de nuevo.";
  const err = e as { response?: { message?: string }; message?: string };
  if (err?.response?.message) return err.response.message;
  if (err instanceof Error) return err.message;
  return "Intenta de nuevo";
}

export interface ProductImageUploadProps {
  productId: string;
  /** When set, images are variant-level (variant API). When unset, product-level. */
  variantId?: string | null;
  initialImages?: ImageItem[];
  onImagesChange?: (images: ImageItem[]) => void;
  disabled?: boolean;
  maxImages?: number;
  className?: string;
}

export function ProductImageUpload({
  productId,
  variantId,
  initialImages = [],
  onImagesChange,
  disabled = false,
  maxImages = 100,
  className,
}: ProductImageUploadProps) {
  const [images, setImages] = useState<ImageItem[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [imageToRemove, setImageToRemove] = useState<ImageItem | null>(null);
  const isVariant = Boolean(variantId);
  const entityKey = `${productId}-${variantId ?? "product"}`;

  // Sync from parent only when the entity changes (product/variant), so that after we
  // add an image and refreshImages() updates state, a parent re-render with stale
  // initialImages doesn't overwrite the list.
  useEffect(() => {
    setImages(initialImages ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when switching product/variant
  }, [entityKey]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const refreshImages = useCallback(async () => {
    if (!productId) return;
    if (isVariant && variantId) {
      const list = await listProductVariantImages(variantId);
      setImages(list);
      onImagesChange?.(list);
    } else {
      const list = await listProductImages(productId);
      setImages(list);
      onImagesChange?.(list);
    }
    queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
    queryClient.invalidateQueries({ queryKey: productKeys.lists() });
  }, [productId, variantId, isVariant, onImagesChange, queryClient]);

  // Load current images from API when switching product/variant so we show server state
  useEffect(() => {
    if (productId) void refreshImages();
  }, [entityKey, productId, refreshImages]);

  const uploadOneFile = useCallback(
    async (
      file: File,
      sortOrder: number,
      isFirst: boolean,
      retry = true
    ): Promise<void> => {
      const formData = new FormData();
      formData.append("file", file);
      if (isVariant && variantId) {
        formData.append("variantId", variantId);
      } else {
        formData.append("productId", productId);
      }
      const res = await fetch("/api/products/upload-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      let result: { url?: string; error?: string };
      try {
        result = (await res.json()) as { url?: string; error?: string };
      } catch {
        throw new Error(
          res.status === 401
            ? "Sesión expirada o no autorizado. Inicia sesión de nuevo."
            : `Error ${res.status}: no se pudo subir la imagen.`
        );
      }
      if (!res.ok || result.error) {
        const shouldRetry =
          retry && UPLOAD_RETRY_ON_STATUS.includes(res.status);
        if (shouldRetry) {
          await new Promise(r => setTimeout(r, UPLOAD_RETRY_DELAY_MS));
          return uploadOneFile(file, sortOrder, isFirst, false);
        }
        throw new Error(
          result.error ||
            `Error ${res.status}: ${res.statusText || "Upload failed"}`
        );
      }
      if (!result.url) {
        throw new Error("El servidor no devolvió la URL de la imagen.");
      }
      if (isVariant && variantId) {
        await addProductVariantImage(variantId, {
          url: result.url,
          sortOrder,
          isPrimary: isFirst,
        });
      } else {
        await addProductImage(productId, {
          url: result.url,
          sortOrder,
          isPrimary: isFirst,
        });
      }
    },
    [productId, variantId, isVariant]
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled || images.length >= maxImages) return;
      setUploading(true);
      try {
        let nextSortOrder = images.length;
        const limit = Math.min(acceptedFiles.length, maxImages - images.length);
        for (let i = 0; i < limit; i++) {
          const file = acceptedFiles[i];
          if (!file) continue;
          if (i > 0) {
            await new Promise(r => setTimeout(r, UPLOAD_DELAY_MS));
          }
          await uploadOneFile(
            file,
            nextSortOrder,
            nextSortOrder === images.length
          );
          nextSortOrder += 1;
        }
        await refreshImages();
        toast({
          title: "Imagen(es) agregada(s)",
          type: "success",
        });
      } catch (e: unknown) {
        toast({
          title: "Error al subir",
          description: getErrorMessage(e),
          type: "error",
        });
      } finally {
        setUploading(false);
      }
    },
    [disabled, images.length, maxImages, refreshImages, toast, uploadOneFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: acceptedFiles => {
      void onDrop(acceptedFiles);
    },
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxSize: FILE_UPLOAD.maxSize,
    maxFiles: Math.max(1, maxImages - images.length),
    disabled: disabled || uploading || images.length >= maxImages,
    multiple: true,
  });

  const handleSetPrimary = async (imageId: string) => {
    if (actionId) return;
    setActionId(imageId);
    try {
      if (isVariant && variantId) {
        await setPrimaryProductVariantImage(variantId, imageId);
      } else {
        await setPrimaryProductImage(productId, imageId);
      }
      await refreshImages();
      toast({ title: "Imagen principal actualizada", type: "success" });
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(e),
        type: "error",
      });
    } finally {
      setActionId(null);
    }
  };

  const handleRemoveClick = (img: ImageItem) => {
    setImageToRemove(img);
  };

  const handleRemoveConfirm = async () => {
    if (!imageToRemove || actionId) return;
    setActionId(imageToRemove.id);
    try {
      if (isVariant && variantId) {
        await removeProductVariantImage(variantId, imageToRemove.id);
      } else {
        await removeProductImage(productId, imageToRemove.id);
      }
      await refreshImages();
      toast({ title: "Imagen eliminada", type: "success" });
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(e),
        type: "error",
      });
    } finally {
      setActionId(null);
      setImageToRemove(null);
    }
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const applyReorder = async (reordered: ImageItem[]) => {
    const newOrder = reordered.map((img, i) => ({ id: img.id, sortOrder: i }));
    try {
      if (isVariant && variantId) {
        await reorderProductVariantImages(variantId, newOrder);
      } else {
        await reorderProductImages(productId, newOrder);
      }
      await refreshImages();
    } catch (e: unknown) {
      toast({
        title: "Error al reordenar",
        description: getErrorMessage(e),
        type: "error",
      });
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    setDraggedIndex(null);
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    const next = [...images];
    const [removed] = next.splice(draggedIndex, 1);
    if (!removed) return;
    next.splice(dropIndex, 0, removed);
    void applyReorder(next);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const remainingSlots = Math.max(0, maxImages - images.length);
  const dropzoneLabel = (() => {
    if (images.length >= maxImages) return `Máximo ${maxImages} imágenes`;
    if (isDragActive) return "Suelta aquí (varias a la vez)";
    return remainingSlots > 1
      ? "Arrastra varias imágenes o haz clic para seleccionar varias"
      : "Arrastra o haz clic para agregar imagen";
  })();

  return (
    <section
      className={cn("space-y-4", className)}
      aria-label={
        isVariant ? "Imágenes de la variante" : "Imágenes del producto"
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        {!disabled && (
          <div
            {...getRootProps()}
            aria-label={
              images.length >= maxImages
                ? `Máximo ${maxImages} imágenes alcanzado`
                : `Añadir una o varias imágenes. Arrastra o haz clic para seleccionar varias a la vez. ${DROPZONE_HINT}`
            }
            className={cn(
              "flex min-h-[120px] w-full min-w-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200",
              "border-[#f5b1cc]/60 bg-gradient-to-br from-pink-50/80 to-purple-50/80 hover:scale-[1.02] hover:border-[#ff48b0]/60 hover:from-pink-100/80 hover:to-purple-100/80",
              "dark:border-pink-900/50 dark:from-pink-950/50 dark:to-purple-950/50 dark:hover:border-[#ff48b0]/50",
              (uploading || images.length >= maxImages) &&
                "pointer-events-none opacity-60"
            )}
          >
            <input
              {...getInputProps()}
              tabIndex={-1}
              multiple
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            />
            {uploading ? (
              <BiLoaderAlt
                className="h-8 w-8 animate-spin text-[#ff48b0]"
                aria-hidden="true"
              />
            ) : (
              <BiImageAdd
                className="h-8 w-8 text-[#ff48b0]"
                aria-hidden="true"
              />
            )}
            <span className="mt-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400">
              {dropzoneLabel}
            </span>
            <span className="mt-0.5 text-center text-[10px] text-gray-500 dark:text-gray-500">
              {DROPZONE_HINT}
            </span>
            {remainingSlots > 1 && (
              <span className="text-center text-[10px] text-[#ff48b0]/80 dark:text-pink-400/90">
                {DROPZONE_MULTI_HINT}
              </span>
            )}
          </div>
        )}
        <ul className="contents list-none">
          {images.map((img, index) => (
            <li
              key={img.id}
              draggable={!disabled}
              onDragStart={() => !disabled && handleDragStart(index)}
              onDragOver={e => !disabled && handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={e => !disabled && handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-transform duration-200 hover:scale-[1.02] hover:shadow-md dark:border-gray-700 dark:bg-gray-800",
                !disabled && "cursor-grab active:cursor-grabbing",
                draggedIndex === index && "opacity-50",
                dragOverIndex === index && "ring-2 ring-[#ff48b0] ring-offset-2"
              )}
            >
              <div className="relative h-28 w-36 overflow-hidden bg-gray-100 dark:bg-gray-900">
                {img.url.includes("supabase") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Proxied to avoid ERR_BLOCKED_BY_ORB with Supabase Storage
                  <img
                    src={getProductImageSrc(img.url)}
                    alt={
                      img.isPrimary
                        ? `Imagen principal del producto (${index + 1} de ${images.length})`
                        : `Imagen del producto (${index + 1} de ${images.length})`
                    }
                    className="absolute inset-0 h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Image
                    src={img.url}
                    alt={
                      img.isPrimary
                        ? `Imagen principal del producto (${index + 1} de ${images.length})`
                        : `Imagen del producto (${index + 1} de ${images.length})`
                    }
                    fill
                    className="object-cover"
                    sizes="144px"
                  />
                )}
                {img.isPrimary && (
                  <div className="absolute left-1 top-1 rounded bg-[#ff48b0] px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                    Principal
                  </div>
                )}
              </div>
              {!disabled && (
                <div className="flex items-center justify-between gap-1 border-t border-gray-100 p-1.5 dark:border-gray-700">
                  <fieldset className="flex min-w-0 items-center gap-0.5 border-0 p-0">
                    <legend className="sr-only">
                      Arrastrar para reordenar y establecer principal
                    </legend>
                    <span
                      className="inline-flex text-gray-400 hover:text-[#ff48b0]"
                      title="Arrastrar la imagen para reordenar"
                      aria-label="Arrastrar para reordenar"
                    >
                      <BiMove className="h-4 w-4" />
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-gray-500 hover:text-[#ff48b0]"
                      onClick={() => handleSetPrimary(img.id)}
                      disabled={img.isPrimary || actionId === img.id}
                      title="Establecer como principal"
                      aria-label={
                        img.isPrimary
                          ? "Ya es la imagen principal"
                          : "Establecer como imagen principal"
                      }
                    >
                      <BiStar
                        className={cn(
                          "h-4 w-4",
                          img.isPrimary && "fill-[#ff48b0] text-[#ff48b0]"
                        )}
                      />
                    </Button>
                  </fieldset>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    onClick={() => handleRemoveClick(img)}
                    disabled={actionId === img.id}
                    title="Eliminar imagen"
                    aria-label="Eliminar imagen"
                  >
                    <BiTrash className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <AlertDialog.Root
        open={!!imageToRemove}
        onOpenChange={open => !open && setImageToRemove(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <AlertDialog.Content
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
            onEscapeKeyDown={() => setImageToRemove(null)}
          >
            <AlertDialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
              ¿Eliminar imagen?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Esta imagen se quitará del producto. Puedes subir otra cuando
              quieras.
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button type="button" variant="outline" size="sm">
                  Cancelar
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50"
                  onClick={handleRemoveConfirm}
                >
                  Eliminar
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}
