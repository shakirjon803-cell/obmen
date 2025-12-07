import React, { useState } from 'react';
import { useStore } from '@/hooks/useStore';
import { t } from '@/lib/i18n';
import { BadgeCheck, Edit2, LogOut, Save, Loader2, Store, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';

const API_BASE = '';

// Avatar component with fallback to first letter
function Avatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-16 h-16 text-xl',
    lg: 'w-24 h-24 text-3xl'
  };

  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn("rounded-full object-cover", sizeClasses[size])}
      />
    );
  }

  return (
    <div className={cn(
      "rounded-full flex items-center justify-center text-white font-bold",
      sizeClasses[size],
      colors[colorIndex]
    )}>
      {name?.charAt(0).toUpperCase() || '?'}
    </div>
  );
}

// Confetti effect
function Confetti({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{
            y: -20,
            x: Math.random() * window.innerWidth,
            rotate: 0,
            opacity: 1
          }}
          animate={{
            y: window.innerHeight + 20,
            rotate: Math.random() * 720,
            opacity: 0
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            delay: Math.random() * 0.5,
            ease: 'easeOut'
          }}
          className={cn(
            "absolute w-3 h-3 rounded-sm",
            ['bg-yellow-400', 'bg-pink-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500'][i % 5]
          )}
        />
      ))}
    </div>
  );
}

export function Profile() {
  const { language, registration, role, setLanguage, logout, updateProfile, stats, fetchStats, setRole } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState(registration.name);

  // Seller verification
  const [showSellerModal, setShowSellerModal] = useState(false);
  const [sellerCode, setSellerCode] = useState('');
  const [sellerError, setSellerError] = useState('');
  const [isVerifyingSeller, setIsVerifyingSeller] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  React.useEffect(() => {
    fetchStats();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({ name: newName });
      setIsEditing(false);
    } catch (error) {
      alert('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBecomeSeller = async () => {
    setSellerError('');

    if (!sellerCode || sellerCode.length < 4) {
      setSellerError('Введите код из бота');
      return;
    }

    setIsVerifyingSeller(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-seller`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: sellerCode.trim(),
          account_id: 1 // TODO: Get real account ID
        })
      });
      const data = await res.json();

      if (data.error) {
        setSellerError('Неверный код');
        return;
      }

      // Success!
      setShowConfetti(true);
      setTimeout(() => {
        setShowConfetti(false);
        setShowSellerModal(false);
        setRole('exchanger');
      }, 2500);
    } catch (e) {
      setSellerError('Ошибка проверки');
    } finally {
      setIsVerifyingSeller(false);
    }
  };

  return (
    <>
      <Confetti show={showConfetti} />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
        className="space-y-6 pb-20"
      >
        {/* Profile Header */}
        <div className="flex flex-col items-center text-center">
          <Avatar name={registration.name || 'User'} size="lg" />
          <h2 className="mt-3 text-xl font-bold text-gray-900">{registration.name || 'Пользователь'}</h2>
          <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-1">
            {role === 'exchanger' ? (
              <span className="flex items-center gap-1 text-green-600">
                <Store size={14} />
                Обменник
              </span>
            ) : (
              <span>Клиент</span>
            )}
            <BadgeCheck size={14} className="text-blue-500" />
          </div>
        </div>

        <div className="space-y-4">
          {/* Become Seller Button */}
          {role !== 'exchanger' && (
            <button
              onClick={() => setShowSellerModal(true)}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <Store size={18} />
              Стать обменником
            </button>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <span className="block text-2xl font-bold text-gray-900">{stats.active}</span>
              <span className="text-xs text-gray-500">{t('activeRequests', language)}</span>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <span className="block text-2xl font-bold text-gray-900">{stats.completed}</span>
              <span className="text-xs text-gray-500">{t('completedDeals', language)}</span>
            </div>
          </div>

          {/* Language */}
          <div className="p-1 bg-gray-100 rounded-xl flex">
            <button
              onClick={() => setLanguage('ru')}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                language === 'ru' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              )}
            >
              Русский
            </button>
            <button
              onClick={() => setLanguage('uz')}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                language === 'uz' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              )}
            >
              O'zbekcha
            </button>
          </div>

          {/* Edit Name */}
          {isEditing ? (
            <div className="space-y-3">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ваше имя"
                className="py-3"
              />
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Сохранить
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full py-3 border border-gray-200 rounded-xl font-medium flex items-center justify-center gap-2 text-gray-700 hover:bg-gray-50"
            >
              <Edit2 size={18} />
              Редактировать профиль
            </button>
          )}

          {/* Logout */}
          <button
            onClick={logout}
            className="w-full py-3 text-red-600 bg-red-50 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-100"
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </motion.div>

      {/* Seller Modal */}
      <AnimatePresence>
        {showSellerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowSellerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="text-white" size={24} />
                </div>
                <h3 className="text-lg font-bold">Стать обменником</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Получите код в боте командой /seller_code
                </p>
              </div>

              <Input
                value={sellerCode}
                onChange={(e) => setSellerCode(e.target.value.toUpperCase())}
                placeholder="ABC-XYZ"
                className="text-center text-lg tracking-wider py-3 mb-3"
              />

              {sellerError && (
                <p className="text-red-500 text-sm text-center mb-3">{sellerError}</p>
              )}

              <button
                onClick={handleBecomeSeller}
                disabled={isVerifyingSeller}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium"
              >
                {isVerifyingSeller ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Подтвердить'}
              </button>

              <button
                onClick={() => setShowSellerModal(false)}
                className="w-full py-2 mt-2 text-gray-500 text-sm"
              >
                Отмена
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
