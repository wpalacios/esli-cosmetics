import { PriceType } from "./prices";
import { DiscountCode } from "./discount-codes";
import { CustomerType } from "./customer-types";

// Extended customer type with nested relations for API responses
export interface CustomerWithRelations {
  id: string;
  personId: string;
  userId?: string;
  externalId?: string;
  defaultBillingAddressId?: string;
  priceTypeIds?: string[];
  priceTypes?: PriceType[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  metadata?: Record<string, unknown>;
  person?: {
    id: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    docType?: string;
    docNumber?: string;
  };
  user?: {
    id: string;
    email: string;
    isActive: boolean;
  };
  defaultBillingAddress?: {
    id: string;
    address: string;
    city?: string;
    postalCode?: string;
  };
  orders?: Array<{
    id: string;
    status: string | null;
    totalAmount: number | null;
    createdAt: string;
  }>;
  discountCodes?: Array<{
    id: string;
    discountCode: DiscountCode;
    isRedeemed: boolean;
    assignedAt: string;
  }>;
  /**
   * Customer type relation for UI and API
   */
  customerType?: CustomerType;
  /**
   * Optional raw customer type id (for fallback when relation missing)
   */
  customerTypeId?: string;
  creditAllowed?: boolean;
  creditLimit?: number;
  initialOpeningBalance?: number;
}

export interface CustomerAddressInput {
  address?: string;
  city?: string;
  postalCode?: string;
}

export interface CreateCustomerRequest {
  person: {
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    docType?: string;
    docNumber?: string;
  };
  address?: CustomerAddressInput;
  userId?: string;
  externalId?: string;
  defaultBillingAddressId?: string;
  priceTypeIds?: string[];
  discountCodeIds?: string[];
  creditAllowed?: boolean;
  creditLimit?: number;
  initialOpeningBalance?: number;
}

export interface UpdateCustomerRequest {
  person?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    docType?: string;
    docNumber?: string;
  };
  address?: CustomerAddressInput;
  userId?: string;
  externalId?: string;
  defaultBillingAddressId?: string;
  priceTypeIds?: string[];
  discountCodeIds?: string[];
  creditAllowed?: boolean;
  creditLimit?: number;
  initialOpeningBalance?: number;
}

export interface CustomersResponse {
  data: CustomerWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CustomerFilters {
  page?: number;
  limit?: number;
  search?: string;
}

export interface AccountStatementTransaction {
  id: string;
  type:
    | "ORDER"
    | "CREDIT_INSTALLMENT"
    | "PAYMENT"
    | "REFUND"
    | "INITIAL_BALANCE"
    | "CREDIT_NOTE";
  date: string;
  description: string;
  reference: string;
  debit: number | null;
  credit: number | null;
  balance: number;
  metadata?: {
    orderId?: string;
    creditId?: string;
    installmentId?: string;
    paymentId?: string;
    creditNoteId?: string;
    /** True when this transaction is an annulled order (debit shown for audit trail). */
    annulled?: boolean;
    /** True when payment was already reversed. */
    reversed?: boolean;
    /** Compatibility helper for consumers expecting classic payment-only semantics. */
    legacyType?: "PAYMENT";
    /** Compatibility helper to aggregate initial payments by order. */
    legacyGroupId?: string;
  };
}

export interface AccountStatementCredit {
  id: string;
  orderNumber: string;
  principalAmount: number;
  outstandingAmount: number;
  status: string;
  createdAt: string;
  durationDays: number | null;
  installmentCount: number;
  installments: Array<{
    id: string;
    installmentNo: number;
    dueDate: string;
    amount: number;
    paidAmount: number;
    status: string;
  }>;
}

export interface AccountStatementSummary {
  openingBalance: number;
  totalCharges: number;
  totalPayments: number;
  closingBalance: number;
  creditLimit: number | null;
  availableCredit: number | null;
  outstandingAmount: number;
}

export interface AccountStatementResponse {
  customer: {
    id: string;
    person: {
      firstName: string;
      lastName?: string;
      email?: string;
      phone?: string;
    };
    creditAllowed: boolean;
    creditLimit: number | null;
    initialOpeningBalance: number;
  };
  summary: AccountStatementSummary;
  transactions: AccountStatementTransaction[];
  credits?: AccountStatementCredit[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AccountStatementParams {
  customerId: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  transactionType?: string;
}
