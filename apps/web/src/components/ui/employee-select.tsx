"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmployeeWithRelations } from "@esli-cosmetics/types";
import { getEmployees } from "@/actions";
import { employeeKeys } from "@/hooks/use-employees";
import { SearchableSelect, SearchableSelectOption } from "@esli-cosmetics/ui";
import type { EmployeeFilters } from "@esli-cosmetics/types";

interface EmployeeSelectProps {
  value?: string | undefined;
  onChange: (
    employeeId: string | undefined,
    employee?: EmployeeWithRelations
  ) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
  currentUserId?: string; // When editing a user, pass the user ID to allow showing their linked employee
  currentEmployee?: EmployeeWithRelations | undefined; // Pass the current employee to ensure it's in the list
  searchPlaceholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  locationId?: string; // Optional location filter
}

export function EmployeeSelect({
  value,
  onChange,
  placeholder = "Buscar empleado...",
  disabled = false,
  className,
  error,
  currentEmployee,
  searchPlaceholder = "Search employees...",
  emptyMessage = "No employees found",
  loadingMessage = "Loading employees...",
  locationId,
}: EmployeeSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");

  // Fetch employees with search support - reduced limit for faster initial load
  const filters: EmployeeFilters = {
    page: 1,
    limit: 50, // Reduced from 200 to 50 for faster loading
    ...(activeSearchTerm && { search: activeSearchTerm }),
    ...(locationId && { locationId }),
  };

  // Handle search - trigger on Enter key
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  };

  const handleSearchTrigger = () => {
    setActiveSearchTerm(searchTerm);
  };

  const { data: employeesData, isLoading } = useQuery({
    queryKey: employeeKeys.list(filters),
    queryFn: () => getEmployees(filters),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to avoid refetching
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  const employees = employeesData?.employees || [];

  // Convert employees to select options
  const employeeOptions: SearchableSelectOption<EmployeeWithRelations>[] =
    useMemo(() => {
      let employeesList = [...employees];

      // Ensure the current employee is always in the list when editing
      // Add it if we have a currentEmployee (either from value match or passed prop)
      if (currentEmployee) {
        const employeeExists = employeesList.some(
          emp => emp.id === currentEmployee.id
        );
        if (!employeeExists) {
          // Add the current employee to the beginning of the list
          employeesList.unshift(currentEmployee);
        }
      }

      return employeesList.map(employee => ({
        value: employee.id,
        label:
          `${employee.person?.firstName || ""} ${employee.person?.lastName || ""}`.trim() ||
          employee.employeeCode ||
          "Unknown Employee",
        data: employee,
      }));
    }, [employees, currentEmployee]);

  // Custom render for employee options with employee code
  const renderEmployeeOption = (
    option: SearchableSelectOption<EmployeeWithRelations>
  ) => {
    const employee = option.data;
    return (
      <div className="flex flex-col">
        <span className="font-medium">
          {employee?.person?.firstName} {employee?.person?.lastName}
        </span>
        {employee?.employeeCode && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {employee.employeeCode}
          </span>
        )}
      </div>
    );
  };

  const handleValueChange = (newValue: string | undefined) => {
    const selectedOption = employeeOptions.find(opt => opt.value === newValue);
    onChange(newValue, selectedOption?.data);
  };

  return (
    <SearchableSelect<EmployeeWithRelations>
      options={employeeOptions}
      {...(value ? { value } : {})}
      onValueChange={handleValueChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      disabled={disabled}
      {...(className ? { className } : {})}
      {...(error ? { error } : {})}
      onSearchChange={handleSearchChange}
      onSearchTrigger={handleSearchTrigger}
      isLoading={isLoading}
      loadingMessage={loadingMessage}
      renderOption={renderEmployeeOption}
    />
  );
}
