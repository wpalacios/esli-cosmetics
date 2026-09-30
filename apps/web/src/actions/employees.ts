"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  EmployeeWithRelations,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeesResponse,
  EmployeeFilters,
} from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

export async function getEmployees(
  params: EmployeeFilters = {}
): Promise<EmployeesResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.search) searchParams.set("search", params.search);
    if (params.locationId) searchParams.set("locationId", params.locationId);
    if (params.isActive !== undefined)
      searchParams.set("isActive", params.isActive.toString());
    if (params.roleTitle) searchParams.set("roleTitle", params.roleTitle);

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/employees?${queryString}` : "/employees";


    const response = await apiClient.get(endpoint);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error fetching employees:", error);
    throw new Error("Failed to fetch employees");
  }
}

export async function getEmployeeById(
  id: string
): Promise<EmployeeWithRelations> {
  try {

    const response = await apiClient.get(`/employees/${id}`);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error fetching employee:", error);
    throw new Error("Failed to fetch employee");
  }
}

export async function createEmployee(
  data: CreateEmployeeRequest
): Promise<EmployeeWithRelations> {
  try {

    const response = await apiClient.post("/employees", data);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error creating employee:", error);
    throw new Error("Failed to create employee");
  }
}

export async function updateEmployee(
  id: string,
  data: UpdateEmployeeRequest
): Promise<EmployeeWithRelations> {
  try {

    const response = await apiClient.patch(`/employees/${id}`, data);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error updating employee:", error);
    throw new Error("Failed to update employee");
  }
}

export async function checkEmployeeCodeExists(
  employeeCode: string,
  excludeId?: string
): Promise<boolean> {
  try {

    const searchParams = new URLSearchParams({ employeeCode });
    if (excludeId) {
      searchParams.set("excludeId", excludeId);
    }

    const response: { exists: boolean } = await apiClient.get(
      `/employees/check-code?${searchParams.toString()}`
    );


    return response.exists;
  } catch (error) {
    console.error("❌ Server Action - Error checking employee code:", error);
    return false;
  }
}

export async function checkDocumentNumberExists(
  docType: string,
  docNumber: string,
  excludeId?: string
): Promise<boolean> {
  try {

    const searchParams = new URLSearchParams({ docType, docNumber });
    if (excludeId) {
      searchParams.set("excludeId", excludeId);
    }

    const response: { exists: boolean } = await apiClient.get(
      `/employees/check-document?${searchParams.toString()}`
    );


    return response.exists;
  } catch (error) {
    console.error("❌ Server Action - Error checking document number:", error);
    return false;
  }
}

export async function checkEmailExists(
  email: string,
  excludeId?: string
): Promise<boolean> {
  try {

    const searchParams = new URLSearchParams({ email });
    if (excludeId) {
      searchParams.set("excludeId", excludeId);
    }

    const response: { exists: boolean } = await apiClient.get(
      `/employees/check-email?${searchParams.toString()}`
    );


    return response.exists;
  } catch (error) {
    console.error("❌ Server Action - Error checking email:", error);
    return false;
  }
}

export async function deleteEmployee(id: string): Promise<void> {
  try {

    await apiClient.delete(`/employees/${id}`);

  } catch (error) {
    console.error("❌ Server Action - Error deleting employee:", error);
    throw new Error("Failed to delete employee");
  }
}
