import { useState } from 'react';
import { useStore } from '@/hooks/useStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { User, Lock, Eye, EyeOff, ExternalLink, RefreshCw, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingScreen } from './LoadingScreen';

const API_BASE = '';

type Step = 'form' | 'verify' | 'success';

export function Registration() {
  const { setRegistration, completeRegistration, botUsername, openLogin } = useStore();

  const [step, setStep] = useState<Step>('form');
  const [nickname, setNickname] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Verification
  const [accountId, setAccountId] = useState<number | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const handleRegister = async () => {
    setError('');

    if (!nickname || nickname.length < 3) {
      setError('Ник минимум 3 символа');
      return;
    }
    if (!password || password.length < 4) {
      setError('Пароль минимум 4 символа');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          name: name.trim() || nickname.trim(),
          password
        })
      });
      const data = await res.json();

      if (data.error === 'nickname_exists') {
        setError('Этот ник уже занят');
        return;
      }
      if (data.error) {
        setError('Ошибка регистрации');
        return;
      }

      setAccountId(data.account_id);
      setStep('verify');
    } catch (e) {
      setError('Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setVerifyError('');

    if (!verifyCode || verifyCode.length < 4) {
      setVerifyError('Введите код из бота');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: verifyCode.trim(),
          account_id: accountId
        })
      });
      const data = await res.json();

      if (data.error) {
        setVerifyError('Неверный код');
        return;
      }

      // Success!
      setRegistration({
        name: name || nickname,
        verified: true,
        completed: false
      });
      setStep('success');
    } catch (e) {
      setVerifyError('Ошибка проверки');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleComplete = () => {
    setShowWelcome(true);
  };

  const onWelcomeComplete = () => {
    setShowWelcome(false);
    completeRegistration();
  };

  return (
    <>
      <LoadingScreen
        show={showWelcome}
        type="welcome"
        onComplete={onWelcomeComplete}
      />

      <AnimatePresence mode="wait">
        {step === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-5"
          >
            <div>
              <h2 className="text-2xl font-bold mb-1">Регистрация</h2>
              <p className="text-sm text-gray-500">Создайте аккаунт</p>
            </div>

            {/* Nickname */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Ник (логин)
              </label>
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

            {/* Display Name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Имя (отображаемое)
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как вас называть?"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Пароль
              </label>
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

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <Button
              onClick={handleRegister}
              disabled={isLoading}
              className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium"
            >
              {isLoading ? <RefreshCw className="animate-spin" size={18} /> : 'Создать аккаунт'}
            </Button>

            <p className="text-center text-sm text-gray-500">
              Уже есть аккаунт?{' '}
              <button onClick={openLogin} className="text-gray-900 font-medium">
                Войти
              </button>
            </p>
          </motion.div>
        )}

        {step === 'verify' && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Подтвердите аккаунт</h2>
              <p className="text-sm text-gray-500">Откройте бота чтобы получить код</p>
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center flex-shrink-0">1</span>
                <span className="text-gray-700">Откройте Telegram бота</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center flex-shrink-0">2</span>
                <span className="text-gray-700">Нажмите "Получить код" или отправьте /getcode</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center flex-shrink-0">3</span>
                <span className="text-gray-700">Поделитесь номером телефона</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center flex-shrink-0">4</span>
                <span className="text-gray-700">Введите код ниже</span>
              </div>
            </div>

            {/* Open Bot Button */}
            <button
              onClick={() => window.open(`https://t.me/${botUsername || 'malxam_proverkBot'}`, '_blank')}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <ExternalLink size={16} />
              Открыть бота
            </button>

            {/* Code Input */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Код из бота
              </label>
              <Input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-xl tracking-[0.3em] font-mono"
              />
              {verifyError && <p className="text-red-500 text-xs mt-1 text-center">{verifyError}</p>}
            </div>

            <Button
              onClick={handleVerifyCode}
              disabled={isVerifying || verifyCode.length < 4}
              className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium"
            >
              {isVerifying ? <Loader2 className="animate-spin" size={18} /> : 'Подтвердить'}
            </Button>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-5"
          >
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Check className="text-green-600" size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Аккаунт подтверждён!</h2>
              <p className="text-sm text-gray-500">Добро пожаловать, {name || nickname}</p>
            </div>
            <Button
              onClick={handleComplete}
              className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium"
            >
              Продолжить
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
