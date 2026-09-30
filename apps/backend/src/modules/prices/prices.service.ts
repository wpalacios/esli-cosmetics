import {
  Injectable,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreatePriceDto } from "./dto/create-price.dto";
import { PriceDto } from "./dto/prices.dto";
import { Prisma } from "@prisma/client";
import { PaginatedPricesDto } from "./dto/paginated-prices.dto";
import { UpdatePriceDto } from "./dto/update-price.dto";
import { DeletePriceResponseDto } from "./dto/delete-price.dto";

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async validatePriceExists(id: string): Promise<any> {
    const existingPrice = await this.prisma.priceType.findFirst({
      where: { id },
    });

    if (!existingPrice) {
      this.logger.warn(`Price with ID ${id} not found`);
      throw new NotFoundException(`Price with ID ${id} not found`);
    }
    this.logger.debug(`PriceType found for ID: ${id}.`);
    return existingPrice;
  }

  private async validatePriceName(
    name: string,
    excludeId?: string
  ): Promise<void> {
    const existingName = await this.prisma.priceType.findFirst({
      where: {
        ...(excludeId && { id: { not: excludeId } }),
        name: { equals: name, mode: Prisma.QueryMode.insensitive },
      },
    });

    if (existingName && !existingName.isDeleted) {
      this.logger.warn(
        `Conflict: Price name '${name}' already exists (ID: ${existingName.id})`
      );
      throw new ConflictException(`Price name '${name} already exists'`);
    } else if (existingName?.isDeleted) {
      // hard-delete the price, user will not be able to recover it
      await this.prisma.priceType.delete({
        where: { id: existingName.id },
      });
    }
  }

  private cleanAndValidateName(name: string | undefined): string | undefined {
    if (!name) {
      return null;
    }

    const cleanedName = name.trim();

    if (cleanedName.length === 0) {
      this.logger.warn("Validation failed: name is empty after trimming");
      throw new BadRequestException("Name cannot be empty or whitespace only");
    }
    return cleanedName;
  }

  private cleanAndValidateDescription(
    description: string | undefined
  ): string | null | undefined {
    if (!description) {
      return null;
    }

    const cleanedDescription = description.trim();
    if (cleanedDescription.length === 0) {
      return null;
    }

    this.validateDescriptionLength(cleanedDescription);

    return cleanedDescription;
  }

  private validateDescriptionLength(description: string | null): void {
    if (description && description.length > 255) {
      this.logger.warn(
        "Validation failed: description exceeds max length (255)"
      );
      throw new BadRequestException(
        "Description must be 255 characters or less"
      );
    }
  }

  private async validatePricePriority(
    priority: number,
    excludeId?: string
  ): Promise<void> {
    const existingPriority = await this.prisma.priceType.findFirst({
      where: {
        priority: priority,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    if (existingPriority && !existingPriority.isDeleted) {
      this.logger.warn(
        `PriceType conflict: priority ${priority} already used by ID ${existingPriority.id}`
      );
      throw new ConflictException(
        `PriceType with priority ${priority} already exists. Please choose a different priority.`
      );
    } else if (existingPriority?.isDeleted) {
      // hard-delete the price, user will not be able to recover it
      await this.prisma.priceType.delete({
        where: { id: existingPriority.id },
      });
    }
  }

  private handlePrismaError(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2003": // Foreign Key Constraint
          throw new BadRequestException(
            "Invalid reference ID for a related entity."
          );
        case "P2002": // Unique Constraint
          throw new ConflictException(
            "A record with the given unique constraints already exists."
          );
      }
    }
  }

  async create({
    name,
    description,
    minQuantity,
    priority,
    isActive = true,
  }: CreatePriceDto): Promise<PriceDto> {
    const cleanedName = this.cleanAndValidateName(name);
    const cleanedDescription = this.cleanAndValidateDescription(description);

    try {
      await this.validatePriceName(cleanedName as string);
      await this.validatePricePriority(priority);

      const created = await this.prisma.priceType.create({
        data: {
          name: cleanedName as string,
          description: cleanedDescription,
          minQuantity,
          priority,
          isActive,
          isDeleted: false,
        },
      });

      this.logger.log(`PriceType created with id: ${created.id}`);

      return {
        id: created.id,
        name: created.name,
        description: created.description,
        minQuantity: created.minQuantity,
        priority: created.priority,
        isActive: created.isActive,
        isDeleted: created.isDeleted,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        deletedAt: created.deletedAt,
      };
    } catch (error) {
      this.handlePrismaError(error);

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException("Failed to create PriceType");
    }
  }

  async findAll(page: number = 1, limit = 10): Promise<PaginatedPricesDto> {
    const skip = (page - 1) * limit;

    const whereClause: Prisma.PriceTypeWhereInput = {
      isDeleted: false,
    };

    try {
      const [priceTypes, total] = await Promise.all([
        this.prisma.priceType.findMany({
          where: whereClause,
          skip: skip,
          take: limit,
          orderBy: { name: "asc" },
        }),
        this.prisma.priceType.count({
          where: whereClause,
        }),
      ]);

      const totalPages = Math.ceil(total / limit);
      this.logger.log(
        `Successfully fetched ${priceTypes.length} PriceTypes. Total records: ${total}`
      );

      const mappedPriceTypes: PriceDto[] = priceTypes.map(priceType => ({
        id: priceType.id,
        name: priceType.name,
        description: priceType.description,
        minQuantity: priceType.minQuantity,
        priority: priceType.priority,
        isActive: priceType.isActive,
        isDeleted: priceType.isDeleted,
        createdAt: priceType.createdAt,
        updatedAt: priceType.updatedAt,
        deletedAt: priceType.deletedAt,
      }));

      return {
        data: mappedPriceTypes,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error fetching paginated PriceTypes: ${error.message}`,
        error.stack
      );
      throw new InternalServerErrorException("Failed to fetch PriceTypes");
    }
  }

  async searchPrices(
    search?: string,
    page = 1,
    limit = 10
  ): Promise<PaginatedPricesDto> {
    const skip = (page - 1) * limit;

    if (!search || search.trim() === "") {
      this.logger.log("Validation failed: search term is empty or missing");
      throw new BadRequestException("You must provide a search term");
    }

    const searchTerm = search.trim();
    const whereClause: Prisma.PriceTypeWhereInput = {
      isDeleted: false,
      isActive: true,
      name: {
        contains: searchTerm,
        mode: Prisma.QueryMode.insensitive,
      },
    };

    try {
      const [priceTypes, total] = await Promise.all([
        this.prisma.priceType.findMany({
          where: whereClause,
          skip: skip,
          take: limit,
          orderBy: { name: "asc" },
        }),
        this.prisma.priceType.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);

      this.logger.log(
        `Search successful. Found ${priceTypes.length} Prices matching '${searchTerm}. Total records: ${total}`
      );

      const mappedPriceTypes: PriceDto[] = priceTypes.map(priceTypes => ({
        id: priceTypes.id,
        name: priceTypes.name,
        description: priceTypes.description ?? null,
        minQuantity: priceTypes.minQuantity,
        priority: priceTypes.priority,
        isActive: priceTypes.isActive,
        isDeleted: priceTypes.isDeleted,
        createdAt: priceTypes.createdAt,
        updatedAt: priceTypes.updatedAt,
        deletedAt: priceTypes.deletedAt,
      }));

      return {
        data: mappedPriceTypes,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error searching PriceTypes by name: ${error.message}`,
        error.stack
      );

      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException("Failed to search Prices");
    }
  }

  async findOne(id: string): Promise<PriceDto> {
    const price = await this.prisma.priceType.findFirst({
      where: {
        id: id,
        isDeleted: false,
      },
    });

    if (!price) {
      this.logger.warn(`Price with ID ${id} not found or is deleted.`);
      throw new NotFoundException(`Price with ID ${id} not found.`);
    }

    this.logger.log(`Successfully fetched Price: ${id}`);

    return {
      id: price.id,
      name: price.name,
      description: price.description ?? null,
      minQuantity: price.minQuantity,
      priority: price.priority,
      isActive: price.isActive,
      isDeleted: price.isDeleted,
      createdAt: price.createdAt,
      updatedAt: price.updatedAt,
      deletedAt: price.deletedAt,
    };
  }

  async update(id: string, updatePriceDto: UpdatePriceDto): Promise<PriceDto> {
    let existingPrice;

    try {
      existingPrice = await this.validatePriceExists(id);
    } catch (error) {
      this.logger.error(`Validation failed: PriceType ID ${id} not found.`);
      throw error;
    }

    const { name, priority, description, ...rest } = updatePriceDto;
    const cleanedName = this.cleanAndValidateName(name);
    const cleanedDescription = this.cleanAndValidateDescription(description);

    try {
      if (
        cleanedName &&
        cleanedName.toLowerCase() !== existingPrice.name.toLowerCase()
      ) {
        await this.validatePriceName(cleanedName, id);
      }

      if (priority !== undefined && priority !== existingPrice.priority) {
        await this.validatePricePriority(priority, id);
      }

      const dataToUpdate = {
        ...rest,
        ...(cleanedName !== undefined && { name: cleanedName }),
        ...(cleanedDescription !== undefined && {
          description: cleanedDescription,
        }),
        ...(priority !== undefined && { priority: priority }),
        updatedAt: new Date(),
      };

      const updatedPrice = await this.prisma.priceType.update({
        where: { id },
        data: dataToUpdate,
      });

      this.logger.log(`PriceType with ID '${id}' updated successfully.`);

      return {
        id: updatedPrice.id,
        name: updatedPrice.name,
        description: updatedPrice.description ?? null,
        minQuantity: updatedPrice.minQuantity,
        priority: updatedPrice.priority,
        isActive: updatedPrice.isActive,
        isDeleted: updatedPrice.isDeleted,
        createdAt: updatedPrice.createdAt,
        updatedAt: updatedPrice.updatedAt,
        deletedAt: updatedPrice.deletedAt,
      };
    } catch (error) {
      this.handlePrismaError(error);

      this.logger.error(
        `Error updating PriceType ID ${id}: ${error.message}`,
        error.stack
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to update PriceType ID ${id}`
      );
    }
  }

  async remove(id: string): Promise<DeletePriceResponseDto> {
    const price = await this.prisma.priceType.findFirst({
      where: { id },
    });

    if (!price) {
      this.logger.warn(`Price type with ID ${id} not found.`);
      throw new NotFoundException("Price not found");
    }

    await this.prisma.priceType.update({
      where: { id },
      data: {
        isActive: false,
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    this.logger.log(`Soft delete successful for PriceType ID: ${id}`);

    return {
      success: true,
      message: "Price deleted successfully",
      id,
    };
  }
}
