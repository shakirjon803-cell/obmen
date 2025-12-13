import { useState } from 'react';
import { useStore } from '@/hooks/useStore';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { motion } from 'framer-motion';
import { User, Lock, Eye, EyeOff, ArrowLeft, Loader2, MessageCircle, Sparkles, PartyPopper, Check } from 'lucide-react';

const API_BASE = '';

// Confetti component
function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{
            y: -20,
            x: Math.random() * window.innerWidth,
            rotate: 0,
            opacity: 1,
            scale: Math.random() * 0.5 + 0.5
          }}
          animate={{
            y: window.innerHeight + 50,
            rotate: Math.random() * 720,
            opacity: 0
          }}
          transition={{
            duration: 2.5 + Math.random() * 1.5,
            delay: Math.random() * 0.3,
            ease: 'easeOut'
          }}
          className="absolute w-3 h-3 rounded-sm"
          style={{
            backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'][i % 7]
          }}
        />
      ))}
    </div>
  );
}

export function Login() {
  const { closeLogin, setRegistration, completeRegistration, botUsername, setRole, setTelegramUser } = useStore();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [userName, setUserName] = useState('');
  const [isFirstLogin, setIsFirstLogin] = useState(true);


  const handleLogin = async () => {
    setError('');

    if (!nickname.trim()) {
      setError('Введите ник');
      return;
    }
    if (!password) {
      setError('Введите пароль');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), password })
      });

      const data = await res.json();

      // Handle error responses (401, etc.)
      if (!res.ok || data.error) {
        if (data.error === 'invalid_credentials' || res.status === 401) {
          setError('Неверный ник или пароль');
        } else {
          setError('Ошибка входа');
        }
        setIsLoading(false);
        return;
      }

      setUserName(data.name || nickname);

      // Check if user has logged in before
      const hasLoggedInBefore = localStorage.getItem(`logged_in_${nickname.toLowerCase()}`);
      setIsFirstLogin(!hasLoggedInBefore);
      localStorage.setItem(`logged_in_${nickname.toLowerCase()}`, 'true');

      // Determine role from server response
      const userRole = data.is_seller ? 'exchanger' : (data.role || 'client');

      // CRITICAL: Save to localStorage FIRST before any state updates
      // NOTE: Don't save avatarUrl - it's base64 and can overflow localStorage!
      try {
        const currentStorage = localStorage.getItem('obmen-storage');
        const parsed = currentStorage ? JSON.parse(currentStorage) : { state: {}, version: 0 };

        parsed.state = {
          ...parsed.state,
          registration: {
            ...(parsed.state?.registration || {}),
            name: data.name || nickname,
            verified: true,
            completed: true,
            telegramId: data.telegram_id,
            accountId: data.account_id,
            role: userRole
            // avatarUrl NOT saved - too big for localStorage
          },
          hasAccount: true,
          role: userRole,
          loginMode: false,
          onboardingSeen: true,
          userId: data.telegram_id || parsed.state?.userId
        };

        localStorage.setItem('obmen-storage', JSON.stringify(parsed));
      } catch (e) {
        console.error('Failed to save to localStorage', e);
      }

      // Set user data in zustand
      if (data.telegram_id) {
        setTelegramUser({ id: data.telegram_id, name: data.name || nickname });
      }

      setRegistration({
        name: data.name || nickname,
        verified: true,
        completed: true,
        telegramId: data.telegram_id,
        accountId: data.account_id,
        role: userRole,
        avatarUrl: data.avatar_url,
        originalAvatarUrl: data.original_avatar_url // For re-editing avatar
      });
      setRole(userRole);
      completeRegistration();

      // Show success briefly then redirect
      setShowSuccess(true);

      // Immediate redirect - localStorage is already saved
      setTimeout(() => {
        window.location.replace('/');
      }, 800);

    } catch (e: any) {
      console.error('Login error:', e);
      // Show more specific error if available
      if (e.message?.includes('Failed to fetch')) {
        setError('Сервер недоступен');
      } else {
        setError('Ошибка: ' + (e.message || 'неизвестная'));
      }
      setIsLoading(false);
    }
  };

  const handleOpenBot = () => {
    const username = botUsername || 'malxamibot';
    window.open(`https://t.me/${username}`, '_blank');
  };

  // Success screen
  if (showSuccess) {
    return (
      <>
        <Confetti />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-12"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="relative mb-6"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="w-24 h-24 rounded-3xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-2xl"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}>
                <Check size={48} className="text-white" strokeWidth={3} />
              </motion.div>
            </motion.div>
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.6 }} className="absolute -top-2 -right-2">
              <Sparkles size={24} className="text-yellow-400" />
            </motion.div>
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.8 }} className="absolute -bottom-1 -left-2">
              <PartyPopper size={20} className="text-pink-500" />
            </motion.div>
          </motion.div>

          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="text-2xl font-bold text-gray-900 mb-2">
            {isFirstLogin ? 'Добро пожаловать!' : 'С возвращением!'}
          </motion.h2>

          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="text-gray-500 text-lg">
            {userName}
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-6 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" />
            Загружаем ленту...
          </motion.div>
        </motion.div>
      </>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="space-y-6"
    >
      {/* Back button */}
      <button
        onClick={closeLogin}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm transition-colors"
      >
        <ArrowLeft size={16} />
        Назад
      </button>

      <div>
        <h2 className="text-2xl font-bold mb-2">Вход</h2>
        <p className="text-sm text-gray-500">Введите данные, полученные в боте</p>
      </div>

      <div className="space-y-4">
        {/* Nickname */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Ник (логин)</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/\s/g, ''))}
              placeholder="nickname"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Пароль</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900/10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-500 text-sm text-center bg-red-50 py-2 px-3 rounded-lg"
          >
            {error}
          </motion.p>
        )}

        <Button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-colors"
        >
          {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Войти'}
        </Button>
      </div>

      {/* Register via bot link */}
      <div className="text-center space-y-3 pt-2">
        <p className="text-sm text-gray-500">
          Нет аккаунта?
        </p>
        <button
          onClick={handleOpenBot}
          className="flex items-center justify-center gap-2 w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-medium transition-colors"
        >
          <MessageCircle size={18} />
          Зарегистрироваться в боте
        </button>
        <p className="text-xs text-gray-400">
          @{botUsername || 'malxamibot'}
        </p>
      </div>
    </motion.div>
  );
}
