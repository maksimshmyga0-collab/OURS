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
import { OursLogo, OURS_LOGO_URL } from './components/OursLogo';
import { BottomTabBar } from './components/BottomTabBar';
import { TodayScreen } from './screens/TodayScreen';
import { SwipeableTabViews } from './components/SwipeableTabViews';
import { playSoftChime, triggerHaptic } from './services/feedback';
import { calculateCoupleStreak } from './services/streak/streakService';
import {
  syncAppStateForDate,
  createFreshDayMoments,
  getLocalDateKey,
  resolveAuthoritativeActiveMomentId,
  getSynchronizedNow,
} from './services/moments/momentTiming';
import {
  getCoupleMatchedDates,
  getCoupleSkyDates,
  getMatchedDatesForMonth,
  getCoupleStarEvents,
  getStarEventsForMonth,
  StarEvent,
} from './services/sky/skyService';
import { getCoupleSeed } from './services/fingerprint/fingerprintHistory';
import { LegalDocumentType } from './screens/LegalScreen';
import { dateInvitationService } from './services/dates/dateInvitationService';

// Code-split non-critical screens and modals for fast budget-device startup
const HistoryScreen = React.lazy(() => import('./screens/HistoryScreen').then(m => ({ default: m.HistoryScreen })));
const ProfileScreen = React.lazy(() => import('./screens/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const DateScreen = React.lazy(() => import('./screens/DateScreen').then(m => ({ default: m.DateScreen })));
const LegalScreen = React.lazy(() => import('./screens/LegalScreen').then(m => ({ default: m.LegalScreen })));
const LovelyModal = React.lazy(() => import('./components/LovelyModal').then(m => ({ default: m.LovelyModal })));
const OurSkyModal = React.lazy(() => import('./components/OurSkyModal').then(m => ({ default: m.OurSkyModal })));
const EditProfileModal = React.lazy(() => import('./components/EditProfileModal').then(m => ({ default: m.EditProfileModal })));
const OnboardingFlow = React.lazy(() => import('./components/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })));

const TabLoadingFallback = () => (
  <div className="w-full flex-1 min-h-[300px] flex items-center justify-center bg-transparent" />
);

export default function App() {
  const [appState, setAppState] = useState<AppState>(getInitialAppState);
  const [activeTab, setActiveTab] = useState<NavigationTab>('date');
  const [isLovelyModalOpen, setIsLovelyModalOpen] = useState(false);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocumentType | null>(null);
  const [hasUnreadDateInvitation, setHasUnreadDateInvitation] = useState<boolean>(() =>
    dateInvitationService.hasUnreadIncomingInvitation()
  );
  const [isInitialSessionReady, setIsInitialSessionReady] = useState(false);

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

        if (session.success && session.hasCompletedOnboarding && session.pair) {
          setAppState((prev) => {
            const isLovely = Boolean(
              session.pair!.isLovely ||
              session.pair!.subscription === 'premium' ||
              prev.couple.isLovely ||
              prev.couple.subscription === 'premium'
            );

            // Partner name preservation: avoid degrading known partner name to fallback 'Партнёр'
            const partnerName = (session.pair!.partner.name && session.pair!.partner.name !== 'Партнёр')
              ? session.pair!.partner.name
              : (prev.couple.partner.name && prev.couple.partner.name !== 'Партнёр')
                ? prev.couple.partner.name
                : (session.pair!.partner.name || 'Партнёр');

            const partnerAvatar = session.pair!.partner.avatarUrl || prev.couple.partner.avatarUrl || null;

            const nextState: AppState = {
              ...prev,
              hasCompletedOnboarding: true,
              couple: {
                ...session.pair!,
                partner: {
                  ...session.pair!.partner,
                  name: partnerName,
                  avatarUrl: partnerAvatar,
                },
                isLovely,
                subscription: isLovely ? 'premium' : (session.pair!.subscription || 'free'),
                lovelyPurchasedAt: session.pair!.lovelyPurchasedAt || prev.couple.lovelyPurchasedAt,
              },
              todayMoments:
                session.moments && session.moments.length > 0
                  ? session.moments
                  : prev.todayMoments,
              activeMomentId: resolveAuthoritativeActiveMomentId(
                session.moments && session.moments.length > 0 ? session.moments : prev.todayMoments,
                getSynchronizedNow(),
                prev.activeMomentId
              ),
              history:
                session.history && session.history.length > 0
                  ? session.history
                  : prev.history,
            };
            saveAppState(nextState);
            return nextState;
          });
        } else if (session.success && !session.hasCompletedOnboarding) {
          // Explicit server confirmation: user does not have a pair
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
        } else {
          // Offline, timeout, or cached mode: preserve local appState intact!
          console.log('[OURS] Session initialization running with local/cached state');
        }
      } catch (err) {
        console.error('[OURS] Failed to initialize session:', err);
      } finally {
        if (isMounted) {
          setIsInitialSessionReady(true);
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
    // Sequential startup: activate background polling & realtime ONLY after initial session sync finishes
    if (!isInitialSessionReady) {
      return;
    }

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

              const sanitizePhoto = (u: string | null | undefined): string | null => {
                if (!u || typeof u !== 'string' || u.startsWith('blob:')) return null;
                return u;
              };

              const userPhoto = sanitizePhoto(srvM.userPhoto) || sanitizePhoto(prevM.userPhoto) || null;
              const partnerPhoto = sanitizePhoto(srvM.partnerPhoto) || sanitizePhoto(prevM.partnerPhoto) || null;
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

            const validActiveId = resolveAuthoritativeActiveMomentId(
              moments,
              getSynchronizedNow(),
              prev.activeMomentId
            );

            const isLovelyActive = Boolean(
              res.pair!.isLovely ||
              res.pair!.subscription === 'premium' ||
              (prev.couple.isLovely && !res.pair!.isLovely && prev.couple.lovelyPurchasedAt ? true : res.pair!.isLovely)
            );

            const resolvedPartnerName = (res.pair!.partner.name && res.pair!.partner.name !== 'Партнёр')
              ? res.pair!.partner.name
              : (prev.couple.partner.name && prev.couple.partner.name !== 'Партнёр')
                ? prev.couple.partner.name
                : (res.pair!.partner.name || 'Партнёр');

            const resolvedPartnerAvatar = res.pair!.partner.avatarUrl || prev.couple.partner.avatarUrl || null;
            const resolvedUserAvatar = res.pair!.user.avatarUrl || prev.couple.user.avatarUrl || null;
            const prevUserAvatar = prev.couple.user.avatarUrl || null;
            const prevPartnerAvatar = prev.couple.partner.avatarUrl || null;

            const coupleChanged =
              prev.couple.connected !== res.pair!.connected ||
              prev.couple.isLovely !== isLovelyActive ||
              prev.couple.subscription !== (isLovelyActive ? 'premium' : (res.pair!.subscription || 'free')) ||
              (prev.couple.user.name || '') !== (res.pair!.user.name || '') ||
              prevUserAvatar !== resolvedUserAvatar ||
              prev.couple.partner.name !== resolvedPartnerName ||
              prevPartnerAvatar !== resolvedPartnerAvatar ||
              prev.couple.daysTogether !== res.pair!.daysTogether;

            const momentsChanged =
              moments.length !== prev.todayMoments.length ||
              moments.some((m, i) => {
                const pm = prev.todayMoments[i];
                if (!pm) return true;
                return (
                  pm.id !== m.id ||
                  pm.status !== m.status ||
                  (pm.userPhoto || null) !== (m.userPhoto || null) ||
                  (pm.partnerPhoto || null) !== (m.partnerPhoto || null) ||
                  (pm.userReaction || null) !== (m.userReaction || null) ||
                  (pm.partnerReaction || null) !== (m.partnerReaction || null) ||
                  (pm.completedAt || null) !== (m.completedAt || null)
                );
              });

            const historyChanged =
              Boolean(res.history && res.history.length > 0 && res.history.length !== prev.history.length);

            if (!momentsChanged && !coupleChanged && !historyChanged && validActiveId === prev.activeMomentId) {
              return prev; // Identical state -> zero re-renders!
            }

            const nextState: AppState = {
              ...prev,
              couple: {
                ...res.pair!,
                partner: {
                  ...res.pair!.partner,
                  name: resolvedPartnerName,
                  avatarUrl: resolvedPartnerAvatar,
                },
                isLovely: isLovelyActive,
                subscription: isLovelyActive ? 'premium' : (res.pair!.subscription || 'free'),
                lovelyPurchasedAt: res.pair!.lovelyPurchasedAt || (isLovelyActive ? prev.couple.lovelyPurchasedAt : undefined),
                pairSeed: prev.couple.pairSeed || res.pair!.pairSeed,
              },
              todayMoments: moments,
              activeMomentId: validActiveId,
              history: res.history && res.history.length > 0 ? res.history : prev.history,
            };
            saveAppState(nextState);
            return nextState;
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
  }, [isInitialSessionReady, appState.couple.id]);

  // 3. Proactive Background Prefetch & Preload History while on Today
  useEffect(() => {
    if (!isInitialSessionReady || !appState.couple.id) return;

    let isMounted = true;

    // A. Preload HistoryScreen JS chunk during idle time
    if (typeof window !== 'undefined') {
      const idleCallback = (window as any).requestIdleCallback || ((cb: Function) => setTimeout(cb, 400));
      idleCallback(() => {
        import('./screens/HistoryScreen').catch(() => {});
      });
    }

    // B. Prefetch History data from Supabase
    const prefetchHistoryData = async () => {
      try {
        const history = await apiClient.fetchHistory(appState.couple.id);
        if (!isMounted || !history || history.length === 0) return;

        setAppState((prev) => {
          const prevCount = prev.history.reduce((acc, d) => acc + (d.moments?.length || 0), 0);
          const nextCount = history.reduce((acc, d) => acc + (d.moments?.length || 0), 0);
          if (
            prev.history.length === history.length &&
            prevCount === nextCount &&
            prev.history[0]?.id === history[0]?.id &&
            prev.history[prev.history.length - 1]?.id === history[history.length - 1]?.id
          ) {
            return prev;
          }
          const next = {
            ...prev,
            history,
          };
          saveAppState(next);
          return next;
        });

        // C. Gentle photo pre-warming: pre-warm only top 2-3 thumbnails for the latest day
        if (typeof window !== 'undefined' && history.length > 0) {
          const idleCallback = (window as any).requestIdleCallback || ((cb: Function) => setTimeout(cb, 600));
          idleCallback(() => {
            const latestDay = history[0];
            if (latestDay && !latestDay.isLocked && Array.isArray(latestDay.moments)) {
              const urls: string[] = [];
              for (const m of latestDay.moments.slice(0, 2)) {
                const uP = m.userPhoto || (m.photos && m.photos[0]?.imageUrl);
                const pP = m.partnerPhoto || (m.photos && m.photos[1]?.imageUrl);
                if (uP) urls.push(uP);
                if (pP) urls.push(pP);
              }
              urls.slice(0, 3).forEach((url) => {
                const img = new Image();
                img.decoding = 'async';
                img.src = url;
              });
            }
          });
        }
      } catch (err) {
        console.warn('[OURS] Failed to prefetch history in background:', err);
      }
    };

    // Slight delay so TodayScreen's first interactive frame has 100% CPU priority
    const timer = setTimeout(prefetchHistoryData, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isInitialSessionReady, appState.couple.id]);

  // Ensure History is fresh when History tab or Our Sky modal is opened (returns in 0ms if already cached)
  useEffect(() => {
    if ((activeTab === 'history' || isStreakModalOpen) && appState.couple.id) {
      apiClient.fetchHistory(appState.couple.id, true).then((history) => {
        if (history && history.length > 0) {
          setAppState((prev) => {
            const prevCount = prev.history.reduce((acc, d) => acc + (d.moments?.length || 0), 0);
            const nextCount = history.reduce((acc, d) => acc + (d.moments?.length || 0), 0);
            if (
              prev.history.length === history.length &&
              prevCount === nextCount &&
              prev.history[0]?.id === history[0]?.id &&
              prev.history[prev.history.length - 1]?.id === history[history.length - 1]?.id
            ) {
              return prev; // History identical -> avoid full app re-render
            }
            return {
              ...prev,
              history,
            };
          });
        }
      }).catch((err) => {
        console.warn('[OURS] Failed to sync history on tab open:', err);
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

  // Retrieve calendar days with completed/conducted dates
  const completedDateDays = useMemo(() => {
    return dateInvitationService.getCompletedDateDays();
  }, [hasUnreadDateInvitation]);

  // All authoritative star events with exact type (Match ⭐ vs Date ✨) directly linked to memories
  const allStarEvents = useMemo(() => {
    return getCoupleStarEvents(
      appState.couple,
      appState.todayMoments,
      appState.history,
      completedDateDays
    );
  }, [appState.couple, appState.todayMoments, appState.history, completedDateDays]);

  // All deduplicated sky dates (strictly cumulative & persistent across reloads/device/plans)
  const allSkyDates = useMemo(() => {
    return allStarEvents.map((e) => e.dateKey);
  }, [allStarEvents]);

  // Current month's stars in the active constellation
  const currentMonthStarEvents = useMemo(() => {
    const now = new Date();
    return getStarEventsForMonth(allStarEvents, now.getFullYear(), now.getMonth() + 1);
  }, [allStarEvents]);

  const currentMonthSkyDates = useMemo(() => {
    return currentMonthStarEvents.map((e) => e.dateKey);
  }, [currentMonthStarEvents]);

  const monthStarsCount = currentMonthStarEvents.length;

  // Matched dates extracted from real history & today's moments
  const matchedDates = allSkyDates;

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
        const partnerName = (res.pair.partner.name && res.pair.partner.name !== 'Партнёр')
          ? res.pair.partner.name
          : (appState.couple.partner.name && appState.couple.partner.name !== 'Партнёр')
            ? appState.couple.partner.name
            : (res.pair.partner.name || 'Партнёр');

        const partnerAvatar = res.pair.partner.avatarUrl || appState.couple.partner.avatarUrl || null;

        const updatedCouple = {
          ...res.pair,
          partner: {
            ...res.pair.partner,
            name: partnerName,
            avatarUrl: partnerAvatar,
          },
          pairSeed: pairSeedVal,
        };

        setAppState((prev) => {
          const nextState: AppState = {
            ...prev,
            hasCompletedOnboarding: Boolean(options?.isJoin || options?.isRestore),
            couple: updatedCouple,
            todayMoments: res.moments || prev.todayMoments,
            activeMomentId: resolveAuthoritativeActiveMomentId(
              res.moments || prev.todayMoments,
              getSynchronizedNow(),
              prev.activeMomentId
            ),
            history: res.history || [],
          };
          saveAppState(nextState);
          return nextState;
        });

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
                // Strictly preserve existing photos: never overwrite an existing photo with null or local blob
                const sanitizePhoto = (u: string | null | undefined): string | null => {
                  if (!u || typeof u !== 'string' || u.startsWith('blob:')) return null;
                  return u;
                };

                const userPhoto = sanitizePhoto(uploadedM.userPhoto) || sanitizePhoto(updated.userPhoto) || sanitizePhoto(m.userPhoto) || null;
                const partnerPhoto = sanitizePhoto(uploadedM.partnerPhoto) || sanitizePhoto(m.partnerPhoto) || sanitizePhoto(updated.partnerPhoto) || null;
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
      } else {
        // Revert optimistic photo if upload failed so user does not see false success
        console.warn('[OURS] Photo upload failed, reverting state');
        setAppState((prev) => ({
          ...prev,
          todayMoments: prev.todayMoments.map((m) =>
            m.id === updated.id || m.order === updated.order
              ? { ...m, userPhoto: null, status: 'EMPTY' }
              : m
          ),
        }));
      }
    }
  } catch (err) {
    console.error('[OURS] Failed to sync moment update:', err);
    // Revert optimistic photo on network error
    if (updated.userPhoto) {
      setAppState((prev) => ({
        ...prev,
        todayMoments: prev.todayMoments.map((m) =>
          m.id === updated.id || m.order === updated.order
            ? { ...m, userPhoto: null, status: 'EMPTY' }
            : m
        ),
      }));
    }
  }
};

  // Switch active moment
  const handleSelectActiveMoment = useCallback((momentId: string) => {
    setAppState((prev) => {
      if (prev.activeMomentId === momentId) return prev;
      const nextState: AppState = {
        ...prev,
        activeMomentId: momentId,
      };
      saveAppState(nextState);
      return nextState;
    });
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
    setAppState((prev) => {
      const nextState: AppState = {
        ...prev,
        couple: {
          ...prev.couple,
          user: {
            ...prev.couple.user,
            ...updated,
          },
        },
      };
      saveAppState(nextState);
      return nextState;
    });

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

  return (
    <ThemeProvider
      initialTheme={appState.settings.theme}
      onThemePersist={handleUpdateTheme}
    >
      {!appState.hasCompletedOnboarding ? (
        <React.Suspense fallback={<div className="min-h-screen bg-[#000000]" />}>
          <OnboardingFlow
            onComplete={handleOnboardingComplete}
            onFinish={handleFinishOnboarding}
          />
        </React.Suspense>
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
              starsCount={monthStarsCount}
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
                  date: () => (
                    <React.Suspense fallback={<TabLoadingFallback />}>
                      <DateScreen
                        couple={appState.couple}
                        soundEnabled={appState.settings.sounds}
                        hapticEnabled={appState.settings.haptic}
                      />
                    </React.Suspense>
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
                      isActive={activeTab === 'today'}
                    />
                  ),
                  history: () => (
                    <React.Suspense fallback={<TabLoadingFallback />}>
                      <HistoryScreen
                        history={appState.history}
                        todayMoments={appState.todayMoments}
                        couple={appState.couple}
                        onOpenLovely={() => setIsLovelyModalOpen(true)}
                        onOpenPremium={() => setIsLovelyModalOpen(true)}
                        onNavigateToToday={() => setActiveTab('today')}
                      />
                    </React.Suspense>
                  ),
                  profile: () => (
                    <React.Suspense fallback={<TabLoadingFallback />}>
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
                    </React.Suspense>
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
            {isLovelyModalOpen && (
              <React.Suspense fallback={null}>
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
              </React.Suspense>
            )}

            {/* «Наше небо» Modal */}
            {isStreakModalOpen && (
              <React.Suspense fallback={null}>
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
              </React.Suspense>
            )}

            {/* User Profile Editor Modal */}
            {isEditProfileOpen && (
              <React.Suspense fallback={null}>
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
              </React.Suspense>
            )}

            {/* Legal Documents Screen (Terms of Service / Privacy Policy) */}
            {Boolean(activeLegalDoc) && (
              <React.Suspense fallback={null}>
                <LegalScreen
                  document={activeLegalDoc}
                  onClose={() => setActiveLegalDoc(null)}
                />
              </React.Suspense>
            )}
          </div>
        </div>
      )}
    </ThemeProvider>
  );
}
