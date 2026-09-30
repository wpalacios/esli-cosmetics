import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateTaxRateDto } from "./dto/create-tax-rates.dto";
import { UpdateTaxRateDto } from "./dto/update-tax-rates.dto";
import { PaginatedTaxRateDto } from "./dto/paginated-tax-rates.dto";
import { TaxRateDto } from "./dto/tax-rates.dto";
import { Prisma } from "@prisma/client";
@Injectable()
export class TaxRatesService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly logger = new Logger(TaxRatesService.name);

  private mapTaxRate(record: any): TaxRateDto {
    return {
      id: record.id,
      name: record.name ?? null,
      code: record.code ?? null,
      // Prisma Decimal -> number
      rate:
        record.rate === null || record.rate === undefined
          ? null
          : Number(record.rate),
      active: record.active,
      isDeleted: record.isDeleted ?? false,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt ?? null,
    } as TaxRateDto;
  }

  async create(createDto: CreateTaxRateDto): Promise<TaxRateDto> {
    // optional uniqueness check on code if provided
    if (createDto.code) {
      const existing = await this.prisma.taxRate.findFirst({
        where: { code: createDto.code, isDeleted: false },
      });
      if (existing) {
        throw new ConflictException("Tax rate with this code already exists");
      }
    }

    if (createDto.name || createDto.code) {
      const existing = await this.prisma.taxRate.findFirst({
        where: {
          isDeleted: false,
          OR: [
            ...(createDto.name ? [{ name: createDto.name }] : []),
            ...(createDto.code ? [{ code: createDto.code }] : []),
          ],
        },
      });
      if (existing) {
        throw new ConflictException(
          "Tax rate with this name or code already exists"
        );
      }
    }

    const created = await this.prisma.taxRate.create({
      data: {
        name: createDto.name ?? null,
        code: createDto.code ?? null,
        rate:
          createDto.rate === undefined || createDto.rate === null
            ? null
            : createDto.rate,
        active: createDto.active === undefined ? true : createDto.active,
      },
    });

    this.logger.log(`Created tax rate ${created.id}`);
    return this.mapTaxRate(created);
  }

  async findAll(
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedTaxRateDto> {
    const skip = (page - 1) * limit;

    const whereClause: Prisma.TaxRateWhereInput = {
      isDeleted: false,
    };

    const [items, total] = await Promise.all([
      this.prisma.taxRate.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.taxRate.count({
        where: whereClause,
      }),
    ]);

    const mappedTaxRates = items.map(i => this.mapTaxRate(i));

    const totalPages = Math.ceil(total / limit);

    return {
      data: mappedTaxRates,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async searchTaxRates(
    search: string,
    page = 1,
    limit = 10
  ): Promise<{ data: TaxRateDto[]; pagination: any }> {
    const skip = (page - 1) * limit;

    if (!search || search.trim() === "") {
      throw new BadRequestException("You must provide a search term");
    }

    const cleanedSearch = search.trim();

    const whereClause: Prisma.TaxRateWhereInput = {
      isDeleted: false,
      OR: [
        {
          name: { contains: cleanedSearch, mode: Prisma.QueryMode.insensitive },
        },
        {
          code: { contains: cleanedSearch, mode: Prisma.QueryMode.insensitive },
        },
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.taxRate.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.taxRate.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(i => this.mapTaxRate(i)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<TaxRateDto> {
    const record = await this.prisma.taxRate.findUnique({ where: { id } });
    if (!record || record.isDeleted) {
      throw new NotFoundException("Tax rate not found");
    }
    return this.mapTaxRate(record);
  }

  async update(id: string, updateDto: UpdateTaxRateDto): Promise<TaxRateDto> {
    const existing = await this.prisma.taxRate.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) {
      throw new NotFoundException("Tax rate not found");
    }

    if (updateDto.code && updateDto.code !== existing.code) {
      const conflict = await this.prisma.taxRate.findFirst({
        where: { code: updateDto.code, NOT: { id }, isDeleted: false },
      });
      if (conflict) {
        throw new ConflictException("Tax rate with this code already exists");
      }
    }

    const updated = await this.prisma.taxRate.update({
      where: { id },
      data: {
        name: updateDto.name ?? existing.name,
        code: updateDto.code ?? existing.code,
        rate:
          updateDto.rate === undefined
            ? existing.rate
            : updateDto.rate === null
              ? null
              : updateDto.rate,
        active: updateDto.active ?? existing.active,
      },
    });

    this.logger.log(`Updated tax rate ${updated.id}`);
    return this.mapTaxRate(updated);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.taxRate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Tax rate not found");
    }

    // soft delete
    await this.prisma.taxRate.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    this.logger.log(`Soft-deleted tax rate ${id}`);
  }
}
