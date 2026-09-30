import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { BranchesService } from "./branches.service";
import { BranchDto } from "./dto/branch.dto";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { DeleteBranchResponseDto } from "./dto/delete-branch-response.dto";
import { PaginatedBranchesDto } from "./dto/paginated-branches.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";
// Using global guards - no need to import guards here
import { Permissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Branches")
@Controller("branches")
// Using global guards
@ApiBearerAuth()
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @Permissions("branch.create")
  @ApiOperation({ summary: "Create a new branch (Admin only)" })
  @ApiResponse({
    status: 201,
    description: "Branch created successfully",
    type: BranchDto,
  })
  @ApiResponse({
    status: 409,
    description: "Branch with this code already exists",
  })
  create(@Body() createBranchDto: CreateBranchDto): Promise<BranchDto> {
    return this.branchesService.create(createBranchDto);
  }

  @Get()
  @Permissions("branch.read")
  @ApiOperation({ summary: "Get all branches with pagination and search" })
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
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search by name, code, address, phone, or manager name",
  })
  @ApiResponse({
    status: 200,
    description: "Branches retrieved successfully",
    type: PaginatedBranchesDto,
  })
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("search") search?: string
  ): Promise<PaginatedBranchesDto> {
    return this.branchesService.findAll(page, limit, search);
  }

  @Get(":id")
  @Permissions("branch.read")
  @ApiOperation({ summary: "Get branch by ID" })
  @ApiResponse({
    status: 200,
    description: "Branch retrieved successfully",
    type: BranchDto,
  })
  @ApiResponse({ status: 404, description: "Branch not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<BranchDto> {
    return this.branchesService.findOne(id);
  }

  @Patch(":id")
  @Permissions("branch.update")
  @ApiOperation({ summary: "Update branch by ID (Admin only)" })
  @ApiResponse({
    status: 200,
    description: "Branch updated successfully",
    type: BranchDto,
  })
  @ApiResponse({ status: 404, description: "Branch not found" })
  @ApiResponse({ status: 409, description: "Branch code already exists" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateBranchDto: UpdateBranchDto
  ): Promise<BranchDto> {
    return this.branchesService.update(id, updateBranchDto);
  }

  @Delete(":id")
  @Permissions("branch.delete")
  @ApiOperation({ summary: "Delete branch by ID (Admin only)" })
  @ApiResponse({
    status: 200,
    description: "Branch deleted successfully",
    type: DeleteBranchResponseDto,
  })
  @ApiResponse({ status: 404, description: "Branch not found" })
  @ApiResponse({
    status: 409,
    description: "Cannot delete branch with active employees or locations",
  })
  remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DeleteBranchResponseDto> {
    return this.branchesService.remove(id);
  }
}
