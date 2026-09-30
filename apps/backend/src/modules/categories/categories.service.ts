import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "src/common/prisma/prisma.service";
import { CategoryDto } from "./dto/category.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import slugify from "slugify";
import { PaginatedCategoryDto } from "./dto/paginated-category.dto";
import { DeleteCategoryResponseDto } from "./dto/delete-category.dto";

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<CategoryDto> {
    const { parentId, ...rest } = createCategoryDto;
    // Check if category name already exists among active categories
    const existingCategories = await this.prisma.category.findMany({
      where: {
        name: {
          equals: rest.name,
          mode: "insensitive",
        },
      },
    });

    if (existingCategories.filter(x => !x.isDeleted)?.length > 0) {
      throw new ConflictException("Category with this name already exists");
    }

    if (!rest.slug || rest.slug.trim() === "") {
      rest.slug = slugify(`${rest.name}-${existingCategories.length + 1}`, {
        lower: true,
      });
    }

    try {
      const category = await this.prisma.category.create({
        data: {
          ...rest,
          isActive: true,
          isDeleted: false,
          parentId: parentId,
        },
        include: {
          parent: true, // To include parent category details
        },
      });

      const categoryDto: CategoryDto = {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        parent: category.parent,
        parentId: category.parentId,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      };

      return categoryDto;
    } catch (error) {
      console.error("🔥 Prisma Error:", error);
      throw new InternalServerErrorException("Failed to create category");
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedCategoryDto> {
    const skip = (page - 1) * limit;
    const whereClause = {
      isDeleted: false,
    };

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { parent: true }, // Include parent category details
      }),
      this.prisma.category.count({
        where: whereClause,
      }),
    ]);

    const mappedCategories = categories.map(category => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parent: category.parent,
      parentId: category.parentId,
      isActive: category.isActive,
      isDeleted: category.isDeleted,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data: mappedCategories,
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

  async searchByName(
    name: string,
    page = 1,
    limit = 10
  ): Promise<PaginatedCategoryDto> {
    const skip = (page - 1) * limit;

    const trimmedName = name.trim();

    // 1. Build dynamic where clause
    const whereClause = {
      isDeleted: false,
      ...(trimmedName !== ""
        ? {
            name: {
              contains: trimmedName,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    // 2. Execute the query with pagination and count total matching records
    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        include: { parent: true },
        skip,
        take: limit,
      }),
      this.prisma.category.count({
        where: whereClause,
      }),
    ]);

    const mappedCategories = categories.map(category => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parent: category.parent,
      parentId: category.parentId,
      isActive: category.isActive,
      isDeleted: category.isDeleted,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data: mappedCategories,
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

  async findOne(id: string): Promise<CategoryDto> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { parent: true }, // Include parent category details
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parent: category.parent
        ? {
            id: category.parent.id,
            name: category.parent.name,
            slug: category.parent.slug,
          }
        : null,
      parentId: category.parentId,
      isActive: category.isActive,
      isDeleted: category.isDeleted,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto
  ): Promise<CategoryDto> {
    const existingCategory = await this.prisma.category.findUnique({
      where: { id },
      include: { parent: true },
    });

    if (!existingCategory) {
      throw new NotFoundException("Category not found");
    }

    // Check if category name already exists among active categories
    const existingCategories = await this.prisma.category.findMany({
      where: {
        name: {
          equals: updateCategoryDto.name,
          mode: "insensitive",
        },
        id: { not: id },
      },
    });

    if (existingCategories.filter(x => !x.isDeleted)?.length > 0) {
      throw new ConflictException("Category with this name already exists");
    }

    const { parentId, name, description, isActive } = updateCategoryDto;

    const slug = slugify(`${name}-${existingCategories.length + 1}`, {
      lower: true,
    });

    const category = await this.prisma.category.update({
      where: { id },
      data: {
        name: name,
        slug,
        description: description,
        isActive: isActive,
        parentId: parentId,
      },
    });

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      isActive: category.isActive,
      isDeleted: category.isDeleted,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  // Check if category name exists
  async checkNameExists(name: string, excludeId?: string): Promise<boolean> {
    const category = await this.prisma.category.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
        isDeleted: false,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return !!category;
  }

  // Soft delete implementation
  async remove(id: string): Promise<DeleteCategoryResponseDto> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException("Category not found");
    }
    await this.prisma.category.update({
      where: { id },
      data: {
        isDeleted: true,
        isActive: false,
        deletedAt: new Date(),
      },
    });
    return {
      success: true,
      message: "Category deleted successfully",
      id,
    };
  }
}
