import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AppState,
  getInitialAppState,
  saveAppState,
  createDemoAppState,
} from './services/mockStorage';
import { NavigationTab, Moment, AppSettings, UserProfile, ThemeMode } from './types';
import { apiClient } from './services/api/apiClient';
import { ThemeProvider } from './services/theme/ThemeContext';
import { CoupleHeader } from './components/CoupleHeader';
import { BottomTabBar } from './components/BottomTabBar';
import { DevControls } from './components/DevControls';
import { LovelyModal } from './components/LovelyModal';
import { OurSkyModal } from './components/OurSkyModal';
import { DevSkyTesterModal } from './components/DevSkyTesterModal';
import { EditProfileModal } from './components/EditProfileModal';
import { OnboardingFlow } from './components/OnboardingFlow';
import { TodayScreen } from './screens/TodayScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { PARTNER_SAMPLE_PHOTOS } from './services/samplePhotos';
import { playSoftChime, triggerHaptic } from './services/feedback';
import { calculateCoupleStreak } from './services/streak/streakService';
import { syncAppStateForDate } from './services/moments/momentTiming';
import { getCoupleMatchedDates, createSimulatedSkyHistory } from './services/sky/skyService';
import { getCoupleSeed } from './services/fingerprint/fingerprintHistory';

export default function App() {
  const [appState, setAppState] = useState<AppState>(getInitialAppState);
  const [activeTab, setActiveTab] = useState<NavigationTab>('today');
  const [isLovelyModalOpen, setIsLovelyModalOpen] = useState(false);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [isSkyTesterOpen, setIsSkyTesterOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);

  const isDemoModeRef = useRef<boolean>(false);

  // 1. Initialize anonymous session and restore multi-device state
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const session = await apiClient.initSession();
        if (!isMounted) return;

        if (session.hasCompletedOnboarding && session.pair) {
          setAppState((prev) => ({
            ...prev,
            hasCompletedOnboarding: true,
            couple: session.pair!,
            todayMoments:
              session.moments && session.moments.length > 0
                ? session.moments
                : prev.todayMoments,
            activeMomentId: session.moments?.[0]?.id || prev.activeMomentId,
            history: session.history || [],
          }));
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

  // 2. Multi-device live polling to synchronize pair status, partner photos, and reactions
  useEffect(() => {
    if (!appState.hasCompletedOnboarding || !appState.couple.id || isDemoModeRef.current) {
      return;
    }

    let isPolling = false;

    const pollState = async () => {
      if (document.hidden || isPolling) return;
      isPolling = true;

      try {
        const res = await apiClient.fetchPairState();
        if (res.success && res.pair) {
          setAppState((prev) => {
            const moments = res.moments && res.moments.length > 0 ? res.moments : prev.todayMoments;
            const validActiveId = moments.find((m) => m.id === prev.activeMomentId)
              ? prev.activeMomentId
              : moments[0]?.id || prev.activeMomentId;

            return {
              ...prev,
              couple: {
                ...res.pair!,
                // preserve local seed if present
                pairSeed: prev.couple.pairSeed || res.pair!.pairSeed,
              },
              todayMoments: moments,
              activeMomentId: validActiveId,
              history: res.history || prev.history,
            };
          });
        }
      } catch (err) {
        // Silent catch for brief network drop
      } finally {
        isPolling = false;
      }
    };

    const interval = setInterval(pollState, 2500);
    window.addEventListener('focus', pollState);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', pollState);
    };
  }, [appState.hasCompletedOnboarding, appState.couple.id]);

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
    const interval = setInterval(handleDateSync, 30000);

    return () => {
      window.removeEventListener('focus', handleDateSync);
      clearInterval(interval);
    };
  }, []);

  // Joint streak and history statistics
  const streakInfo = useMemo(() => {
    return calculateCoupleStreak(appState.todayMoments, appState.history);
  }, [appState.todayMoments, appState.history]);

  // Couple matched dates for «Наше небо» (1 calendar day with match = 1 star)
  const matchedDates = useMemo(() => {
    return getCoupleMatchedDates(appState.couple, appState.todayMoments, appState.history);
  }, [appState.couple, appState.todayMoments, appState.history]);

  const pairSeed = appState.couple.pairSeed || getCoupleSeed(appState.couple);

  // Handle Onboarding Completion (Create Pair or Join Pair)
  const handleOnboardingComplete = async (
    userName: string,
    options?: { isJoin?: boolean; inviteCode?: string }
  ) => {
    try {
      let res;
      if (options?.isJoin && options.inviteCode) {
        res = await apiClient.joinPair(userName, options.inviteCode);
      } else {
        res = await apiClient.createPair(userName);
      }

      if (res.success && res.pair) {
        const partnerName = res.pair.partner?.name || 'Партнёр';
        const pairSeedVal = `${res.pair.inviteCode || 'OURS'}-${userName}-${partnerName}`
          .toLowerCase()
          .replace(/\s+/g, '-');

        setAppState((prev) => ({
          ...prev,
          hasCompletedOnboarding: Boolean(options?.isJoin),
          couple: {
            ...res.pair!,
            pairSeed: pairSeedVal,
          },
          todayMoments: res.moments || prev.todayMoments,
          activeMomentId: res.moments?.[0]?.id || prev.activeMomentId,
          history: res.history || [],
        }));

        if (options?.isJoin) {
          setActiveTab('today');
        }

        return {
          success: true,
          inviteCode: res.pair.inviteCode,
          pairId: res.pair.id,
        };
      }
      return { success: false, error: 'Не удалось создать пару' };
    } catch (err: any) {
      console.error('Onboarding complete error:', err);
      return { success: false, error: err.message || 'Ошибка соединения' };
    }
  };

  const handleFinishOnboarding = () => {
    setAppState((prev) => ({
      ...prev,
      hasCompletedOnboarding: true,
    }));
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

    if (isDemoModeRef.current) return;

    try {
      if (updated.status === 'COMPLETED') {
        const res = await apiClient.completeMoment(updated.id);
        if (res.success && res.moment) {
          const completedM = res.moment;
          setAppState((prev) => ({
            ...prev,
            todayMoments: prev.todayMoments.map((m) => (m.id === completedM.id ? completedM : m)),
          }));
        }
      } else if (updated.status === 'REVEALED') {
        await apiClient.revealMoment(updated.id);
      } else if (updated.userReaction) {
        await apiClient.submitReaction(updated.id, updated.userReaction);
      } else if (updated.userPhoto) {
        await apiClient.uploadPhoto(updated.id, updated.userPhoto);
      }
    } catch (err) {
      console.error('[OURS] Failed to sync moment update:', err);
    }
  };

  // Switch active moment
  const handleSelectActiveMoment = (momentId: string) => {
    setAppState((prev) => ({
      ...prev,
      activeMomentId: momentId,
    }));
  };

  // Update App Settings
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setAppState((prev) => ({
      ...prev,
      settings: newSettings,
    }));
  };

  // Update Theme mode specifically
  const handleUpdateTheme = (theme: ThemeMode) => {
    setAppState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme,
      },
    }));
  };

  // One-time purchase for the couple: LOVELY ♡
  const handlePurchaseLovely = async () => {
    const purchasedAt = new Date().toISOString();
    setAppState((prev) => ({
      ...prev,
      couple: {
        ...prev.couple,
        isLovely: true,
        lovelyPurchasedAt: purchasedAt,
        subscription: 'premium',
      },
      history: prev.history.map((h) => ({ ...h, isLocked: false })),
    }));

    if (!isDemoModeRef.current) {
      try {
        await apiClient.purchaseLovely();
      } catch (err) {
        console.error('[OURS] Failed to sync LOVELY purchase:', err);
      }
    }

    playSoftChime('success', appState.settings.sounds);
    triggerHaptic(appState.settings.haptic);
  };

  // Reset LOVELY status for demo testing
  const handleResetLovely = async () => {
    setAppState((prev) => ({
      ...prev,
      couple: {
        ...prev.couple,
        isLovely: false,
        lovelyPurchasedAt: undefined,
        subscription: 'free',
        subscriptionTariff: undefined,
      },
      history: prev.history.map((h, i) => ({ ...h, isLocked: i > 2 })),
    }));

    if (!isDemoModeRef.current) {
      try {
        await apiClient.resetLovely();
      } catch (err) {
        console.error('[OURS] Failed to reset LOVELY:', err);
      }
    }

    playSoftChime('tap', appState.settings.sounds);
    triggerHaptic(appState.settings.haptic);
  };

  const handleToggleLovely = () => {
    if (appState.couple.isLovely || appState.couple.subscription === 'premium') {
      handleResetLovely();
    } else {
      handlePurchaseLovely();
    }
  };

  // Update Current User Profile (Name & Photo)
  const handleSaveProfile = async (updated: Partial<UserProfile>) => {
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

    if (!isDemoModeRef.current) {
      try {
        await apiClient.updateProfile({
          name: updated.name,
          avatarUrl: updated.avatarUrl,
          avatarColor: updated.avatarColor,
        });
      } catch (err) {
        console.error('[OURS] Failed to save profile:', err);
      }
    }
  };

  // Simulate Partner Upload for testing (Moment Duo)
  const handleSimulatePartnerUpload = () => {
    const activeMoment =
      appState.todayMoments.find((m) => m.id === appState.activeMomentId) ||
      appState.todayMoments[0];

    if (!activeMoment) return;

    const partnerPhotoUrl =
      PARTNER_SAMPLE_PHOTOS[(activeMoment.order - 1) % PARTNER_SAMPLE_PHOTOS.length];

    const nowIso = new Date().toISOString();
    const userPhotoItem = activeMoment.userPhoto
      ? [
          {
            userId: appState.couple.user.id || 'user-a-default',
            imageUrl: activeMoment.userPhoto,
            createdAt: nowIso,
          },
        ]
      : [];
    const partnerPhotoItem = {
      userId: appState.couple.partner.id || 'user-b-default',
      imageUrl: partnerPhotoUrl,
      createdAt: nowIso,
    };

    const newPhotos = [...userPhotoItem, partnerPhotoItem];
    const newStatus = activeMoment.userPhoto ? 'BOTH_UPLOADED' : 'EMPTY';

    const updated: Moment = {
      ...activeMoment,
      partnerPhoto: partnerPhotoUrl,
      photos: newPhotos,
      status: newStatus as any,
    };

    handleUpdateMoment(updated);
    playSoftChime('tap', appState.settings.sounds);
    triggerHaptic(appState.settings.haptic);
  };

  // Fast forward cooldown by 4 hours for demo and testing
  const handleFastForwardCooldown = () => {
    setAppState((prev) => {
      const completedMoments = prev.todayMoments.filter((m) => m.status === 'COMPLETED');
      if (completedMoments.length === 0) return prev;
      const last = completedMoments[completedMoments.length - 1];
      const shiftedMoments = prev.todayMoments.map((m) => {
        if (m.id === last.id) {
          return {
            ...m,
            completedTimestamp: Date.now() - 4 * 60 * 60 * 1000 - 2000,
          };
        }
        return m;
      });
      return {
        ...prev,
        todayMoments: shiftedMoments,
      };
    });
    playSoftChime('tap', appState.settings.sounds);
    triggerHaptic(appState.settings.haptic);
  };

  // Simulate Matched Days for Sky Testing (Developer Sandbox)
  const handleUpdateSimulatedSkyDays = (count: number, year: number, month: number) => {
    setAppState((prev) => {
      const updatedHistory = createSimulatedSkyHistory(count, year, month, prev.history);
      return {
        ...prev,
        history: updatedHistory,
      };
    });
    playSoftChime('tap', appState.settings.sounds);
    triggerHaptic(appState.settings.haptic);
  };

  // Reset to default demo account
  const handleResetDay = () => {
    isDemoModeRef.current = true;
    const demoState = createDemoAppState();
    setAppState(demoState);
  };

  // Restart Onboarding (Clears user session completely to test brand new anonymous user)
  const handleRestartOnboarding = async () => {
    isDemoModeRef.current = false;
    try {
      await apiClient.resetUser();
      const session = await apiClient.initSession();
      setAppState((prev) => ({
        ...prev,
        hasCompletedOnboarding: false,
        couple: {
          id: '',
          pairSeed: '',
          user: {
            id: session.user.id,
            name: '',
            avatarColor: session.user.avatarColor,
          },
          partner: {
            id: '',
            name: 'Партнёр',
            avatarColor: '#DDEAF7',
          },
          inviteCode: '',
          connected: false,
          startDate: '',
          daysTogether: 1,
          isLovely: false,
          subscription: 'free',
        },
        todayMoments: [],
        history: [],
      }));
    } catch {
      // fallback
      setAppState((prev) => ({
        ...prev,
        hasCompletedOnboarding: false,
      }));
    }
  };

  const activeMoment =
    appState.todayMoments.find((m) => m.id === appState.activeMomentId) ||
    appState.todayMoments[0];

  const isPartnerUploaded = Boolean(activeMoment?.partnerPhoto);

  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-[#FFF9FA] dark:bg-[#000000] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#E98787] border-t-transparent animate-spin" />
          <span className="font-display text-sm font-semibold tracking-widest text-[#777277] dark:text-[#B8B2B5]">
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

            {/* Scrollable Main Viewport */}
            <main className="flex-1 px-4 pt-4 pb-2">
              <div key={activeTab} className="animate-in fade-in duration-250 ease-out">
                {activeTab === 'today' && (
                  <TodayScreen
                    couple={appState.couple}
                    moments={appState.todayMoments}
                    activeMomentId={appState.activeMomentId}
                    onSelectActiveMoment={handleSelectActiveMoment}
                    onUpdateMoment={handleUpdateMoment}
                    soundEnabled={appState.settings.sounds}
                    hapticEnabled={appState.settings.haptic}
                    streakInfo={streakInfo}
                    onOpenStreak={() => setIsStreakModalOpen(true)}
                  />
                )}

                {activeTab === 'history' && (
                  <HistoryScreen
                    history={appState.history}
                    todayMoments={appState.todayMoments}
                    couple={appState.couple}
                    onOpenLovely={() => setIsLovelyModalOpen(true)}
                    onOpenPremium={() => setIsLovelyModalOpen(true)}
                    onNavigateToToday={() => setActiveTab('today')}
                  />
                )}

                {activeTab === 'profile' && (
                  <ProfileScreen
                    couple={appState.couple}
                    settings={appState.settings}
                    onUpdateSettings={handleUpdateSettings}
                    onOpenLovely={() => setIsLovelyModalOpen(true)}
                    onOpenPremium={() => setIsLovelyModalOpen(true)}
                    onResetApp={handleResetDay}
                    streakInfo={streakInfo}
                    onOpenEditProfile={() => setIsEditProfileOpen(true)}
                    onOpenSky={() => setIsStreakModalOpen(true)}
                    onOpenFingerprint={() => setIsStreakModalOpen(true)}
                    onOpenThread={() => setIsStreakModalOpen(true)}
                  />
                )}
              </div>
            </main>

            {/* Fixed Bottom Tab Bar */}
            <BottomTabBar
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                playSoftChime('tap', appState.settings.sounds);
                triggerHaptic(appState.settings.haptic);
              }}
            />

            {/* Dev / Partner Mock Control Floating Widget */}
            <DevControls
              onSimulatePartnerUpload={handleSimulatePartnerUpload}
              onResetDay={handleResetDay}
              onRestartOnboarding={handleRestartOnboarding}
              onOpenLovely={() => setIsLovelyModalOpen(true)}
              onOpenPremium={() => setIsLovelyModalOpen(true)}
              onToggleLovely={handleToggleLovely}
              onOpenSkyTester={() => setIsSkyTesterOpen(true)}
              isLovely={Boolean(appState.couple.isLovely || appState.couple.subscription === 'premium')}
              onFastForward={handleFastForwardCooldown}
              isPartnerUploaded={isPartnerUploaded}
              canSimulate={Boolean(activeMoment)}
            />

            {/* Stage 3: Developer Sandbox for Testing «Наше небо» */}
            <DevSkyTesterModal
              isOpen={isSkyTesterOpen}
              onClose={() => setIsSkyTesterOpen(false)}
              couple={appState.couple}
              pairSeed={pairSeed}
              todayMoments={appState.todayMoments}
              history={appState.history}
              onUpdateSimulatedDays={handleUpdateSimulatedSkyDays}
              onOpenFullSky={() => setIsStreakModalOpen(true)}
            />

            {/* LOVELY One-Time Purchase Modal for the Couple */}
            <LovelyModal
              isOpen={isLovelyModalOpen}
              onClose={() => setIsLovelyModalOpen(false)}
              onPurchase={handlePurchaseLovely}
              onResetLovely={handleResetLovely}
              isLovely={Boolean(appState.couple.isLovely || appState.couple.subscription === 'premium')}
              partnerAName={appState.couple.user.name}
              partnerBName={appState.couple.partner.name}
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
          </div>
        </div>
      )}
    </ThemeProvider>
  );
}
