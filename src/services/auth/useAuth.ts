import { useState, useEffect, useCallback } from 'react';
import { User } from '../../types/models';
import { authService } from './authService';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    authService.getCurrentUser().then((user) => {
      if (isMounted) {
        setCurrentUser(user);
        setIsLoading(false);
      }
    });

    const unsubscribe = authService.onAuthStateChange((user) => {
      if (isMounted) {
        setCurrentUser(user);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    const updated = await authService.updateUserProfile(updates);
    setCurrentUser(updated);
    return updated;
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setCurrentUser(null);
  }, []);

  return {
    currentUser,
    isLoading,
    updateProfile,
    signOut,
  };
}
