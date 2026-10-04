import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AppState,
  getInitialAppState,
  saveAppState,
  resetToOnboarding,
} from './services/storage/appStateStorage';
import { NavigationTab, Moment, AppSettings, UserProfile, ThemeMode } from './types';
import { apiClient } from './services/api/apiClient';
import { ThemeProvider } from './services/theme/ThemeContext';
import { CoupleHeader } from './components/CoupleHeader';
import { OursLogo } from './components/OursLogo';
import { BottomTabBar } from './components/BottomTabBar';
import { LovelyModal } from './components/LovelyModal';
import { OurSkyModal } from './components/OurSkyModal';
import { EditProfileModal } from './components/EditProfileModal';
import { OnboardingFlow } from './components/OnboardingFlow';
import { TodayScreen } from './screens/TodayScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { DateScreen } from './screens/DateScreen';
import { SwipeableTabViews } from './components/SwipeableTabViews';
import { playSoftChime, triggerHaptic } from './services/feedback';
import { calculateCoupleStreak } from './services/streak/streakService';
import {
  syncAppStateForDate,
  createFreshDayMoments,
  getLocalDateKey,
} from './services/moments/momentTiming';
import { getCoupleMatchedDates } from './services/sky/skyService';
import { getCoupleSeed } from './services/fingerprint/fingerprintHistory';
import { LegalScreen, LegalDocumentType } from './screens/LegalScreen';
import { dateInvitationService } from './services/dates/dateInvitationService';

export default function App() {
  const [appState, setAppState] = useState<AppState>(getInitialAppState);
  const [activeTab, setActiveTab] = useState<NavigationTab>('today');
  const [isLovelyModalOpen, setIsLovelyModalOpen] = useState(false);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocumentType | null>(null);
  const [hasUnreadDateInvitation, setHasUnreadDateInvitation] = useState<boolean>(() =>
    dateInvitationService.hasUnreadIncomingInvitation()
  );
  // Fast startup: if local state has completed onboarding, show TodayScreen instantly without waiting for network init
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(
    () => !getInitialAppState().hasCompletedOnboarding
  );

  // Subscribe to date invitation updates for bottom tab badge
  useEffect(() => {
    const unsubscribe = dateInvitationService.subscribe((inv) => {
      setHasUnreadDateInvitation(
        Boolean(inv && inv.status === 'pending' && inv.senderId === 'partner' && !inv.read)
      );
    });
    return unsubscribe;
  }, []);

  // 1. Initialize anonymous session and restore multi-device state in background
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const session = await apiClient.initSession();
        if (!isMounted) return;

        if (session.hasCompletedOnboarding && session.pair) {
          setAppState((prev) => {
            const isLovely = Boolean(
              session.pair!.isLovely ||
              session.pair!.subscription === 'premium' ||
              prev.couple.isLovely ||
              prev.couple.subscription === 'premium'
            );
            return {
              ...prev,
              hasCompletedOnboarding: true,
              couple: {
                ...session.pair!,
                isLovely,
                subscription: isLovely ? 'premium' : (session.pair!.subscription || 'free'),
                lovelyPurchasedAt: session.pair!.lovelyPurchasedAt || prev.couple.lovelyPurchasedAt,
              },
              todayMoments:
                session.moments && session.moments.length > 0
                  ? session.moments
                  : prev.todayMoments,
              activeMomentId: session.moments?.[0]?.id || prev.activeMomentId,
              history:
                session.history && session.history.length > 0
                  ? session.history
                  : prev.history,
            };
          });
        } else {
          setAppState((prev) => ({
            ...prev,
            hasCompletedOnboarding: false,
            couple: {
              ...prev.couple,
              user: {
                ...prev.couple.user,
                id: session.user?.id || '',
                name: session.user?.displayName || '',
                avatarColor: session.user?.avatarColor || '#F6DCE1',
              },
              partner: {
                id: '',
                name: 'Партнёр',
                avatarColor: '#DDEAF7',
              },
              inviteCode: '',
              connected: false,
            },
          }));
        }
      } catch (err) {
        console.error('[OURS] Failed to initialize session:', err);
      } finally {
        if (isMounted) {
          setIsLoadingSession(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // Check and verify return from YooKassa payment
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const paymentReturn = params.get('payment');
      const paymentId = params.get('payment_id');

      if (paymentReturn === 'return') {
        if (paymentId) {
          apiClient.checkPaymentStatus(paymentId).then((res) => {
            if (res.success && res.isLovely) {
              apiClient.fetchPairState().then((pairRes) => {
                if (pairRes.success && pairRes.pair) {
                  setAppState((prev) => ({
                    ...prev,
                    couple: {
                      ...pairRes.pair!,
                      isLovely: true,
                      subscription: 'premium',
                    },
                  }));
                }
              });
            }
          }).catch(() => {});
        } else {
          // Poll pair state once after return
          apiClient.fetchPairState().then((pairRes) => {
            if (pairRes.success && pairRes.pair?.isLovely) {
              setAppState((prev) => ({
                ...prev,
                couple: {
                  ...pairRes.pair!,
                  isLovely: true,
                  subscription: 'premium',
                },
              }));
            }
          }).catch(() => {});
        }

        // Clean query params from URL without reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    } catch {
      // ignore
    }
  }, []);

  // 2. Multi-device live polling & Realtime subscription to synchronize pair status, partner photos, and reactions
  useEffect(() => {
    const pairId = appState.couple.id;
    if (!pairId) {
      return;
    }

    let isPolling = false;

    const pollState = async () => {
      if (isPolling) return;
      isPolling = true;

      try {
        const res = await apiClient.fetchPairState();
        if (res.success && res.pair) {
          setAppState((prev) => {
            const moments = (res.moments && res.moments.length > 0 ? res.moments : prev.todayMoments).map((srvM) => {
              const prevM = prev.todayMoments.find((pm) => pm.id === srvM.id || pm.order === srvM.order);
              if (!prevM) return srvM;

              const userPhoto = srvM.userPhoto || prevM.userPhoto || null;
              const partnerPhoto = srvM.partnerPhoto || prevM.partnerPhoto || null;
              const hasBoth = Boolean(userPhoto && partnerPhoto);

              const userReaction = srvM.userReaction || prevM.userReaction || null;
              const partnerReaction = srvM.partnerReaction || prevM.partnerReaction || null;

              // Monotonic status progression strictly based on CURRENT USER's own interaction state
              let status: string;
              if (userReaction) {
                // If current user has selected their reaction, status is COMPLETED
                status = 'COMPLETED';
              } else if (hasBoth) {
                // If THIS user has already revealed locally in this session, or server confirmed THIS user revealed:
                status = (prevM.status === 'REVEALED' || srvM.status === 'REVEALED') ? 'REVEALED' : 'BOTH_UPLOADED';
              } else if (userPhoto) {
                status = 'USER_UPLOADED';
              } else {
                status = 'EMPTY';
              }

              return {
                ...prevM,
                ...srvM,
                id: srvM.id,
                userPhoto,
                partnerPhoto,
                status: status as any,
                userReaction,
                partnerReaction,
              };
            });

            const validActiveId =
              moments.find((m) => m.id === prev.activeMomentId)?.id ||
              moments.find((m) => {
                const prevActive = prev.todayMoments.find((pm) => pm.id === prev.activeMomentId);
                return prevActive && m.order === prevActive.order;
              })?.id ||
              moments[0]?.id ||
              prev.activeMomentId;

            const isLovelyActive = Boolean(
              res.pair!.isLovely ||
              res.pair!.subscription === 'premium' ||
              (prev.couple.isLovely && !res.pair!.isLovely && prev.couple.lovelyPurchasedAt ? true : res.pair!.isLovely)
            );

            // Fast delta check: if nothing changed in moments, couple, or active moment, avoid re-rendering entire app
            const momentsChanged =
              moments.length !== prev.todayMoments.length ||
              moments.some((m, i) => {
                const pm = prev.todayMoments[i];
                return (
                  !pm ||
                  pm.id !== m.id ||
                  pm.status !== m.status ||
                  pm.userPhoto !== m.userPhoto ||
                  pm.partnerPhoto !== m.partnerPhoto ||
                  pm.userReaction !== m.userReaction ||
                  pm.partnerReaction !== m.partnerReaction ||
                  pm.completedAt !== m.completedAt
                );
              });

            const coupleChanged =
              prev.couple.connected !== res.pair!.connected ||
              prev.couple.isLovely !== isLovelyActive ||
              prev.couple.subscription !== (isLovelyActive ? 'premium' : (res.pair!.subscription || 'free')) ||
              prev.couple.user.name !== res.pair!.user.name ||
              prev.couple.user.avatarUrl !== res.pair!.user.avatarUrl ||
              prev.couple.partner.name !== res.pair!.partner.name ||
              prev.couple.partner.avatarUrl !== res.pair!.partner.avatarUrl ||
              prev.couple.daysTogether !== res.pair!.daysTogether;

            const historyChanged =
              Boolean(res.history && res.history.length > 0 && res.history.length !== prev.history.length);

            if (!momentsChanged && !coupleChanged && !historyChanged && validActiveId === prev.activeMomentId) {
              return prev; // Identical state -> zero re-renders!
            }

            return {
              ...prev,
              couple: {
                ...res.pair!,
                isLovely: isLovelyActive,
                subscription: isLovelyActive ? 'premium' : (res.pair!.subscription || 'free'),
                lovelyPurchasedAt: res.pair!.lovelyPurchasedAt || (isLovelyActive ? prev.couple.lovelyPurchasedAt : undefined),
                pairSeed: prev.couple.pairSeed || res.pair!.pairSeed,
              },
              todayMoments: moments,
              activeMomentId: validActiveId,
              history: res.history && res.history.length > 0 ? res.history : prev.history,
            };
          });
        }

        // Live sync active Date invitation for this pair across devices
        apiClient.fetchDateInvitation(pairId).then((srvInv) => {
          dateInvitationService.syncFromServer(
            srvInv,
            apiClient.getCurrentUserId() || appState.couple.user.id || null,
            appState.couple.user?.name,
            appState.couple.partner?.name
          );
        }).catch(() => {});
      } catch (err) {
        // Silent catch for brief network drop
      } finally {
        isPolling = false;
      }
    };

    // Immediate initial sync
    pollState();

    // Background safety heartbeat (8s; Realtime handles instant sync)
    const interval = setInterval(() => {
      if (!document.hidden) {
        pollState();
      }
    }, 8000);

    // Sync on window focus and visibility change
    const onVisibilityOrFocus = () => {
      if (!document.hidden) {
        pollState();
      }
    };
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    // Supabase Realtime channel subscription
    const unsubscribeRealtime = apiClient.subscribeToPair(pairId, pollState);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      unsubscribeRealtime();
    };
  }, [appState.couple.id]);

  // 3. Lazy-load history when History tab or Our Sky modal is opened
  useEffect(() => {
    if ((activeTab === 'history' || isStreakModalOpen) && appState.couple.id) {
      apiClient.fetchHistory(appState.couple.id).then((history) => {
        if (history && history.length > 0) {
          setAppState((prev) => ({
            ...prev,
            history,
          }));
        }
      }).catch((err) => {
        console.warn('[OURS] Failed to lazy-load history:', err);
      });
    }
  }, [activeTab, isStreakModalOpen, appState.couple.id]);

  // Sync state to local storage on changes
  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  // Check calendar date change periodically
  useEffect(() => {
    const handleDateSync = () => {
      setAppState((prev) => syncAppStateForDate(prev));
    };

    window.addEventListener('focus', handleDateSync);
    const interval = setInterval(handleDateSync, 60000);

    return () => {
      window.removeEventListener('focus', handleDateSync);
      clearInterval(interval);
    };
  }, []);

  // Calculate real streak & metrics dynamically
  const streakInfo = useMemo(() => {
    return calculateCoupleStreak(appState.todayMoments, appState.history);
  }, [appState.todayMoments, appState.history]);

  // Dynamic pair seed strictly derived from pairId for deterministic constellation generation
  const pairSeed = useMemo(() => {
    return (
      appState.couple.id ||
      appState.couple.pairSeed ||
      appState.couple.inviteCode ||
      'ours_pair'
    );
  }, [appState.couple.id, appState.couple.pairSeed, appState.couple.inviteCode]);

  // Matched dates extracted from real history & today's moments
  const matchedDates = useMemo(() => {
    return getCoupleMatchedDates(appState.couple, appState.todayMoments, appState.history);
  }, [appState.couple, appState.todayMoments, appState.history]);

  // Handle Onboarding Completion (Create, Join, or Restore Pair via Supabase)
  const handleOnboardingComplete = async (
    userName: string,
    options?: {
      isJoin?: boolean;
      inviteCode?: string;
      isRestore?: boolean;
      personalCode?: string;
    }
  ) => {
    try {
      let res;
      if (options?.isRestore) {
        if (!options.personalCode) {
          return { success: false, error: 'Личный код не указан' };
        }
        res = await apiClient.restoreUserByPersonalCode(options.personalCode);
      } else if (options?.isJoin && options.inviteCode) {
        res = await apiClient.joinPair(userName, options.inviteCode);
      } else {
        res = await apiClient.createPair(userName);
      }

      if (res.success && res.pair) {
        const pairSeedVal = `pair_${res.pair.id}`;

        setAppState((prev) => ({
          ...prev,
          hasCompletedOnboarding: Boolean(options?.isJoin || options?.isRestore),
          couple: {
            ...res.pair!,
            pairSeed: pairSeedVal,
          },
          todayMoments: res.moments || prev.todayMoments,
          activeMomentId: res.moments?.[0]?.id || prev.activeMomentId,
          history: res.history || [],
        }));

        return {
          success: true,
          inviteCode: res.pair.inviteCode,
          pairId: res.pair.id,
        };
      }
      return { success: false, error: 'Не удалось синхронизировать пару' };
    } catch (err: any) {
      console.error('[OURS] Onboarding completion error:', err);
      return { success: false, error: err?.message || 'Ошибка подключения' };
    }
  };

  // Close Onboarding after code shared
  const handleFinishOnboarding = () => {
    setAppState((prev) => ({
      ...prev,
      hasCompletedOnboarding: true,
    }));
  };

  // Leave current pair
  const handleLeavePair = async () => {
    try {
      await apiClient.leavePair();
    } catch (err) {
      console.warn('[OURS] Error leaving pair:', err);
    }
    const freshMoments = createFreshDayMoments('OURS', getLocalDateKey());
    setAppState((prev) => {
      const updated: AppState = {
        ...prev,
        hasCompletedOnboarding: false,
        couple: {
          ...prev.couple,
          id: '',
          pairSeed: '',
          partner: {
            id: '',
            name: 'Партнёр',
            avatarColor: '#DDEAF7',
          },
          inviteCode: '',
          connected: false,
          isLovely: false,
          lovelyPurchasedAt: undefined,
          subscription: 'free',
        },
        todayMoments: freshMoments,
        activeMomentId: freshMoments[0]?.id || 'moment-today-1',
        history: [],
      };
      saveAppState(updated);
      return updated;
    });
    setActiveTab('today');
  };

  // Sign out and reset to clean onboarding
  const handleSignOut = async () => {
    try {
      await apiClient.signOut();
    } catch (err) {
      console.warn('[OURS] Error signing out:', err);
    }
    const cleanState = resetToOnboarding();
    setAppState(cleanState);
    saveAppState(cleanState);
    setActiveTab('today');
  };

  // Update a moment in today's moments list with server synchronization
  const handleUpdateMoment = async (updated: Moment) => {
    // Optimistic UI update
    setAppState((prev) => {
      const nextMoments = prev.todayMoments.map((m) =>
        m.id === updated.id ? updated : m
      );
      return {
        ...prev,
        todayMoments: nextMoments,
      };
    });

    try {
      if (updated.userReaction) {
        const res = await apiClient.submitReaction(updated.id, updated.userReaction);
        if (res.success && res.moment) {
          const reactedM = res.moment;
          setAppState((prev) => ({
            ...prev,
            todayMoments: prev.todayMoments.map((m) =>
              m.id === reactedM.id || m.order === updated.order
                ? {
                    ...m,
                    ...reactedM,
                    id: reactedM.id,
                    status: 'COMPLETED',
                    userReaction: updated.userReaction,
                  }
                : m
            ),
          }));
        }
      } else if (updated.status === 'COMPLETED') {
        const res = await apiClient.completeMoment(updated.id, updated.userReaction || undefined);
        if (res.success && res.moment) {
          const completedM = res.moment;
          setAppState((prev) => ({
            ...prev,
            todayMoments: prev.todayMoments.map((m) =>
              m.id === completedM.id || m.order === updated.order
                ? { ...m, ...completedM, id: completedM.id, status: 'COMPLETED' }
                : m
            ),
          }));
        }
      } else if (updated.status === 'REVEALED') {
        const res = await apiClient.revealMoment(updated.id);
        if (res.success && res.moment) {
          const revealedM = res.moment;
          setAppState((prev) => ({
            ...prev,
            todayMoments: prev.todayMoments.map((m) =>
              m.id === revealedM.id || m.order === updated.order
                ? { ...m, ...revealedM, id: revealedM.id }
                : m
            ),
          }));
        }
      } else if (updated.userPhoto) {
        const res = await apiClient.uploadPhoto(updated.id, updated.userPhoto);
        if (res.success && res.moment) {
          const uploadedM = res.moment;
          setAppState((prev) => ({
            ...prev,
            todayMoments: prev.todayMoments.map((m) => {
              if (m.id === uploadedM.id || m.order === updated.order) {
                // Strictly preserve existing photos: never overwrite an existing photo with null
                const userPhoto = uploadedM.userPhoto || m.userPhoto || updated.userPhoto;
                const partnerPhoto = uploadedM.partnerPhoto || m.partnerPhoto || updated.partnerPhoto;
                const hasBoth = Boolean(userPhoto && partnerPhoto);
                const status = hasBoth
                  ? (m.status === 'COMPLETED' ? 'COMPLETED' : m.status === 'REVEALED' ? 'REVEALED' : 'BOTH_UPLOADED')
                  : (userPhoto ? 'USER_UPLOADED' : m.status);

                return {
                  ...m,
                  ...uploadedM,
                  id: uploadedM.id || m.id,
                  userPhoto,
                  partnerPhoto,
                  status,
                  photos: [
                    ...(userPhoto ? [{ userId: prev.couple.user.id || '', imageUrl: userPhoto, createdAt: new Date().toISOString() }] : []),
                    ...(partnerPhoto ? [{ userId: prev.couple.partner.id || '', imageUrl: partnerPhoto, createdAt: new Date().toISOString() }] : []),
                  ],
                };
              }
              return m;
            }),
          }));
        }
      }
    } catch (err) {
      console.error('[OURS] Failed to sync moment update:', err);
    }
  };

  // Switch active moment
  const handleSelectActiveMoment = useCallback((momentId: string) => {
    setAppState((prev) => ({
      ...prev,
      activeMomentId: momentId,
    }));
  }, []);

  // Update App Settings
  const handleUpdateSettings = useCallback((newSettings: AppSettings) => {
    setAppState((prev) => ({
      ...prev,
      settings: newSettings,
    }));
  }, []);

  // Update Theme Mode
  const handleUpdateTheme = useCallback((theme: ThemeMode) => {
    setAppState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme,
      },
    }));
  }, []);

  // One-time purchase for the couple: LOVELY ♡
  const handlePurchaseLovely = async () => {
    const purchasedAt = new Date().toISOString();
    const pairId = appState.couple.id;

    // 1. Immediate optimistic UI update & persistence
    setAppState((prev) => {
      const nextState: AppState = {
        ...prev,
        couple: {
          ...prev.couple,
          isLovely: true,
          lovelyPurchasedAt: purchasedAt,
          subscription: 'premium',
        },
        history: prev.history.map((h) => ({ ...h, isLocked: false })),
      };
      saveAppState(nextState);
      return nextState;
    });

    // 2. Authoritative Supabase update & Realtime broadcast
    try {
      await apiClient.purchaseLovely(pairId);
    } catch (err) {
      console.error('[OURS] Failed to sync LOVELY purchase:', err);
    }

    playSoftChime('success', appState.settings.sounds);
    triggerHaptic(appState.settings.haptic);
  };

  // Reset LOVELY status
  const handleResetLovely = async () => {
    const pairId = appState.couple.id;

    setAppState((prev) => {
      const nextState: AppState = {
        ...prev,
        couple: {
          ...prev.couple,
          isLovely: false,
          lovelyPurchasedAt: undefined,
          subscription: 'free',
          subscriptionTariff: undefined,
        },
        history: prev.history.map((h, i) => ({ ...h, isLocked: i > 2 })),
      };
      saveAppState(nextState);
      return nextState;
    });

    try {
      await apiClient.resetLovely(pairId);
    } catch (err) {
      console.error('[OURS] Failed to reset LOVELY:', err);
    }

    playSoftChime('tap', appState.settings.sounds);
    triggerHaptic(appState.settings.haptic);
  };

  // Update Current User Profile (Name & Photo)
  const handleSaveProfile = useCallback(async (updated: Partial<UserProfile>) => {
    setAppState((prev) => ({
      ...prev,
      couple: {
        ...prev.couple,
        user: {
          ...prev.couple.user,
          ...updated,
        },
      },
    }));

    try {
      await apiClient.updateProfile({
        name: updated.name,
        avatarUrl: updated.avatarUrl,
        avatarColor: updated.avatarColor,
      });
    } catch (err) {
      console.error('[OURS] Failed to save profile:', err);
    }
  }, []);

  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-[#FFF9FA] dark:bg-[#000000] flex items-center justify-center p-6 selection:bg-transparent">
        <div className="flex flex-col items-center gap-5 sm:gap-6 animate-pulse select-none">
          <OursLogo size={296} className="max-w-[76vw] max-h-[76vw]" />
          <span className="font-display text-[28px] sm:text-[32px] font-semibold tracking-[0.2em] text-[#343033] dark:text-white leading-none">
            OURS
          </span>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider
      initialTheme={appState.settings.theme}
      onThemePersist={handleUpdateTheme}
    >
      {!appState.hasCompletedOnboarding ? (
        <OnboardingFlow
          onComplete={handleOnboardingComplete}
          onFinish={handleFinishOnboarding}
        />
      ) : (
        <div className="min-h-screen bg-[#FFF9FA] dark:bg-[#000000] text-[#343033] dark:text-[#FFFFFF] flex flex-col justify-between selection:bg-[#F6DCE1]">
          {/* Mobile-first centered frame container with soft depth */}
          <div className="w-full max-w-md mx-auto flex flex-col min-h-screen relative bg-[#FFF9FA] dark:bg-[#000000] sm:shadow-[0_0_40px_-10px_rgba(52,48,51,0.07)] sm:border-x sm:border-[#F0E6E8]/70 dark:sm:border-[#242024]">
            {/* Sticky Header with couple names and avatar pair */}
            <CoupleHeader
              couple={appState.couple}
              onOpenProfile={() => {
                if (activeTab === 'profile') {
                  setIsEditProfileOpen(true);
                } else {
                  setActiveTab('profile');
                }
              }}
              currentStreak={streakInfo.currentStreak}
              onOpenStreak={() => setIsStreakModalOpen(true)}
            />

            {/* Scrollable Main Viewport with Horizontal Tab Swipe Navigation */}
            <main className="flex-1 flex flex-col overflow-x-hidden min-h-0">
              <SwipeableTabViews
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setActiveTab(tab);
                  playSoftChime('tap', appState.settings.sounds);
                  triggerHaptic(appState.settings.haptic);
                }}
                soundEnabled={appState.settings.sounds}
                hapticEnabled={appState.settings.haptic}
                disabled={isLovelyModalOpen || isStreakModalOpen || isEditProfileOpen || Boolean(activeLegalDoc)}
              >
                {{
                  date: (
                    <DateScreen
                      couple={appState.couple}
                      soundEnabled={appState.settings.sounds}
                      hapticEnabled={appState.settings.haptic}
                    />
                  ),
                  today: (
                    <TodayScreen
                      couple={appState.couple}
                      moments={appState.todayMoments}
                      history={appState.history}
                      pairSeed={pairSeed}
                      activeMomentId={appState.activeMomentId}
                      onSelectActiveMoment={handleSelectActiveMoment}
                      onUpdateMoment={handleUpdateMoment}
                      soundEnabled={appState.settings.sounds}
                      hapticEnabled={appState.settings.haptic}
                      streakInfo={streakInfo}
                      onOpenStreak={() => setIsStreakModalOpen(true)}
                    />
                  ),
                  history: (
                    <HistoryScreen
                      history={appState.history}
                      todayMoments={appState.todayMoments}
                      couple={appState.couple}
                      onOpenLovely={() => setIsLovelyModalOpen(true)}
                      onOpenPremium={() => setIsLovelyModalOpen(true)}
                      onNavigateToToday={() => setActiveTab('today')}
                    />
                  ),
                  profile: (
                    <ProfileScreen
                      couple={appState.couple}
                      todayMoments={appState.todayMoments}
                      history={appState.history}
                      pairSeed={pairSeed}
                      settings={appState.settings}
                      onUpdateSettings={handleUpdateSettings}
                      onOpenLovely={() => setIsLovelyModalOpen(true)}
                      onOpenPremium={() => setIsLovelyModalOpen(true)}
                      streakInfo={streakInfo}
                      onOpenEditProfile={() => setIsEditProfileOpen(true)}
                      onOpenSky={() => setIsStreakModalOpen(true)}
                      onOpenFingerprint={() => setIsStreakModalOpen(true)}
                      onOpenThread={() => setIsStreakModalOpen(true)}
                      onOpenTerms={() => setActiveLegalDoc('terms')}
                      onOpenPrivacy={() => setActiveLegalDoc('privacy')}
                      onLeavePair={handleLeavePair}
                      onSignOut={handleSignOut}
                    />
                  ),
                }}
              </SwipeableTabViews>
            </main>

            {/* Fixed Bottom Tab Bar */}
            <BottomTabBar
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                playSoftChime('tap', appState.settings.sounds);
                triggerHaptic(appState.settings.haptic);
              }}
              hasDateNotification={hasUnreadDateInvitation}
            />

            {/* LOVELY One-Time Purchase Modal for the Couple */}
            <LovelyModal
              isOpen={isLovelyModalOpen}
              onClose={() => setIsLovelyModalOpen(false)}
              onPurchase={handlePurchaseLovely}
              onResetLovely={handleResetLovely}
              pairId={appState.couple.id}
              isLovely={Boolean(appState.couple.isLovely || appState.couple.subscription === 'premium')}
              partnerAName={appState.couple.user.name}
              partnerBName={appState.couple.partner.name}
              onOpenTerms={() => setActiveLegalDoc('terms')}
            />

            {/* «Наше небо» Modal */}
            <OurSkyModal
              isOpen={isStreakModalOpen}
              onClose={() => setIsStreakModalOpen(false)}
              couple={appState.couple}
              pairSeed={pairSeed}
              todayMoments={appState.todayMoments}
              history={appState.history}
              matchedDates={matchedDates}
              partnerAName={appState.couple.user.name}
              partnerBName={appState.couple.partner.name}
              onOpenPremium={() => setIsLovelyModalOpen(true)}
              onOpenLovely={() => setIsLovelyModalOpen(true)}
            />

            {/* User Profile Editor Modal */}
            <EditProfileModal
              isOpen={isEditProfileOpen}
              onClose={() => setIsEditProfileOpen(false)}
              user={appState.couple.user}
              daysTogether={appState.couple.daysTogether}
              streakInfo={streakInfo}
              onSaveProfile={handleSaveProfile}
              onOpenSky={() => setIsStreakModalOpen(true)}
              onOpenFingerprint={() => setIsStreakModalOpen(true)}
              onOpenThread={() => setIsStreakModalOpen(true)}
              soundEnabled={appState.settings.sounds}
              hapticEnabled={appState.settings.haptic}
            />

            {/* Legal Documents Screen (Terms of Service / Privacy Policy) */}
            <LegalScreen
              document={activeLegalDoc}
              onClose={() => setActiveLegalDoc(null)}
            />
          </div>
        </div>
      )}
    </ThemeProvider>
  );
}
