import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { PeopleService } from "./people.service";
import { CreatePersonDto } from "./dto/create-person.dto";
import { UpdatePersonDto } from "./dto/update-person.dto";
import { PersonDto } from "./dto/person.dto";
import { PaginatedPeopleDto } from "./dto/paginated-people.dto";
import { DeletePersonResponseDto } from "./dto/delete-person-response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";

@ApiTags("People")
@Controller("people")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Post()
  @Permissions("people.create")
  @ApiOperation({ summary: "Create a new person" })
  @ApiResponse({
    status: 201,
    description: "Person created successfully",
    type: PersonDto,
  })
  @ApiResponse({
    status: 409,
    description: "Person with this email or document already exists",
  })
  create(@Body() createPersonDto: CreatePersonDto): Promise<PersonDto> {
    return this.peopleService.create(createPersonDto);
  }

  @Get()
  @Permissions("people.read")
  @ApiOperation({ summary: "Get all people with pagination" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 10)",
  })
  @ApiResponse({
    status: 200,
    description: "People retrieved successfully",
    type: PaginatedPeopleDto,
  })
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number
  ): Promise<PaginatedPeopleDto> {
    return this.peopleService.findAll(page, limit);
  }

  @Get(":id")
  @Permissions("people.read")
  @ApiOperation({ summary: "Get person by ID" })
  @ApiResponse({
    status: 200,
    description: "Person retrieved successfully",
    type: PersonDto,
  })
  @ApiResponse({ status: 404, description: "Person not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<PersonDto> {
    return this.peopleService.findOne(id);
  }

  @Patch(":id")
  @Permissions("people.update")
  @ApiOperation({ summary: "Update person by ID" })
  @ApiResponse({
    status: 200,
    description: "Person updated successfully",
    type: PersonDto,
  })
  @ApiResponse({ status: 404, description: "Person not found" })
  @ApiResponse({ status: 409, description: "Email or document already exists" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updatePersonDto: UpdatePersonDto
  ): Promise<PersonDto> {
    return this.peopleService.update(id, updatePersonDto);
  }

  @Delete(":id")
  @Permissions("people.delete")
  @ApiOperation({ summary: "Delete person by ID" })
  @ApiResponse({
    status: 200,
    description: "Person deleted successfully",
    type: DeletePersonResponseDto,
  })
  @ApiResponse({ status: 404, description: "Person not found" })
  remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DeletePersonResponseDto> {
    return this.peopleService.remove(id);
  }
}
