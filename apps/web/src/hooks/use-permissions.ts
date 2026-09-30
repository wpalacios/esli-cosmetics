import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPermissions,
  getPermission,
  createPermission,
  updatePermission,
  deletePermission,
  PermissionsParams,
} from "@/actions/permissions";
import {
  CreatePermissionRequest,
  UpdatePermissionRequest,
} from "@esli-cosmetics/types";

export const PERMISSIONS_QUERY_KEY = "permissions";

export function usePermissions(
  params: PermissionsParams = {},
  initialData?: any
) {
  return useQuery({
    queryKey: [PERMISSIONS_QUERY_KEY, params],
    queryFn: () => getPermissions(params),
    placeholderData: initialData,
    staleTime: 0,
  });
}

export function usePermission(id: string) {
  return useQuery({
    queryKey: [PERMISSIONS_QUERY_KEY, id],
    queryFn: () => getPermission(id),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useCreatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePermissionRequest) => createPermission(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY_KEY] });
    },
  });
}

export function useUpdatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePermissionRequest }) =>
      updatePermission(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY_KEY] });
      queryClient.setQueryData([PERMISSIONS_QUERY_KEY, variables.id], data);
    },
  });
}

export function useDeletePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePermission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY_KEY] });
    },
  });
}
