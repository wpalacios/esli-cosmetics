import type { ReactNode, ComponentProps } from "react";

// Base component types
export type ComponentSize = "xs" | "sm" | "md" | "lg" | "xl";
export type ComponentVariant =
  | "primary"
  | "secondary"
  | "accent"
  | "success"
  | "warning"
  | "error"
  | "ghost"
  | "outline";
export type ComponentState = "idle" | "loading" | "success" | "error";

// Common component props
export type BaseComponentProps = {
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
};

// Button types
export type ButtonProps = BaseComponentProps & {
  variant?: ComponentVariant;
  size?: ComponentSize;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
} & ComponentProps<"button">;

// Input types
export type InputProps = BaseComponentProps & {
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  size?: ComponentSize;
} & Omit<ComponentProps<"input">, "size">;

export type TextareaProps = BaseComponentProps & {
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  rows?: number;
  resize?: boolean;
} & ComponentProps<"textarea">;

// Select types
export type SelectOption = {
  value: string | number;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
};

export type SelectProps = BaseComponentProps & {
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  value?: string | number;
  onValueChange?: (value: string | number) => void;
  searchable?: boolean;
  multiple?: boolean;
  size?: ComponentSize;
};

// Modal and Dialog types
export type ModalProps = BaseComponentProps & {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
};

export type DialogProps = ModalProps & {
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  variant?: "info" | "warning" | "error" | "success";
};

// Toast and Notification types
export type ToastType = "success" | "error" | "warning" | "info";

export type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export type ToastContextType = {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
};

// Form types
export type FormField = {
  name: string;
  label: string;
  type:
    | "text"
    | "email"
    | "password"
    | "number"
    | "select"
    | "textarea"
    | "checkbox"
    | "radio"
    | "file"
    | "date";
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: SelectOption[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: unknown) => string | undefined;
  };
};

export type FormProps = BaseComponentProps & {
  fields: FormField[];
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  submitText?: string;
  cancelText?: string;
  onCancel?: () => void;
  loading?: boolean;
  layout?: "vertical" | "horizontal" | "grid";
};

// Card types
export type CardProps = BaseComponentProps & {
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  variant?: "default" | "glass" | "gradient" | "bordered";
  hover?: boolean;
  clickable?: boolean;
  onClick?: () => void;
};

// Navigation types
export type NavItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  badge?: string | number;
  disabled?: boolean;
  children?: NavItem[];
};

export type BreadcrumbItem = {
  label: string;
  href?: string;
  active?: boolean;
};

export type BreadcrumbProps = BaseComponentProps & {
  items: BreadcrumbItem[];
  separator?: ReactNode;
};

// Layout types
export type LayoutProps = BaseComponentProps & {
  sidebar?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: (collapsed: boolean) => void;
};

// Data display types
export type StatCardProps = BaseComponentProps & {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease";
    period?: string;
  };
  icon?: ReactNode;
  variant?: ComponentVariant;
};

export type ChartData = {
  label: string;
  value: number;
  color?: string;
};

export type ChartProps = BaseComponentProps & {
  data: ChartData[];
  type: "line" | "bar" | "pie" | "area";
  height?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
};

// Search and Filter types
export type SearchInputProps = BaseComponentProps & {
  placeholder?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
  showClearButton?: boolean;
} & Omit<ComponentProps<"input">, "onChange">;

export type FilterOption = {
  key: string;
  label: string;
  type: "select" | "range" | "date" | "boolean";
  options?: SelectOption[];
  defaultValue?: unknown;
};

export type FilterBarProps = BaseComponentProps & {
  filters: FilterOption[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onReset: () => void;
};
