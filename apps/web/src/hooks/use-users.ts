import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  UsersParams,
} from "@/actions/users";
import {
  CreateUserRequest,
  UpdateUserRequest,
  UsersResponse,
} from "@esli-cosmetics/types";

export const USERS_QUERY_KEY = "users";

export function useUsers(params: UsersParams = {}, initialData?: any) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, params],
    queryFn: async (): Promise<UsersResponse> => {
      try {
        const result = await getUsers(params);
        // Ensure we never return undefined
        if (!result) {
          return {
            data: [],
            pagination: {
              page: params.page || 1,
              limit: params.limit || 10,
              total: 0,
              totalPages: 0,
              hasNext: false,
              hasPrev: false,
            },
          };
        }
        return result;
      } catch (error) {
        // Return empty data structure on error instead of throwing
        console.error("Error fetching users:", error);
        return {
          data: [],
          pagination: {
            page: params.page || 1,
            limit: params.limit || 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
    },
    placeholderData: initialData,
    staleTime: 0,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, id],
    queryFn: () => getUser(id),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserRequest) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      updateUser(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      queryClient.setQueryData([USERS_QUERY_KEY, variables.id], data);
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
  });
}
