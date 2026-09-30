import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserDto } from "./dto/user.dto";
import { v4 as uuidv4 } from "uuid";
import * as bcrypt from "bcrypt";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<UserDto> {
    // Check if user already exists (including soft-deleted)
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: createUserDto.email,
        isDeleted: false,
      },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (createUserDto.password) {
      hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    }

    // Create user record
    const userId = uuidv4();
    const user = await this.prisma.user.create({
      data: {
        id: userId,
        email: createUserDto.email,
        password: hashedPassword,
        isActive: createUserDto.isActive ?? true,
      },
    });

    // Assign roles if provided
    if (createUserDto.roleKeys && createUserDto.roleKeys.length > 0) {
      const roles = await this.prisma.role.findMany({
        where: {
          key: { in: createUserDto.roleKeys },
        },
      });

      const userRoleData = roles.map(role => ({
        userId: user.id,
        roleId: role.id,
      }));

      await this.prisma.userRole.createMany({
        data: userRoleData,
      });
    }

    // Link employee if provided
    if (createUserDto.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: {
          id: createUserDto.employeeId,
          isDeleted: false,
        },
      });

      if (!employee) {
        throw new NotFoundException("Employee not found");
      }

      // Check if employee is already linked to another user
      if (employee.userId && employee.userId !== user.id) {
        throw new ConflictException(
          "Employee is already linked to another user"
        );
      }

      // Link employee to user
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { userId: user.id },
      });
    }

    return this.findOne(user.id);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<{ users: UserDto[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;

    // Build search conditions
    // User and Person are linked by email, so we need to search both
    let userEmails: string[] = [];
    if (search) {
      // First, search persons to find matching emails
      const matchingPersons = await this.prisma.person.findMany({
        where: {
          isDeleted: false,
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        },
        select: { email: true },
      });
      userEmails = matchingPersons
        .map(p => p.email)
        .filter(Boolean) as string[];
    }

    const whereCondition: any = {
      isDeleted: false,
    };

    if (search) {
      whereCondition.OR = [
        { email: { contains: search, mode: "insensitive" as const } },
      ];
      // If we found matching person emails, include them in the search
      if (userEmails.length > 0) {
        whereCondition.OR.push({ email: { in: userEmails } });
      }
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereCondition,
        skip,
        take: limit,
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
          employees: {
            where: {
              isDeleted: false,
            },
            include: {
              person: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count({
        where: whereCondition,
      }),
    ]);

    // Batch fetch all persons in a single query to avoid connection pool exhaustion
    const emailsToFetch = users.map(user => user.email);
    const persons = await this.prisma.person.findMany({
      where: {
        email: { in: emailsToFetch },
        isDeleted: false,
      },
    });

    // Create a map for O(1) lookup
    const personMap = new Map(persons.map(person => [person.email, person]));

    const mappedUsers = users.map(user => {
      const person = personMap.get(user.email);

      // Get the first employee (users typically have one employee)
      const employee =
        user.employees && user.employees.length > 0 ? user.employees[0] : null;

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
        employee: employee
          ? {
              id: employee.id,
              employeeCode: employee.employeeCode,
              roleTitle: employee.roleTitle,
              person:
                employee.person && !employee.person.isDeleted
                  ? {
                      id: employee.person.id,
                      firstName: employee.person.firstName,
                      lastName: employee.person.lastName,
                      phone: employee.person.phone,
                      email: employee.person.email,
                    }
                  : undefined,
            }
          : undefined,
      };
    });

    return {
      users: mappedUsers,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
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
        employees: {
          where: {
            isDeleted: false,
          },
          include: {
            person: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const person = await this.prisma.person.findFirst({
      where: {
        email: user.email,
        isDeleted: false,
      },
    });

    // Get the first employee (users typically have one employee)
    const employee =
      user.employees && user.employees.length > 0 ? user.employees[0] : null;

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
      employee: employee
        ? {
            id: employee.id,
            employeeCode: employee.employeeCode,
            roleTitle: employee.roleTitle,
            person:
              employee.person && !employee.person.isDeleted
                ? {
                    id: employee.person.id,
                    firstName: employee.person.firstName,
                    lastName: employee.person.lastName,
                    phone: employee.person.phone,
                    email: employee.person.email,
                  }
                : undefined,
          }
        : undefined,
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserDto> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingUser) {
      throw new NotFoundException("User not found");
    }

    // Check for email conflict if email is being updated
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailConflict = await this.prisma.user.findFirst({
        where: {
          email: updateUserDto.email,
          isDeleted: false,
        },
      });

      if (emailConflict) {
        throw new ConflictException("User with this email already exists");
      }
    }

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (updateUserDto.password) {
      hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Update user
    await this.prisma.user.update({
      where: { id },
      data: {
        email: updateUserDto.email,
        isActive: updateUserDto.isActive,
        ...(hashedPassword && { password: hashedPassword }),
      },
    });

    // Update roles if provided
    if (updateUserDto.roleKeys) {
      // Remove existing roles
      await this.prisma.userRole.deleteMany({
        where: { userId: id },
      });

      // Add new roles
      if (updateUserDto.roleKeys.length > 0) {
        const roles = await this.prisma.role.findMany({
          where: {
            key: { in: updateUserDto.roleKeys },
          },
        });

        const userRoleData = roles.map(role => ({
          userId: id,
          roleId: role.id,
        }));

        await this.prisma.userRole.createMany({
          data: userRoleData,
        });
      }
    }

    // Handle employee linking/unlinking
    if (updateUserDto.employeeId !== undefined) {
      // First, unlink any existing employees linked to this user
      await this.prisma.employee.updateMany({
        where: {
          userId: id,
          isDeleted: false,
        },
        data: {
          userId: null,
        },
      });

      // If a new employeeId is provided (not null, not empty string), link it to this user
      if (
        updateUserDto.employeeId &&
        typeof updateUserDto.employeeId === "string" &&
        updateUserDto.employeeId.trim() !== ""
      ) {
        const employee = await this.prisma.employee.findFirst({
          where: {
            id: updateUserDto.employeeId,
            isDeleted: false,
          },
        });

        if (!employee) {
          throw new NotFoundException("Employee not found");
        }

        // Check if employee is already linked to another user
        if (employee.userId && employee.userId !== id) {
          throw new ConflictException(
            "Employee is already linked to another user"
          );
        }

        // Link employee to user
        await this.prisma.employee.update({
          where: { id: employee.id },
          data: { userId: id },
        });
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Soft delete
    await this.prisma.user.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return { message: "User deleted successfully" };
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

    user.userRoles?.forEach(userRole => {
      userRole.role.rolePermissions?.forEach(rolePermission => {
        permissions.add(rolePermission.permission.key);
      });
    });

    return Array.from(permissions);
  }
}
