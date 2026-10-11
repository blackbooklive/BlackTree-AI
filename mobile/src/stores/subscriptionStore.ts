import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getOfferings,
  getCustomerInfo,
  purchasePackage,
  restorePurchases,
  isRevenueCatEnabled,
} from '@/lib/revenuecatClient';
import type { PurchasesPackage } from 'react-native-purchases';

interface SubscriptionState {
  isPro: boolean;
  isLoading: boolean;
  packages: PurchasesPackage[];
  error: string | null;
  // Track whether an initial check has been done so the hook wrapper
  // only triggers one fetch per app session, not per mount.
  hasChecked: boolean;
}

interface SubscriptionActions {
  checkSubscription: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
}

export type SubscriptionStore = SubscriptionState & SubscriptionActions;

export const useSubscriptionStore = create<SubscriptionStore>()((set, get) => ({
  // --- Initial state ---
  isPro: false,
  isLoading: true,
  packages: [],
  error: null,
  hasChecked: false,

  // --- Actions ---

  checkSubscription: async () => {
    // Get or set the first open date
    let firstOpenStr = await AsyncStorage.getItem('app_first_open_date');
    if (!firstOpenStr) {
      firstOpenStr = new Date().toISOString();
      await AsyncStorage.setItem('app_first_open_date', firstOpenStr);
    }
    const firstOpen = new Date(firstOpenStr);
    const daysSince = (Date.now() - firstOpen.getTime()) / (1000 * 60 * 60 * 24);
    const isInTrial = daysSince <= 10;

    if (!isRevenueCatEnabled()) {
      set({ isPro: isInTrial, isLoading: false, hasChecked: true });
      return;
    }

    try {
      const result = await getCustomerInfo();
      const customerInfo = result.ok ? result.data : null;
      const hasPaidPro = Boolean(customerInfo?.entitlements?.active?.['pro']);
      const isPro = hasPaidPro || isInTrial;
      console.log('[Subscription] daysSince:', daysSince, 'isInTrial:', isInTrial, 'hasPaidPro:', hasPaidPro, 'isPro:', isPro);
      const packages = await getOfferings().then(r => r.ok ? (r.data?.current?.availablePackages ?? []) : []);
      set({ isPro, isLoading: false, packages, hasChecked: true });
    } catch {
      set({ isPro: isInTrial, isLoading: false, hasChecked: true });
    }
  },

  purchase: async (pkg: PurchasesPackage) => {
    set({ isLoading: true, error: null });

    const result = await purchasePackage(pkg);
    console.log('[Subscription] Purchase result:', result);

    if (result.ok) {
      // The customerInfo returned from purchase already has updated entitlements
      const customerInfo = result.data;
      const isPro = Boolean(customerInfo?.entitlements?.active?.['pro']);
      console.log('[Subscription] After purchase - isPro:', isPro, 'entitlements:', customerInfo?.entitlements?.active);

      set({ isPro, isLoading: false });

      // Belt-and-suspenders: do a full refresh from RevenueCat to sync all state
      await get().checkSubscription();

      return true;
    } else {
      // User cancelled is not an error
      const error = result.error as any;
      const userCancelled = error?.userCancelled || error?.code === 1;

      set({
        isLoading: false,
        error: (!userCancelled && result.reason === 'sdk_error') ? 'Purchase failed. Please try again.' : null,
      });
      return false;
    }
  },

  restore: async () => {
    set({ isLoading: true, error: null });

    const result = await restorePurchases();
    console.log('[Subscription] Restore result:', result);

    if (result.ok) {
      // The customerInfo returned from restore already has updated entitlements
      const customerInfo = result.data;
      const isPro = Boolean(customerInfo?.entitlements?.active?.['pro']);
      console.log('[Subscription] After restore - isPro:', isPro, 'entitlements:', customerInfo?.entitlements?.active);

      set({ isPro, isLoading: false });
      return isPro; // Return true only if actually has pro
    } else {
      set({
        isLoading: false,
        error: 'Failed to restore purchases',
      });
      return false;
    }
  },
}));
