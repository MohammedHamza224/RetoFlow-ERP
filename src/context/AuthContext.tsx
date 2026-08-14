import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { AuthService, UserProfile } from '@/services/auth.service';
import { UserRole } from '@/types/database.types';

export interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (name: string) => Promise<void>;
  isAllowed: (moduleId: string) => boolean;
  switchDemoRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function initAuth() {
      try {
        const profile = await AuthService.getCurrentUserProfile();
        if (profile) {
          setUser(profile);
        }
      } catch (e) {
        console.warn('[AuthContext] Session init error:', e);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  const login = useCallback(async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const profile = await AuthService.login(email, password);
      setUser(profile);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await AuthService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateUserProfile = useCallback(async (newName: string) => {
    if (!user) throw new Error('User is not authenticated.');
    const updated = await AuthService.updateUserProfile(user.id, newName);
    setUser(updated);
  }, [user]);

  const switchDemoRole = useCallback(async (role: UserRole) => {
    if (!user) return;
    
    // 1. Optimistic UI update for instant role switching without freezing
    setUser(prev => prev ? { ...prev, role_name: role } : null);
    
    // 2. Perform the actual backend authentication asynchronously in the background
    // This ensures Supabase RLS policies and tokens match the new role
    // without blocking the user interface or triggering loading spinners.
    try {
      const roleEmailMap: Record<UserRole, string> = {
        ADMIN: 'admin@restoflow.sa',
        MANAGER: 'manager@restoflow.sa',
        CASHIER: 'cashier@restoflow.sa',
        STAFF: 'staff@restoflow.sa',
      };
      
      AuthService.login(roleEmailMap[role])
        .then(profile => {
          // Update the full profile silently once backend confirms
          setUser(profile);
        })
        .catch(err => console.error("Background role switch failed:", err));
    } catch (err) {
      console.error("Role switch preparation failed", err);
    }
  }, [user]);

  const isAllowed = useCallback((moduleId: string): boolean => {
    if (!user) return false;
    return AuthService.isModuleAllowed(user.role_name, moduleId);
  }, [user]);

  const contextValue = useMemo(() => ({
    user,
    isLoading,
    login,
    logout,
    updateUserProfile,
    isAllowed,
    switchDemoRole,
  }), [user, isLoading, login, logout, updateUserProfile, isAllowed, switchDemoRole]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
