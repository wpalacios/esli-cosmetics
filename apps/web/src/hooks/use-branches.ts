import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BranchWithRelations,
  BranchesResponse,
  CreateBranchRequest,
  UpdateBranchRequest,
} from "@esli-cosmetics/types";
import {
  getBranches,
  getBranch,
  createBranch,
  updateBranch,
  deleteBranch,
} from "@/actions/branches";

// Query keys
const BRANCHES_QUERY_KEY = "branches";

// Types for API calls
interface BranchesParams {
  page?: number;
  limit?: number;
  search?: string;
}

// Hook to fetch branches with pagination and search
export function useBranches(params: BranchesParams = {}) {
  const { page = 1, limit = 10, search } = params;

  return useQuery<BranchesResponse>({
    queryKey: [BRANCHES_QUERY_KEY, { page, limit, ...(search && { search }) }],
    queryFn: async () => {
      return await getBranches({ page, limit, ...(search && { search }) });
    },
    staleTime: 0,
  });
}

// Hook to fetch a single branch by ID
export function useBranch(id: string) {
  return useQuery<BranchWithRelations>({
    queryKey: [BRANCHES_QUERY_KEY, id],
    queryFn: async () => {
      return await getBranch(id);
    },
    enabled: !!id,
    staleTime: 0,
  });
}

// Hook to create a new branch
export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation<BranchWithRelations, Error, CreateBranchRequest>({
    mutationFn: async data => {
      return await createBranch(data);
    },
    onSuccess: () => {
      // Invalidate and refetch branches queries
      queryClient.invalidateQueries({ queryKey: [BRANCHES_QUERY_KEY] });
    },
  });
}

// Hook to update a branch
export function useUpdateBranch() {
  const queryClient = useQueryClient();

  return useMutation<
    BranchWithRelations,
    Error,
    { id: string; data: UpdateBranchRequest }
  >({
    mutationFn: async ({ id, data }) => {
      return await updateBranch(id, data);
    },
    onSuccess: data => {
      // Invalidate and refetch branches queries
      queryClient.invalidateQueries({ queryKey: [BRANCHES_QUERY_KEY] });
      // Update the specific branch in cache
      queryClient.setQueryData([BRANCHES_QUERY_KEY, data.id], data);
    },
  });
}

// Hook to delete a branch
export function useDeleteBranch() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async id => {
      return await deleteBranch(id);
    },
    onSuccess: () => {
      // Invalidate and refetch branches queries
      queryClient.invalidateQueries({ queryKey: [BRANCHES_QUERY_KEY] });
    },
  });
}
