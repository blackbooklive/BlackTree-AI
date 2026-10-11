import { useEffect } from 'react';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

/**
 * Thin wrapper around the global subscriptionStore.
 *
 * All subscription state lives in the Zustand store so every screen
 * sees the same isPro value instantly after a purchase — no need to
 * refetch or refresh individual hook instances.
 *
 * Returns the same interface as before so no call-sites need changes:
 *   { isPro, isLoading, packages, error, purchase, restore, refresh }
 */
export function useSubscription() {
  const isPro = useSubscriptionStore(s => s.isPro);
  const isLoading = useSubscriptionStore(s => s.isLoading);
  const packages = useSubscriptionStore(s => s.packages);
  const error = useSubscriptionStore(s => s.error);
  const hasChecked = useSubscriptionStore(s => s.hasChecked);
  const checkSubscription = useSubscriptionStore(s => s.checkSubscription);
  const purchase = useSubscriptionStore(s => s.purchase);
  const restore = useSubscriptionStore(s => s.restore);

  // Only trigger the initial fetch once per app session (not per mount).
  // Subsequent mounts just read the already-loaded store state.
  useEffect(() => {
    if (!hasChecked) {
      checkSubscription();
    }
  }, [hasChecked, checkSubscription]);

  return {
    isPro,
    isLoading,
    packages,
    error,
    purchase,
    restore,
    refresh: checkSubscription,
  };
}
