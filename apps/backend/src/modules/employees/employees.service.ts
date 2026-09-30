import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { EmployeeDto } from "./dto/employee.dto";

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async create(createEmployeeDto: CreateEmployeeDto): Promise<EmployeeDto> {
    return await this.prisma.$transaction(async tx => {
      // Check if person already exists by email if provided
      if (createEmployeeDto.email) {
        const existingPerson = await tx.person.findFirst({
          where: {
            email: createEmployeeDto.email,
            isDeleted: false,
          },
        });

        if (existingPerson) {
          throw new ConflictException("Person with this email already exists");
        }
      }

      // Check if person already exists by document if provided
      if (createEmployeeDto.docType && createEmployeeDto.docNumber) {
        const existingPerson = await tx.person.findFirst({
          where: {
            docType: createEmployeeDto.docType,
            docNumber: createEmployeeDto.docNumber,
            isDeleted: false,
          },
        });

        if (existingPerson) {
          throw new ConflictException(
            "Person with this document already exists"
          );
        }
      }

      // Check if employee code already exists
      if (createEmployeeDto.employeeCode) {
        const existingEmployee = await tx.employee.findFirst({
          where: {
            employeeCode: createEmployeeDto.employeeCode,
            isDeleted: false,
          },
        });

        if (existingEmployee) {
          throw new ConflictException("Employee with this code already exists");
        }
      }

      // Check if user exists and is not already assigned to another employee
      if (createEmployeeDto.userId) {
        const existingEmployeeWithUser = await tx.employee.findFirst({
          where: {
            userId: createEmployeeDto.userId,
            isDeleted: false,
          },
        });

        if (existingEmployeeWithUser) {
          throw new ConflictException(
            "User is already assigned to another employee"
          );
        }
      }

      // Create person record first
      const person = await tx.person.create({
        data: {
          firstName: createEmployeeDto.firstName,
          lastName: createEmployeeDto.lastName,
          phone: createEmployeeDto.phone,
          email: createEmployeeDto.email,
          docType: createEmployeeDto.docType,
          docNumber: createEmployeeDto.docNumber,
        },
      });

      // Create employee record
      const employee = await tx.employee.create({
        data: {
          personId: person.id,
          userId: createEmployeeDto.userId,
          employeeCode: createEmployeeDto.employeeCode,
          roleTitle: createEmployeeDto.roleTitle,
          locationId: createEmployeeDto.locationId,
          isActive: createEmployeeDto.isActive ?? true,
          hiredAt: createEmployeeDto.hiredAt
            ? new Date(createEmployeeDto.hiredAt)
            : null,
        },
        include: {
          person: true,
          user: true,
          location: {
            include: {
              branch: true,
            },
          },
        },
      });

      return this.mapToDto(employee);
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<{
    employees: EmployeeDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    // Build search conditions
    const searchConditions = search
      ? {
          OR: [
            {
              person: {
                firstName: { contains: search, mode: "insensitive" as const },
              },
            },
            {
              person: {
                lastName: { contains: search, mode: "insensitive" as const },
              },
            },
            {
              person: {
                email: { contains: search, mode: "insensitive" as const },
              },
            },
            {
              person: {
                phone: { contains: search, mode: "insensitive" as const },
              },
            },
            {
              person: {
                docType: { contains: search, mode: "insensitive" as const },
              },
            },
            {
              person: {
                docNumber: { contains: search, mode: "insensitive" as const },
              },
            },
            {
              employeeCode: { contains: search, mode: "insensitive" as const },
            },
            { roleTitle: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const whereCondition = {
      isDeleted: false,
      ...searchConditions,
    };

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where: whereCondition,
        skip,
        take: limit,
        include: {
          person: true,
          user: true,
          location: {
            include: {
              branch: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.employee.count({
        where: whereCondition,
      }),
    ]);

    return {
      employees: employees.map(employee => this.mapToDto(employee)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<EmployeeDto> {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        person: true,
        user: true,
        location: {
          include: {
            branch: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    return this.mapToDto(employee);
  }

  async update(
    id: string,
    updateEmployeeDto: UpdateEmployeeDto
  ): Promise<EmployeeDto> {
    return await this.prisma.$transaction(async tx => {
      const existingEmployee = await tx.employee.findFirst({
        where: {
          id,
          isDeleted: false,
        },
        include: {
          person: true,
        },
      });

      if (!existingEmployee) {
        throw new NotFoundException("Employee not found");
      }

      // Check for email conflict if email is being updated
      if (
        updateEmployeeDto.email &&
        updateEmployeeDto.email !== existingEmployee.person.email
      ) {
        const emailConflict = await tx.person.findFirst({
          where: {
            email: updateEmployeeDto.email,
            isDeleted: false,
            id: { not: existingEmployee.personId },
          },
        });

        if (emailConflict) {
          throw new ConflictException("Person with this email already exists");
        }
      }

      // Check for document conflict if document is being updated
      if (updateEmployeeDto.docType && updateEmployeeDto.docNumber) {
        const docConflict = await tx.person.findFirst({
          where: {
            docType: updateEmployeeDto.docType,
            docNumber: updateEmployeeDto.docNumber,
            isDeleted: false,
            id: { not: existingEmployee.personId },
          },
        });

        if (docConflict) {
          throw new ConflictException(
            "Person with this document already exists"
          );
        }
      }

      // Check for employee code conflict if code is being updated
      if (
        updateEmployeeDto.employeeCode &&
        updateEmployeeDto.employeeCode !== existingEmployee.employeeCode
      ) {
        const codeConflict = await tx.employee.findFirst({
          where: {
            employeeCode: updateEmployeeDto.employeeCode,
            isDeleted: false,
            id: { not: id },
          },
        });

        if (codeConflict) {
          throw new ConflictException("Employee with this code already exists");
        }
      }

      // Check for user conflict if user is being updated
      if (
        updateEmployeeDto.userId &&
        updateEmployeeDto.userId !== existingEmployee.userId
      ) {
        const userConflict = await tx.employee.findFirst({
          where: {
            userId: updateEmployeeDto.userId,
            isDeleted: false,
            id: { not: id },
          },
        });

        if (userConflict) {
          throw new ConflictException(
            "User is already assigned to another employee"
          );
        }
      }

      // Update person record
      await tx.person.update({
        where: { id: existingEmployee.personId },
        data: {
          firstName:
            updateEmployeeDto.firstName ?? existingEmployee.person.firstName,
          lastName:
            updateEmployeeDto.lastName ?? existingEmployee.person.lastName,
          phone: updateEmployeeDto.phone ?? existingEmployee.person.phone,
          email: updateEmployeeDto.email ?? existingEmployee.person.email,
          docType: updateEmployeeDto.docType ?? existingEmployee.person.docType,
          docNumber:
            updateEmployeeDto.docNumber ?? existingEmployee.person.docNumber,
          updatedAt: new Date(),
        },
      });

      // Update employee record
      const employee = await tx.employee.update({
        where: { id },
        data: {
          userId: updateEmployeeDto.userId ?? existingEmployee.userId,
          employeeCode:
            updateEmployeeDto.employeeCode ?? existingEmployee.employeeCode,
          roleTitle: updateEmployeeDto.roleTitle ?? existingEmployee.roleTitle,
          locationId:
            updateEmployeeDto.locationId ?? existingEmployee.locationId,
          isActive: updateEmployeeDto.isActive ?? existingEmployee.isActive,
          hiredAt: updateEmployeeDto.hiredAt
            ? new Date(updateEmployeeDto.hiredAt)
            : existingEmployee.hiredAt,
          updatedAt: new Date(),
        },
        include: {
          person: true,
          user: true,
          location: {
            include: {
              branch: true,
            },
          },
        },
      });

      return this.mapToDto(employee);
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    return await this.prisma.$transaction(async tx => {
      const employee = await tx.employee.findFirst({
        where: {
          id,
          isDeleted: false,
        },
      });

      if (!employee) {
        throw new NotFoundException("Employee not found");
      }

      const deletedAt = new Date();

      // Soft delete the employee
      await tx.employee.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt,
        },
      });

      // Check if person is used by other employees or customers
      const personUsedElsewhere =
        (await tx.employee.findFirst({
          where: {
            personId: employee.personId,
            id: { not: id },
            isDeleted: false,
          },
        })) ||
        (await tx.customer.findFirst({
          where: {
            personId: employee.personId,
            isDeleted: false,
          },
        }));

      // Soft delete person if not used elsewhere
      if (!personUsedElsewhere) {
        await tx.person.update({
          where: { id: employee.personId },
          data: {
            isDeleted: true,
            deletedAt,
          },
        });
      }

      // Soft delete user if exists and not used elsewhere
      if (employee.userId) {
        const userUsedElsewhere =
          (await tx.employee.findFirst({
            where: {
              userId: employee.userId,
              id: { not: id },
              isDeleted: false,
            },
          })) ||
          (await tx.customer.findFirst({
            where: {
              userId: employee.userId,
              isDeleted: false,
            },
          }));

        if (!userUsedElsewhere) {
          await tx.user.update({
            where: { id: employee.userId },
            data: {
              isDeleted: true,
              deletedAt,
            },
          });
        }
      }

      return { message: "Employee deleted successfully" };
    });
  }

  private mapToDto(employee: any): EmployeeDto {
    return {
      id: employee.id,
      personId: employee.personId,
      userId: employee.userId,
      employeeCode: employee.employeeCode,
      roleTitle: employee.roleTitle,
      locationId: employee.locationId,
      isActive: employee.isActive,
      hiredAt: employee.hiredAt,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
      person: employee.person
        ? {
            id: employee.person.id,
            firstName: employee.person.firstName,
            lastName: employee.person.lastName,
            phone: employee.person.phone,
            email: employee.person.email,
            docType: employee.person.docType,
            docNumber: employee.person.docNumber,
          }
        : undefined,
      user: employee.user
        ? {
            id: employee.user.id,
            email: employee.user.email,
            isActive: employee.user.isActive,
          }
        : undefined,
      location: employee.location
        ? {
            id: employee.location.id,
            name: employee.location.name,
            locationType: employee.location.locationType,
            branchId: employee.location.branchId,
            branch: employee.location.branch
              ? {
                  id: employee.location.branch.id,
                  name: employee.location.branch.name,
                  code: employee.location.branch.code,
                }
              : undefined,
          }
        : undefined,
    };
  }

  async checkEmployeeCodeExists(
    employeeCode: string,
    excludeId?: string
  ): Promise<boolean> {
    if (!employeeCode || employeeCode.trim() === "") {
      return false;
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        employeeCode: {
          equals: employeeCode.trim(),
          mode: "insensitive",
        },
        isDeleted: false,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return !!employee;
  }

  async checkDocumentNumberExists(
    docType: string,
    docNumber: string,
    excludeEmployeeId?: string
  ): Promise<boolean> {
    if (
      !docType ||
      !docNumber ||
      docType.trim() === "" ||
      docNumber.trim() === ""
    ) {
      return false;
    }

    // If excludeEmployeeId is provided, get the personId to exclude
    let excludePersonId: string | undefined;
    if (excludeEmployeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: excludeEmployeeId },
        select: { personId: true },
      });
      if (employee) {
        excludePersonId = employee.personId;
      }
    }

    const person = await this.prisma.person.findFirst({
      where: {
        docType: docType.trim(),
        docNumber: docNumber.trim(),
        isDeleted: false,
        ...(excludePersonId && { id: { not: excludePersonId } }),
      },
    });
    return !!person;
  }

  async checkEmailExists(
    email: string,
    excludeEmployeeId?: string
  ): Promise<boolean> {
    if (!email || email.trim() === "") {
      return false;
    }

    // If excludeEmployeeId is provided, get the personId to exclude
    let excludePersonId: string | undefined;
    if (excludeEmployeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: excludeEmployeeId },
        select: { personId: true },
      });
      if (employee) {
        excludePersonId = employee.personId;
      }
    }

    const person = await this.prisma.person.findFirst({
      where: {
        email: {
          equals: email.trim(),
          mode: "insensitive",
        },
        isDeleted: false,
        ...(excludePersonId && { id: { not: excludePersonId } }),
      },
    });
    return !!person;
  }
}
