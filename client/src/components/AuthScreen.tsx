/**
 * AuthScreen - Login/Registration screen
 * 
 * Replaces old phone verification with nickname/password auth
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, User, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/hooks/useStore';

interface AuthScreenProps {
    onSuccess: () => void;
    onBack?: () => void;
}

export function AuthScreen({ onSuccess, onBack }: AuthScreenProps) {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [nickname, setNickname] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
    const [checkingNickname, setCheckingNickname] = useState(false);

    const { login, register, isLoading, error, clearError, checkNickname } = useAuth();
    const { setRegistration, setRole } = useStore();

    // Check nickname availability (for registration)
    const handleNicknameBlur = async () => {
        if (mode === 'register' && nickname.length >= 3) {
            setCheckingNickname(true);
            const available = await checkNickname(nickname);
            setNicknameAvailable(available);
            setCheckingNickname(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        if (mode === 'register') {
            if (password !== confirmPassword) {
                return; // Show error
            }

            const success = await register({
                nickname,
                password,
                name: name || nickname,
            });

            if (success) {
                setRegistration({ name: name || nickname, username: nickname });
                setRole('client');
                onSuccess();
            }
        } else {
            const success = await login(nickname, password);
            if (success) {
                onSuccess();
            }
        }
    };

    const isFormValid = mode === 'login'
        ? nickname.length >= 3 && password.length >= 4
        : nickname.length >= 3 && password.length >= 4 && password === confirmPassword && nicknameAvailable;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-6 flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 text-white/60 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                )}
                <div className="flex-1" />
            </div>

            {/* Logo & Title */}
            <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl font-bold text-white">N</span>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">
                    {mode === 'login' ? 'Вход в NellX' : 'Создать аккаунт'}
                </h1>
                <p className="text-white/60 text-sm">
                    {mode === 'login'
                        ? 'Введите данные для входа'
                        : 'Придумайте никнейм и пароль'
                    }
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 space-y-4">
                {/* Name field (register only) */}
                <AnimatePresence>
                    {mode === 'register' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <div className="relative">
                                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ваше имя (необязательно)"
                                    className="w-full bg-white/10 text-white placeholder-white/40 pl-12 pr-4 py-4 rounded-2xl border border-white/10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Nickname */}
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">@</span>
                    <input
                        type="text"
                        value={nickname}
                        onChange={(e) => {
                            setNickname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                            setNicknameAvailable(null);
                        }}
                        onBlur={handleNicknameBlur}
                        placeholder="Никнейм"
                        className="w-full bg-white/10 text-white placeholder-white/40 pl-10 pr-12 py-4 rounded-2xl border border-white/10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    {mode === 'register' && nickname.length >= 3 && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            {checkingNickname ? (
                                <div className="w-5 h-5 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                            ) : nicknameAvailable === true ? (
                                <CheckCircle size={20} className="text-green-500" />
                            ) : nicknameAvailable === false ? (
                                <AlertCircle size={20} className="text-red-500" />
                            ) : null}
                        </div>
                    )}
                </div>
                {mode === 'register' && nicknameAvailable === false && (
                    <p className="text-red-400 text-xs -mt-2 ml-2">Этот никнейм уже занят</p>
                )}

                {/* Password */}
                <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Пароль"
                        className="w-full bg-white/10 text-white placeholder-white/40 pl-12 pr-12 py-4 rounded-2xl border border-white/10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40"
                    >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>

                {/* Confirm Password (register only) */}
                <AnimatePresence>
                    {mode === 'register' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Подтвердите пароль"
                                    className={`w-full bg-white/10 text-white placeholder-white/40 pl-12 pr-4 py-4 rounded-2xl border transition-all ${confirmPassword && confirmPassword !== password
                                            ? 'border-red-500'
                                            : 'border-white/10 focus:border-blue-500'
                                        }`}
                                />
                            </div>
                            {confirmPassword && confirmPassword !== password && (
                                <p className="text-red-400 text-xs mt-1 ml-2">Пароли не совпадают</p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Error message */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 flex items-center gap-2"
                    >
                        <AlertCircle size={18} className="text-red-400" />
                        <span className="text-red-300 text-sm">{error}</span>
                    </motion.div>
                )}

                {/* Submit button */}
                <motion.button
                    type="submit"
                    disabled={!isFormValid || isLoading}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all ${isFormValid && !isLoading
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-white/10 text-white/40'
                        }`}
                >
                    {isLoading ? (
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : mode === 'login' ? (
                        'Войти'
                    ) : (
                        'Зарегистрироваться'
                    )}
                </motion.button>

                {/* Toggle mode */}
                <div className="text-center">
                    <button
                        type="button"
                        onClick={() => {
                            setMode(mode === 'login' ? 'register' : 'login');
                            clearError();
                        }}
                        className="text-white/60 text-sm hover:text-white transition-colors"
                    >
                        {mode === 'login' ? (
                            <>
                                Нет аккаунта? <span className="text-blue-400">Зарегистрироваться</span>
                            </>
                        ) : (
                            <>
                                Уже есть аккаунт? <span className="text-blue-400">Войти</span>
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Terms */}
            {mode === 'register' && (
                <p className="text-white/40 text-xs text-center mt-4">
                    Регистрируясь, вы соглашаетесь с{' '}
                    <a href="#" className="text-blue-400">условиями использования</a>
                </p>
            )}
        </motion.div>
    );
}

export default AuthScreen;
