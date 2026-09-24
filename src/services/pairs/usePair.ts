import { useState, useEffect, useCallback, useMemo } from 'react';
import { Pair } from '../../types/models';
import { CoupleState } from '../../types';
import { pairService } from './pairService';

export function usePair(userId: string = '') {
  const [pair, setPair] = useState<Pair | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (userId) {
      pairService.getCurrentPair(userId).then((p) => {
        if (isMounted) {
          setPair(p);
          setIsLoading(false);
        }
      });
    } else {
      setIsLoading(false);
    }

    const unsubscribe = pairService.subscribeToPair('pair-default-1', (updated: Pair) => {
      if (isMounted) {
        setPair(updated);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [userId]);

  const purchaseLovely = useCallback(async () => {
    if (!pair) return;
    const updated = await pairService.purchaseLovely(pair.id);
    setPair(updated);
  }, [pair]);

  const resetLovely = useCallback(async () => {
    if (!pair) return;
    const updated = await pairService.resetLovely(pair.id);
    setPair(updated);
  }, [pair]);

  const updateSubscription = useCallback(async (tier: 'free' | 'premium') => {
    if (!pair) return;
    const updated = await pairService.updateSubscription(pair.id, tier);
    setPair(updated);
  }, [pair]);

  // Convert Pair to CoupleState for backward-compatible rendering
  const coupleState: CoupleState = useMemo(() => {
    if (!pair) {
      return {
        user: { name: '', avatarColor: '#F6DCE1' },
        partner: { name: 'Партнёр', avatarColor: '#DDEAF7' },
        inviteCode: '',
        connected: false,
        startDate: '',
        daysTogether: 1,
        isLovely: false,
        subscription: 'free',
      };
    }

    return {
      id: pair.id,
      user: {
        id: pair.userA.id,
        name: pair.userA.displayName,
        avatarColor: pair.userA.avatarColor || '#F6DCE1',
        avatarUrl: pair.userA.avatarUrl,
      },
      partner: {
        id: pair.userB?.id || '',
        name: pair.userB?.displayName || 'Партнёр',
        avatarColor: pair.userB?.avatarColor || '#DDEAF7',
        avatarUrl: pair.userB?.avatarUrl,
      },
      inviteCode: pair.inviteCode,
      connected: pair.status === 'active' && Boolean(pair.userB),
      startDate: pair.startDate,
      daysTogether: pair.daysTogether,
      isLovely: pair.isLovely,
      lovelyPurchasedAt: pair.lovelyPurchasedAt,
      subscription: pair.subscription,
    };
  }, [pair]);

  return {
    pair,
    coupleState,
    isLoading,
    purchaseLovely,
    resetLovely,
    updateSubscription,
  };
}
