import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreatePersonDto } from "./dto/create-person.dto";
import { UpdatePersonDto } from "./dto/update-person.dto";
import { PersonDto } from "./dto/person.dto";

@Injectable()
export class PeopleService {
  constructor(private prisma: PrismaService) {}

  async create(createPersonDto: CreatePersonDto): Promise<PersonDto> {
    // Check if person already exists by email if provided
    if (createPersonDto.email) {
      const existingPerson = await this.prisma.person.findFirst({
        where: {
          email: createPersonDto.email,
          isDeleted: false,
        },
      });

      if (existingPerson) {
        throw new ConflictException("Person with this email already exists");
      }
    }

    // Check if person already exists by document if provided
    if (createPersonDto.docType && createPersonDto.docNumber) {
      const existingPerson = await this.prisma.person.findFirst({
        where: {
          docType: createPersonDto.docType,
          docNumber: createPersonDto.docNumber,
          isDeleted: false,
        },
      });

      if (existingPerson) {
        throw new ConflictException("Person with this document already exists");
      }
    }

    const person = await this.prisma.person.create({
      data: {
        firstName: createPersonDto.firstName,
        lastName: createPersonDto.lastName,
        phone: createPersonDto.phone,
        email: createPersonDto.email,
        docType: createPersonDto.docType,
        docNumber: createPersonDto.docNumber,
      },
    });

    return this.mapToDto(person);
  }

  async findAll(
    page: number = 1,
    limit: number = 10
  ): Promise<{
    people: PersonDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [people, total] = await Promise.all([
      this.prisma.person.findMany({
        where: { isDeleted: false },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.person.count({
        where: { isDeleted: false },
      }),
    ]);

    return {
      people: people.map(person => this.mapToDto(person)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<PersonDto> {
    const person = await this.prisma.person.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!person) {
      throw new NotFoundException("Person not found");
    }

    return this.mapToDto(person);
  }

  async update(
    id: string,
    updatePersonDto: UpdatePersonDto
  ): Promise<PersonDto> {
    const existingPerson = await this.prisma.person.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingPerson) {
      throw new NotFoundException("Person not found");
    }

    // Check for email conflict if email is being updated
    if (
      updatePersonDto.email &&
      updatePersonDto.email !== existingPerson.email
    ) {
      const emailConflict = await this.prisma.person.findFirst({
        where: {
          email: updatePersonDto.email,
          isDeleted: false,
        },
      });

      if (emailConflict) {
        throw new ConflictException("Person with this email already exists");
      }
    }

    // Check for document conflict if document is being updated
    if (updatePersonDto.docType && updatePersonDto.docNumber) {
      const docConflict = await this.prisma.person.findFirst({
        where: {
          docType: updatePersonDto.docType,
          docNumber: updatePersonDto.docNumber,
          isDeleted: false,
          id: { not: id },
        },
      });

      if (docConflict) {
        throw new ConflictException("Person with this document already exists");
      }
    }

    const person = await this.prisma.person.update({
      where: { id },
      data: {
        firstName: updatePersonDto.firstName,
        lastName: updatePersonDto.lastName,
        phone: updatePersonDto.phone,
        email: updatePersonDto.email,
        docType: updatePersonDto.docType,
        docNumber: updatePersonDto.docNumber,
        updatedAt: new Date(),
      },
    });

    return this.mapToDto(person);
  }

  async remove(id: string): Promise<{ message: string }> {
    const person = await this.prisma.person.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!person) {
      throw new NotFoundException("Person not found");
    }

    await this.prisma.person.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return { message: "Person deleted successfully" };
  }

  private mapToDto(person: any): PersonDto {
    return {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      phone: person.phone,
      email: person.email,
      docType: person.docType,
      docNumber: person.docNumber,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    };
  }
}
