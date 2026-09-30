import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UserDto } from "../users/dto/user.dto";
import * as bcrypt from "bcrypt";

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isDeleted: false,
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const person = await this.prisma.person.findFirst({
      where: { email: user.email },
    });

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      roles: this.extractRoles(user),
      permissions: this.extractPermissions(user),
      person: person
        ? {
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
            phone: person.phone,
            email: person.email,
          }
        : undefined,
    };
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto
  ): Promise<UserDto> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isDeleted: false,
      },
    });

    if (!existingUser) {
      throw new NotFoundException("User not found");
    }

    // Check for email conflict if email is being updated
    if (
      updateProfileDto.email &&
      updateProfileDto.email !== existingUser.email
    ) {
      const emailConflict = await this.prisma.user.findFirst({
        where: {
          email: updateProfileDto.email,
          isDeleted: false,
        },
      });

      if (emailConflict) {
        throw new ConflictException("User with this email already exists");
      }
    }

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (updateProfileDto.password) {
      hashedPassword = await bcrypt.hash(updateProfileDto.password, 10);
    }

    // Update user (only email and password - no isActive or roles)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(updateProfileDto.email && { email: updateProfileDto.email }),
        ...(hashedPassword && { password: hashedPassword }),
      },
    });

    // Update associated person if needed
    if (
      updateProfileDto.firstName ||
      updateProfileDto.lastName ||
      updateProfileDto.phone ||
      updateProfileDto.email
    ) {
      const person = await this.prisma.person.findFirst({
        where: { email: existingUser.email },
      });

      if (person) {
        await this.prisma.person.update({
          where: { id: person.id },
          data: {
            ...(updateProfileDto.firstName && {
              firstName: updateProfileDto.firstName,
            }),
            ...(updateProfileDto.lastName !== undefined && {
              lastName: updateProfileDto.lastName,
            }),
            ...(updateProfileDto.phone !== undefined && {
              phone: updateProfileDto.phone,
            }),
            ...(updateProfileDto.email && { email: updateProfileDto.email }),
          },
        });
      }
    }

    return this.getProfile(userId);
  }

  private extractRoles(user: any): Array<{ key: string; name: string }> {
    return (
      user.userRoles?.map((userRole: any) => ({
        key: userRole.role.key,
        name: userRole.role.name,
      })) || []
    );
  }

  private extractPermissions(user: any): string[] {
    const permissions = new Set<string>();

    user.userRoles?.forEach((userRole: any) => {
      userRole.role.rolePermissions?.forEach((rolePermission: any) => {
        permissions.add(rolePermission.permission.key);
      });
    });

    return Array.from(permissions);
  }
}
