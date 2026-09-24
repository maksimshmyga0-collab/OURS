import { useState, useEffect, useCallback, useMemo } from 'react';
import { Pair } from '../../types/models';
import { CoupleState } from '../../types';
import { pairService } from './pairService';

export function usePair(userId: string = 'user-a-default') {
  const [pair, setPair] = useState<Pair | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    pairService.getCurrentPair(userId).then((p) => {
      if (isMounted) {
        setPair(p);
        setIsLoading(false);
      }
    });

    const unsubscribe = pairService.subscribeToPair('pair-default-1', (updated) => {
      if (isMounted) {
        setPair(updated);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [userId]);

  const updateSubscription = useCallback(async (tier: 'free' | 'premium') => {
    if (!pair) return;
    const updated = await pairService.updateSubscription(pair.id, tier);
    setPair(updated);
  }, [pair]);

  // Convert Pair to CoupleState for backward-compatible rendering
  const coupleState: CoupleState = useMemo(() => {
    if (!pair) {
      return {
        user: { name: 'Аня', avatarColor: '#F6DCE1' },
        partner: { name: 'Макс', avatarColor: '#DDEAF7' },
        inviteCode: 'OURS-4821',
        connected: true,
        startDate: '12 сентября 2026',
        daysTogether: 12,
        subscription: 'free',
      };
    }

    return {
      id: pair.id,
      user: {
        name: pair.userA.displayName,
        avatarColor: pair.userA.avatarColor || '#F6DCE1',
      },
      partner: {
        name: pair.userB?.displayName || 'Партнёр',
        avatarColor: pair.userB?.avatarColor || '#DDEAF7',
      },
      inviteCode: pair.inviteCode,
      connected: pair.status === 'active' && Boolean(pair.userB),
      startDate: pair.startDate,
      daysTogether: pair.daysTogether,
      subscription: pair.subscription,
    };
  }, [pair]);

  return {
    pair,
    coupleState,
    isLoading,
    updateSubscription,
  };
}
