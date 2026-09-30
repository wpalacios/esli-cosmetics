export type TaxRate = {
  id: string;
  name?: string | null;
  code?: string | null;
  rate?: number | null;
  active: boolean;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type CreateTaxRateDto = {
  name?: string;
  code?: string;
  rate?: number;
  active?: boolean;
};

export type UpdateTaxRateDto = Partial<CreateTaxRateDto>;

export type PaginatedTaxRates = {
  data: TaxRate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export type DeleteTaxRatesDto = {
  ids: string[];
};

export type TaxRatesResponse = {
  data: TaxRate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};
