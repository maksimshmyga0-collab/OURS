import { useState, useEffect, useCallback, useMemo } from 'react';
import { Moment, HistoryDay, ReactionEmoji } from '../../types/models';
import { momentService } from './momentService';

export function useMoments(pairId: string = 'pair-default-1', currentUserId: string = 'user-a-default') {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [activeMomentId, setActiveMomentId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to reactive updates (prepared for Supabase Realtime)
  useEffect(() => {
    let isMounted = true;

    // Load initial moments & history
    Promise.all([
      momentService.getTodayMoments(pairId),
      momentService.getHistory(pairId),
    ]).then(([today, hist]) => {
      if (isMounted) {
        setMoments(today);
        setHistory(hist);
        if (today.length > 0 && !activeMomentId) {
          setActiveMomentId(today[0].id);
        }
        setIsLoading(false);
      }
    });

    const unsubscribe = momentService.subscribeToMoments(pairId, (updatedMoments) => {
      if (isMounted) {
        setMoments(updatedMoments);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [pairId]);

  // Upload user photo for a moment
  const uploadPhoto = useCallback(
    async (momentId: string, photo: File | Blob | string) => {
      const updated = await momentService.uploadUserPhoto(pairId, momentId, photo, currentUserId);
      return updated;
    },
    [pairId, currentUserId]
  );

  // Simulate or receive partner photo
  const simulatePartnerPhoto = useCallback(
    async (momentId: string, partnerPhotoUrl: string) => {
      const updated = await momentService.submitPartnerPhoto(
        pairId,
        momentId,
        partnerPhotoUrl,
        'user-b-default'
      );
      return updated;
    },
    [pairId]
  );

  // Submit reaction
  const submitReaction = useCallback(
    async (momentId: string, emoji: ReactionEmoji) => {
      const updated = await momentService.submitReaction(pairId, momentId, emoji, currentUserId);
      return updated;
    },
    [pairId, currentUserId]
  );

  // Complete moment and advance
  const completeMoment = useCallback(
    async (momentId: string) => {
      const updated = await momentService.completeMoment(pairId, momentId);
      return updated;
    },
    [pairId]
  );

  // Update moment directly
  const updateMoment = useCallback(
    async (updated: Moment) => {
      const res = await momentService.updateMoment(pairId, updated);
      return res;
    },
    [pairId]
  );

  // Reset current day's moments
  const resetDay = useCallback(async () => {
    const fresh = await momentService.resetDayMoments(pairId);
    setMoments(fresh);
    if (fresh.length > 0) {
      setActiveMomentId(fresh[0].id);
    }
  }, [pairId]);

  // Unlock history when upgraded to LOVELY
  const unlockHistory = useCallback(async () => {
    const unlocked = await momentService.unlockHistoryWithLovely(pairId);
    setHistory(unlocked);
  }, [pairId]);

  // Progression & rules
  const completedCount = useMemo(
    () => moments.filter((m) => m.status === 'COMPLETED').length,
    [moments]
  );

  const isAllCompleted = completedCount === 3;

  const canCreateNext = useMemo(
    () => momentService.canCreateNextMoment(moments),
    [moments]
  );

  // Active moment helper
  const activeMoment = useMemo(() => {
    if (!moments.length) return null;
    return (
      moments.find((m) => m.id === activeMomentId) ||
      moments[0]
    );
  }, [moments, activeMomentId]);

  return {
    moments,
    history,
    activeMomentId,
    activeMoment,
    completedCount,
    isAllCompleted,
    canCreateNext,
    isLoading,
    setActiveMomentId,
    uploadPhoto,
    simulatePartnerPhoto,
    submitReaction,
    completeMoment,
    updateMoment,
    resetDay,
    unlockHistory,
  };
}
