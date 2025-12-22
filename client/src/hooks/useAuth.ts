/**
 * useAuth Hook - Authentication state management
 * 
 * Provides:
 * - Login/logout state
 * - Current user info
 * - Token management
 * - Auth validation
 */

import { useState, useEffect, useCallback } from 'react';
import {
    authApi,
    usersApi,
    getToken,
    getSavedUser,
    clearToken,
    User,
    TokenResponse,
} from '@/lib/api';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        user: getSavedUser(),
        isAuthenticated: !!getToken(),
        isLoading: true,
        error: null,
    });

    // Validate token on mount
    useEffect(() => {
        const validateToken = async () => {
            const token = getToken();
            if (!token) {
                setState(prev => ({ ...prev, isLoading: false }));
                return;
            }

            try {
                const user = await usersApi.getMe();
                setState({
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                });
            } catch (error: any) {
                // Token invalid
                clearToken();
                setState({
                    user: null,
                    isAuthenticated: false,
                    isLoading: false,
                    error: null,
                });
            }
        };

        validateToken();

        // Listen for logout events from API client
        const handleLogout = () => {
            setState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
            });
        };

        window.addEventListener('auth:logout', handleLogout);
        return () => window.removeEventListener('auth:logout', handleLogout);
    }, []);

    const register = useCallback(async (data: {
        nickname: string;
        password: string;
        name?: string;
        phone?: string;
    }): Promise<boolean> => {
        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            const result = await authApi.register(data);

            setState({
                user: result.user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            });

            return true;
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error.detail || error.message,
            }));
            return false;
        }
    }, []);

    const login = useCallback(async (
        nickname: string,
        password: string
    ): Promise<boolean> => {
        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            const result = await authApi.login(nickname, password);

            setState({
                user: result.user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            });

            return true;
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error.detail || error.message,
            }));
            return false;
        }
    }, []);

    const logout = useCallback(() => {
        authApi.logout();
        setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
        });
    }, []);

    const updateProfile = useCallback(async (data: {
        name?: string;
        phone?: string;
        avatar_url?: string;
        language?: string;
    }): Promise<boolean> => {
        try {
            const updatedUser = await usersApi.updateProfile(data);
            setState(prev => ({
                ...prev,
                user: updatedUser,
            }));
            return true;
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                error: error.detail || error.message,
            }));
            return false;
        }
    }, []);

    const checkNickname = useCallback(async (nickname: string): Promise<boolean> => {
        try {
            const result = await authApi.checkNickname(nickname);
            return result.available;
        } catch (error) {
            return false;
        }
    }, []);

    const clearError = useCallback(() => {
        setState(prev => ({ ...prev, error: null }));
    }, []);

    return {
        ...state,
        register,
        login,
        logout,
        updateProfile,
        checkNickname,
        clearError,
    };
}

export default useAuth;
