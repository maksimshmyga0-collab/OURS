import React, { useState, useEffect, useMemo } from 'react';
import {
  AppState,
  getInitialAppState,
  saveAppState,
  resetAppToDefault,
  resetToOnboarding,
} from './services/mockStorage';
import { NavigationTab, Moment, AppSettings, MomentPhoto, UserProfile, ThemeMode } from './types';
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

  // Sync state to local storage on changes
  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  // Check calendar date change periodically and on window focus
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


  // Handle Onboarding Completion
  const handleOnboardingComplete = (
    userName: string,
    options?: { isJoin?: boolean; inviteCode?: string }
  ) => {
    setAppState((prev) => {
      const inviteCode = options?.inviteCode || prev.couple.inviteCode || 'OURS-4821';
      const partnerName = prev.couple.partner?.name || 'Макс';
      const pairSeed = `${inviteCode}-${userName}-${partnerName}`.toLowerCase().replace(/\s+/g, '-');
      return {
        ...prev,
        hasCompletedOnboarding: true,
        couple: {
          ...prev.couple,
          pairSeed,
          user: {
            ...prev.couple.user,
            name: userName,
          },
          inviteCode,
          connected: options?.isJoin ? true : prev.couple.connected,
        },
      };
    });
    setActiveTab('today');
  };

  // Update a moment in today's moments list
  const handleUpdateMoment = (updated: Moment) => {
    setAppState((prev) => {
      const nextMoments = prev.todayMoments.map((m) =>
        m.id === updated.id ? updated : m
      );
      return {
        ...prev,
        todayMoments: nextMoments,
      };
    });
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
  const handlePurchaseLovely = () => {
    const purchasedAt = new Date().toISOString();
    setAppState((prev) => ({
      ...prev,
      couple: {
        ...prev.couple,
        isLovely: true,
        lovelyPurchasedAt: purchasedAt,
        subscription: 'premium',
      },
      // Unlock all history items
      history: prev.history.map((h) => ({ ...h, isLocked: false })),
    }));
    playSoftChime('success', appState.settings.sounds);
    triggerHaptic(appState.settings.haptic);
  };

  // Reset LOVELY status for demo testing
  const handleResetLovely = () => {
    setAppState((prev) => ({
      ...prev,
      couple: {
        ...prev.couple,
        isLovely: false,
        lovelyPurchasedAt: undefined,
        subscription: 'free',
        subscriptionTariff: undefined,
      },
      // Lock history older than 7 days
      history: prev.history.map((h, i) => ({ ...h, isLocked: i > 2 })),
    }));
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
  const handleSaveProfile = (updated: Partial<UserProfile>) => {
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
    const userPhotoItem: MomentPhoto[] = activeMoment.userPhoto
      ? [
          {
            userId: appState.couple.user.id || 'user-a-default',
            imageUrl: activeMoment.userPhoto,
            createdAt: nowIso,
          },
        ]
      : [];
    const partnerPhotoItem: MomentPhoto = {
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
      status: newStatus,
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

  // Reset to default
  const handleResetDay = () => {
    const resetState = resetAppToDefault();
    setAppState(resetState);
  };

  // Restart Onboarding
  const handleRestartOnboarding = () => {
    const onboardingState = resetToOnboarding();
    setAppState(onboardingState);
  };

  const activeMoment =
    appState.todayMoments.find((m) => m.id === appState.activeMomentId) ||
    appState.todayMoments[0];

  const isPartnerUploaded = Boolean(activeMoment?.partnerPhoto);

  return (
    <ThemeProvider
      initialTheme={appState.settings.theme}
      onThemePersist={handleUpdateTheme}
    >
      {!appState.hasCompletedOnboarding ? (
        <OnboardingFlow
          onComplete={handleOnboardingComplete}
          defaultInviteCode={appState.couple.inviteCode || 'OURS-4821'}
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
