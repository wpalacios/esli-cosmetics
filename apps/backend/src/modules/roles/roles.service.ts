import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RoleDto } from "./dto/role.dto";

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async create(createRoleDto: CreateRoleDto): Promise<RoleDto> {
    // Check if role key already exists (including soft-deleted)
    const existingRole = await this.prisma.role.findFirst({
      where: {
        key: createRoleDto.key,
        isDeleted: false,
      },
    });

    if (existingRole) {
      throw new ConflictException("Role with this key already exists");
    }

    const role = await this.prisma.role.create({
      data: createRoleDto,
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      permissions: role.rolePermissions.map(rp => ({
        key: rp.permission.key,
        name: rp.permission.name,
      })),
    };
  }

  async findAll(
    page: number = 1,
    limit: number = 10
  ): Promise<{ roles: RoleDto[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;

    const whereCondition = {
      isDeleted: false,
    };

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where: whereCondition,
        skip,
        take: limit,
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.role.count({
        where: whereCondition,
      }),
    ]);

    const mappedRoles = roles.map(role => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      permissions: role.rolePermissions.map(rp => ({
        key: rp.permission.key,
        name: rp.permission.name,
      })),
    }));

    return {
      roles: mappedRoles,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<RoleDto> {
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      permissions: role.rolePermissions.map(rp => ({
        key: rp.permission.key,
        name: rp.permission.name,
      })),
    };
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<RoleDto> {
    const existingRole = await this.prisma.role.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingRole) {
      throw new NotFoundException("Role not found");
    }

    const role = await this.prisma.role.update({
      where: { id },
      data: updateRoleDto,
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      permissions: role.rolePermissions.map(rp => ({
        key: rp.permission.key,
        name: rp.permission.name,
      })),
    };
  }

  async remove(id: string): Promise<{ message: string }> {
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    // Soft delete
    await this.prisma.role.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return { message: "Role deleted successfully" };
  }

  async assignPermissions(
    roleId: string,
    permissionKeys: string[]
  ): Promise<RoleDto> {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        isDeleted: false,
      },
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    // Get permissions by keys
    const permissions = await this.prisma.permission.findMany({
      where: {
        key: { in: permissionKeys },
      },
    });

    // Remove existing role permissions
    await this.prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Add new role permissions
    const rolePermissionData = permissions.map(permission => ({
      roleId,
      permissionId: permission.id,
    }));

    await this.prisma.rolePermission.createMany({
      data: rolePermissionData,
      skipDuplicates: true,
    });

    return this.findOne(roleId);
  }
}
