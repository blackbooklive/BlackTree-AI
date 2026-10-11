import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "./auth-client";
import { useGuestStore } from '@/stores/guestStore';

export const SESSION_QUERY_KEY = ['auth-session'] as const;

export const useSession = () => {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      const result = await authClient.getSession();
      return result.data ?? null;
    },
    staleTime: 1000 * 60 * 5, // 5 min cache
  });
};

/**
 * Call this after any auth action (sign-in, sign-up, sign-out)
 * to refresh the session state and trigger navigation guards.
 */
export const useInvalidateSession = () => {
  const queryClient = useQueryClient();
  return async () => {
    // Clear the session data immediately
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
    // Then invalidate to refetch
    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  };
};
