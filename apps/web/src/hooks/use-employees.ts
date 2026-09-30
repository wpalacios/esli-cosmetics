import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  checkEmployeeCodeExists,
  checkDocumentNumberExists,
  checkEmailExists,
} from "@/actions";
import {
  EmployeeWithRelations,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeeFilters,
} from "@esli-cosmetics/types";
import { useDebounce } from "@esli-cosmetics/utils";

// Query keys
export const employeeKeys = {
  all: ["employees"] as const,
  lists: () => [...employeeKeys.all, "list"] as const,
  list: (filters: EmployeeFilters) =>
    [...employeeKeys.lists(), filters] as const,
  details: () => [...employeeKeys.all, "detail"] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
};

// Get all employees using server action
export const useEmployees = (filters?: EmployeeFilters) => {
  return useQuery({
    queryKey: employeeKeys.list(filters || {}),
    queryFn: () => getEmployees(filters),
    staleTime: 0,
  });
};

// Get single employee using server action
export const useEmployee = (id: string) => {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => getEmployeeById(id),
    enabled: !!id,
  });
};

// Create employee mutation using server action
export const useCreateEmployee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEmployeeRequest) => createEmployee(data),
    onSuccess: () => {
      // Invalidate and refetch employees list
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
};

// Update employee mutation using server action
export const useUpdateEmployee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEmployeeRequest }) =>
      updateEmployee(id, data),
    onSuccess: updatedEmployee => {
      // Update the specific employee in cache
      queryClient.setQueryData(
        employeeKeys.detail(updatedEmployee.id),
        updatedEmployee
      );
      // Invalidate and refetch employees list
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
};

// Delete employee mutation using server action
export const useDeleteEmployee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: (_, deletedId) => {
      // Remove the employee from cache
      queryClient.removeQueries({ queryKey: employeeKeys.detail(deletedId) });
      // Invalidate and refetch employees list
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
};

// Check if employee code exists
export const useCheckEmployeeCode = (
  employeeCode: string,
  excludeId?: string
) => {
  const debouncedCode = useDebounce(employeeCode, 300);

  return useQuery({
    queryKey: [...employeeKeys.all, "check-code", debouncedCode, excludeId],
    queryFn: () => checkEmployeeCodeExists(debouncedCode, excludeId),
    enabled: !!debouncedCode && debouncedCode.trim().length > 0,
    staleTime: 0,
    gcTime: 0,
  });
};

// Check if document number exists
export const useCheckDocumentNumber = (
  docType: string,
  docNumber: string,
  excludeId?: string
) => {
  const debouncedDocType = useDebounce(docType, 300);
  const debouncedDocNumber = useDebounce(docNumber, 300);

  return useQuery({
    queryKey: [
      ...employeeKeys.all,
      "check-document",
      debouncedDocType,
      debouncedDocNumber,
      excludeId,
    ],
    queryFn: () =>
      checkDocumentNumberExists(
        debouncedDocType,
        debouncedDocNumber,
        excludeId
      ),
    enabled:
      !!debouncedDocType &&
      debouncedDocType.trim().length > 0 &&
      !!debouncedDocNumber &&
      debouncedDocNumber.trim().length > 0,
    staleTime: 0,
    gcTime: 0,
  });
};

// Check if email exists
export const useCheckEmail = (email: string, excludeId?: string) => {
  const debouncedEmail = useDebounce(email, 300);

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValidEmail = debouncedEmail ? emailRegex.test(debouncedEmail) : false;

  return useQuery({
    queryKey: [...employeeKeys.all, "check-email", debouncedEmail, excludeId],
    queryFn: () => checkEmailExists(debouncedEmail, excludeId),
    enabled:
      !!debouncedEmail && debouncedEmail.trim().length > 0 && isValidEmail,
    staleTime: 0,
    gcTime: 0,
  });
};
