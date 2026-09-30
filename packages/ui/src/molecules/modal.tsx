import React, { forwardRef, Children, isValidElement } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { AiOutlineClose } from "react-icons/ai";

import { cn } from "@esli-cosmetics/utils";
import type { ModalProps as BaseModalProps } from "@esli-cosmetics/types";

/**
 * Select / Dropdown / Popover content is often portaled to `document.body`, so it is not a DOM
 * descendant of `Dialog.Content`. Without this check, Radix Dialog treats clicks on those
 * surfaces as "outside" the modal and will close or steal the interaction.
 */
function isPointerFromPortaledOverlay(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest("[data-searchable-select-panel]") !== null ||
    target.closest("[data-searchable-multi-select-panel]") !== null ||
    target.closest("[data-radix-dropdown-menu-content]") !== null ||
    target.closest("[data-radix-menubar-content]") !== null ||
    target.closest("[data-radix-context-menu-content]") !== null ||
    target.closest('[role="listbox"][data-state]') !== null
  );
}

function getDismissableLayerTarget(event: {
  target: EventTarget | null;
  detail?: { originalEvent?: Event };
}): EventTarget | null {
  const original = event.detail?.originalEvent;
  if (
    original &&
    "target" in original &&
    original.target !== undefined &&
    original.target !== null
  ) {
    return original.target;
  }
  return event.target;
}

const modalOverlayVariants = cva(
  "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
);

const modalContentVariants = cva(
  "fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] dark:bg-neutral-800 dark:border-neutral-700",
  {
    variants: {
      size: {
        sm: "max-w-sm rounded-xl",
        md: "max-w-md rounded-xl",
        lg: "max-w-lg rounded-xl",
        xl: "max-w-xl rounded-xl",
        "2xl": "max-w-2xl rounded-xl",
        full: "max-w-[95vw] max-h-[95vh] rounded-2xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

type ModalProps = BaseModalProps &
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> &
  VariantProps<typeof modalContentVariants> & {
    title?: string;
    description?: string;
    showCloseButton?: boolean;
    closeOnOverlayClick?: boolean;
    closeOnEscape?: boolean;
  };

const Modal = ({ children, onClose, ...props }: ModalProps) => (
  <DialogPrimitive.Root {...props} onOpenChange={open => !open && onClose()}>
    {children}
  </DialogPrimitive.Root>
);

const ModalTrigger = DialogPrimitive.Trigger;

const ModalPortal = DialogPrimitive.Portal;

const ModalClose = DialogPrimitive.Close;

const ModalOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(modalOverlayVariants(), className)}
    {...props}
  />
));
ModalOverlay.displayName = DialogPrimitive.Overlay.displayName;

const ModalContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
    VariantProps<typeof modalContentVariants> & {
      showCloseButton?: boolean;
      hiddenTitle?: string;
    }
>(
  (
    {
      className,
      children,
      size,
      showCloseButton = true,
      hiddenTitle,
      onPointerDownOutside,
      onInteractOutside,
      ...props
    },
    ref
  ) => {
    // Check if children contain a ModalTitle or DialogPrimitive.Title
    const hasTitle = (() => {
      const checkChild = (child: React.ReactNode): boolean => {
        if (!isValidElement(child)) return false;

        // Check if it's ModalTitle component
        if (child.type === ModalTitle) return true;

        // Check if it's DialogPrimitive.Title by displayName
        const childType = child.type;
        if (
          typeof childType === "object" &&
          childType !== null &&
          "displayName" in childType
        ) {
          const displayName = (childType as { displayName?: string })
            .displayName;
          if (
            displayName === DialogPrimitive.Title.displayName ||
            displayName === ModalTitle.displayName
          ) {
            return true;
          }
        }

        // Recursively check children
        const childProps = child.props as { children?: React.ReactNode };
        if (childProps?.children) {
          return Children.toArray(childProps.children).some(checkChild);
        }

        return false;
      };

      return Children.toArray(children).some(checkChild);
    })();

    return (
      <ModalPortal>
        <ModalOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(modalContentVariants({ size }), className)}
          {...props}
          onPointerDownOutside={event => {
            onPointerDownOutside?.(event);
            if (event.defaultPrevented) return;
            const target = getDismissableLayerTarget(event);
            if (isPointerFromPortaledOverlay(target)) {
              event.preventDefault();
            }
          }}
          onInteractOutside={event => {
            onInteractOutside?.(event);
            if (event.defaultPrevented) return;
            const target = getDismissableLayerTarget(event);
            if (isPointerFromPortaledOverlay(target)) {
              event.preventDefault();
            }
          }}
        >
          {!hasTitle && (
            <DialogPrimitive.Title className="sr-only">
              {hiddenTitle ?? "Dialog"}
            </DialogPrimitive.Title>
          )}
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-neutral-100 data-[state=open]:text-neutral-500 dark:ring-offset-neutral-950 dark:focus:ring-primary-300 dark:data-[state=open]:bg-neutral-800 dark:data-[state=open]:text-neutral-400">
              {React.createElement(AiOutlineClose as React.ElementType, {
                className: "h-4 w-4",
              })}
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </ModalPortal>
    );
  }
);
ModalContent.displayName = DialogPrimitive.Content.displayName;

const ModalHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
ModalHeader.displayName = "ModalHeader";

const ModalFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-2", className)} {...props} />
);
ModalFooter.displayName = "ModalFooter";

const ModalTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-neutral-900 dark:text-neutral-100",
      className
    )}
    {...props}
  />
));
ModalTitle.displayName = DialogPrimitive.Title.displayName;

const ModalDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-neutral-500 dark:text-neutral-400", className)}
    {...props}
  />
));
ModalDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Modal,
  ModalPortal,
  ModalOverlay,
  ModalClose,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
};
export type { ModalProps };
