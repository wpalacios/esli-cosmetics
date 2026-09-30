// Cash Register types for POS cash management

export type CashMovementType = "IN" | "OUT";

export type CashSessionStatus = "open" | "closed";

export interface CashRegister {
  id: string;
  locationId?: string | null;
  name: string;
  code?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  location?: {
    id: string;
    name: string;
    branchId?: string | null;
  } | null;
  openSession?: CashSession | null;
  openSessionId?: string | null;
}

export interface CashSession {
  id: string;
  cashRegisterId: string;
  employeeId: string;
  closedById?: string | null;
  closedBy?: {
    id: string;
    person?: {
      firstName: string;
      lastName?: string | null;
    } | null;
  } | null;
  openedAt: Date;
  closedAt?: Date | null;
  openingBalance: number;
  closingBalance?: number | null;
  systemTotal?: number | null;
  difference?: number | null;
  status: CashSessionStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  cashRegister?: CashRegister;
  employee?: {
    id: string;
    person?: {
      firstName: string;
      lastName?: string | null;
    } | null;
  };
  movements?: CashMovement[];
  orders?: Array<{
    id: string;
    orderNumber?: string | null;
    totalAmount?: number | null;
    paymentMethod?: "CASH" | "CREDIT";
    createdAt?: Date | string;
    payments?: Array<{
      id: string;
      paymentType: string;
      provider?: string | null;
      amount: number;
      transactionReference?: string | null;
      paidAt: Date | string;
    }>;
    credit?: {
      id: string;
      principalAmount: number;
    } | null;
  }>;

  creditInstallmentPayments?: Array<{
    id: string;
    orderId: string;
    orderNumber?: string | null;
    installmentNo?: number | null;
    paymentType: string;
    provider?: string | null;
    amount: number;
    transactionReference?: string | null;
    paidAt: Date | string;
  }>;
}

export interface CashMovement {
  id: string;
  cashSessionId: string;
  type: CashMovementType;
  amount: number;
  reason?: string | null;
  referenceOrderId?: string | null;
  createdBy?: string | null;
  createdAt: Date;
  cashSession?: CashSession;
  referenceOrder?: {
    id: string;
    orderNumber?: string | null;
  } | null;
  creator?: {
    id: string;
    email: string;
  } | null;
}

export interface CashSessionWithDetails extends CashSession {
  movements: CashMovement[];
  orders: Array<{
    id: string;
    orderNumber?: string | null;
    totalAmount?: number | null;
    paymentMethod?: "CASH" | "CREDIT";
    createdAt: Date;
    payments?: Array<{
      id: string;
      paymentType: string;
      provider?: string | null;
      amount: number;
      transactionReference?: string | null;
      paidAt: Date | string;
    }>;
    credit?: {
      id: string;
      principalAmount: number;
    } | null;
  }>;
  creditInstallmentPayments?: Array<{
    id: string;
    orderId: string;
    orderNumber?: string | null;
    installmentNo?: number | null;
    paymentType: string;
    provider?: string | null;
    amount: number;
    transactionReference?: string | null;
    paidAt: Date | string;
  }>;
}

// Request DTOs
export interface CreateCashRegisterRequest {
  locationId?: string;
  name: string;
  code?: string;
  isActive?: boolean;
}

export interface UpdateCashRegisterRequest
  extends Partial<CreateCashRegisterRequest> {}

export interface OpenCashSessionRequest {
  cashRegisterId: string;
  openingBalance: number;
  employeeId?: string; // Optional, will be populated from current user if not provided
  openedAt?: string; // ISO 8601 datetime string with timezone (optional, defaults to server time)
}

export interface CloseCashSessionRequest {
  closingBalance: number;
  notes?: string;
  closedAt?: string; // ISO 8601 datetime string with timezone (optional, defaults to server time)
}

export interface CreateCashMovementRequest {
  cashSessionId: string;
  type: CashMovementType;
  amount: number;
  reason?: string;
  referenceOrderId?: string;
}

// Response types
export interface CashRegistersResponse {
  data: CashRegister[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface CashSessionsResponse {
  data: CashSession[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface CashMovementsResponse {
  data: CashMovement[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// Filter types
export interface CashRegisterFilters {
  page?: number;
  limit?: number;
  search?: string;
  locationId?: string;
  isActive?: boolean;
}

export interface CashSessionFilters {
  page?: number;
  limit?: number;
  cashRegisterId?: string;
  employeeId?: string;
  closedBy?: string;
  status?: CashSessionStatus;
  startDate?: string;
  endDate?: string;
}

export interface CashMovementFilters {
  page?: number;
  limit?: number;
  cashSessionId?: string;
  type?: CashMovementType;
  startDate?: string;
  endDate?: string;
}
