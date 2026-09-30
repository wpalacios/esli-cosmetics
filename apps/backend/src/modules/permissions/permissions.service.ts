import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreatePermissionDto } from "./dto/create-permission.dto";
import { UpdatePermissionDto } from "./dto/update-permission.dto";
import { PermissionDto } from "./dto/permission.dto";

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createPermissionDto: CreatePermissionDto
  ): Promise<PermissionDto> {
    // Check if permission key already exists (including soft-deleted)
    const existingPermission = await this.prisma.permission.findFirst({
      where: {
        key: createPermissionDto.key,
        isDeleted: false,
      },
    });

    if (existingPermission) {
      throw new ConflictException("Permission with this key already exists");
    }

    const permission = await this.prisma.permission.create({
      data: createPermissionDto,
    });

    return {
      id: permission.id,
      key: permission.key,
      name: permission.name,
      description: permission.description,
      createdAt: permission.createdAt,
    };
  }

  async findAll(
    page: number = 1,
    limit: number = 10
  ): Promise<{
    permissions: PermissionDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const whereCondition = {
      isDeleted: false,
    };

    const [permissions, total] = await Promise.all([
      this.prisma.permission.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.permission.count({
        where: whereCondition,
      }),
    ]);

    const mappedPermissions = permissions.map(permission => ({
      id: permission.id,
      key: permission.key,
      name: permission.name,
      description: permission.description,
      createdAt: permission.createdAt,
    }));

    return {
      permissions: mappedPermissions,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<PermissionDto> {
    const permission = await this.prisma.permission.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!permission) {
      throw new NotFoundException("Permission not found");
    }

    return {
      id: permission.id,
      key: permission.key,
      name: permission.name,
      description: permission.description,
      createdAt: permission.createdAt,
    };
  }

  async update(
    id: string,
    updatePermissionDto: UpdatePermissionDto
  ): Promise<PermissionDto> {
    const existingPermission = await this.prisma.permission.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingPermission) {
      throw new NotFoundException("Permission not found");
    }

    const permission = await this.prisma.permission.update({
      where: { id },
      data: updatePermissionDto,
    });

    return {
      id: permission.id,
      key: permission.key,
      name: permission.name,
      description: permission.description,
      createdAt: permission.createdAt,
    };
  }

  async remove(id: string): Promise<{ message: string }> {
    const permission = await this.prisma.permission.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!permission) {
      throw new NotFoundException("Permission not found");
    }

    // Soft delete
    await this.prisma.permission.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return { message: "Permission deleted successfully" };
  }
}
