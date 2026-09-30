import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  RolesParams,
} from "@/actions/roles";
import { CreateRoleRequest, UpdateRoleRequest } from "@esli-cosmetics/types";

export const ROLES_QUERY_KEY = "roles";

export function useRoles(params: RolesParams = {}, initialData?: any) {
  return useQuery({
    queryKey: [ROLES_QUERY_KEY, params],
    queryFn: () => getRoles(params),
    placeholderData: initialData,
    staleTime: 0,
  });
}

export function useRole(id: string) {
  return useQuery({
    queryKey: [ROLES_QUERY_KEY, id],
    queryFn: () => getRole(id),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoleRequest) => createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ROLES_QUERY_KEY] });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoleRequest }) =>
      updateRole(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [ROLES_QUERY_KEY] });
      queryClient.setQueryData([ROLES_QUERY_KEY, variables.id], data);
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ROLES_QUERY_KEY] });
    },
  });
}
