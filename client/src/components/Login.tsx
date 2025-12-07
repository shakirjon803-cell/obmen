import { useState } from 'react';
import { useStore } from '@/hooks/useStore';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { motion } from 'framer-motion';
import { User, Lock, Eye, EyeOff, ArrowLeft, RefreshCw } from 'lucide-react';

const API_BASE = '';

export function Login() {
  const { closeLogin, setRegistration, completeRegistration } = useStore();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

      if (data.error === 'invalid_credentials') {
        setError('Неверный ник или пароль');
        return;
      }
      if (data.error) {
        setError('Ошибка входа');
        return;
      }

      // Success
      setRegistration({
        name: data.name,
        verified: data.telegram_linked,
        completed: true
      });
      completeRegistration();
    } catch (e) {
      setError('Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

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
        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm"
      >
        <ArrowLeft size={16} />
        Назад
      </button>

      <div>
        <h2 className="text-2xl font-bold mb-2">Вход</h2>
        <p className="text-sm text-gray-500">Введите данные аккаунта</p>
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
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl"
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
              className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        <Button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium"
        >
          {isLoading ? <RefreshCw className="animate-spin" size={18} /> : 'Войти'}
        </Button>
      </div>

      <p className="text-center text-sm text-gray-500">
        Нет аккаунта?{' '}
        <button onClick={closeLogin} className="text-gray-900 font-medium">
          Создать
        </button>
      </p>
    </motion.div>
  );
}
