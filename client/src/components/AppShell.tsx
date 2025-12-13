import { useStore } from '@/hooks/useStore';
import { Header } from './Header';
import { TabBar } from './TabBar';
import { Registration } from './Registration';
import { Login } from './Login';
import { Feed } from './Feed';
import { CreateRequest } from './CreateRequest';
import { Offers } from './Offers';
import { Profile } from './Profile';
import { Onboarding } from './Onboarding';
import { AddPostSheet } from './AddPostSheet';
import { EditPostSheet } from './EditPostSheet';
import { PostPage } from './PostPage';
import { UserPage } from './UserPage';
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Helper to safely check localStorage
function checkLocalStorage(): { hasOnboarding: boolean; hasRegistration: boolean; hasAccount: boolean } {
  try {
    const data = localStorage.getItem('obmen-storage');
    if (!data) return { hasOnboarding: false, hasRegistration: false, hasAccount: false };

    const parsed = JSON.parse(data);
    const state = parsed?.state || {};

    return {
      hasOnboarding: state.onboardingSeen === true,
      hasRegistration: state.registration?.completed === true || state.registration?.verified === true,
      hasAccount: state.hasAccount === true
    };
  } catch {
    return { hasOnboarding: false, hasRegistration: false, hasAccount: false };
  }
}

export function AppShell() {
  const { activeTab, registration, onboardingSeen, loginMode, hasAccount, setTelegramUser, fetchMarketPosts // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } = useStore();
  const location = useLocation();

  // Check localStorage ONCE on mount
  const localData = React.useMemo(() => checkLocalStorage(), []);

  React.useEffect(() => {
    // Non-blocking - all async
    useStore.getState().fetchConfig();
    fetchMarketPosts();

    // Load avatar from server if user has accountId
    useStore.getState().loadAccountAvatar();

    // Get Telegram user data
    try {
      const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
      if (tgUser) {
        setTelegramUser({
          id: tgUser.id,
          username: tgUser.username ? `@${tgUser.username}` : undefined,
          name: tgUser.first_name
        });
      }
    } catch {
      // Silent fail
    }
  }, []);

  // Combine zustand state with localStorage fallback
  const isRegistered = registration.completed === true || registration.verified === true || hasAccount;
  const hasSeenOnboarding = onboardingSeen || localData.hasOnboarding;
  const hasRegistration = isRegistered || localData.hasRegistration || localData.hasAccount;

  // Show onboarding first (only if truly not seen)
  if (!hasSeenOnboarding) {
    return <Onboarding />;
  }

  // Show login modal if requested
  if (loginMode) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-md mx-auto pt-14 pb-20 px-4">
          <Login />
        </div>
      </div>
    );
  }

  // Check if we're on a sub-page (post or user)
  const isSubPage = location.pathname.startsWith('/post/') || location.pathname.startsWith('/user/');

  // GUEST MODE: Allow browsing without registration!
  // Only require auth for: create, offers (for exchangers), profile actions
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-md mx-auto pt-14 pb-24 px-4">
        <Routes>
          <Route path="/post/:id" element={<PostPage />} />
          <Route path="/user/:id" element={<UserPage />} />
          <Route path="*" element={
            <AnimatePresence mode="wait">
              {activeTab === 'feed' && <Feed key="feed" />}
              {activeTab === 'create' && (
                hasRegistration ? <CreateRequest key="create" /> : <Registration key="register" />
              )}
              {activeTab === 'offers' && (
                hasRegistration ? <Offers key="offers" /> : <Registration key="register" />
              )}
              {activeTab === 'profile' && (
                hasRegistration ? <Profile key="profile" /> : <Registration key="register" />
              )}
            </AnimatePresence>
          } />
        </Routes>
      </div>
      {!isSubPage && <TabBar />}
      <AddPostSheet />
      <EditPostSheet />
    </div>
  );
}
