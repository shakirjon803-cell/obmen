import { useStore } from '@/hooks/useStore';
import { Button } from './ui/button';
import { motion } from 'framer-motion';
import { MessageCircle, ArrowRight, Shield, Sparkles } from 'lucide-react';

// NellX Logo - simple and clean
function NellXLogo({ className = "text-3xl" }: { className?: string }) {
  return (
    <div className={`font-black tracking-tight ${className}`}>
      <span>Nell</span>
      <span className="relative">
        X
        <span className="absolute -top-1 -right-2 text-xs">↗</span>
        <span className="absolute -bottom-1 -right-2 text-xs">↙</span>
      </span>
    </div>
  );
}

export function Registration() {
  const { openLogin, botUsername } = useStore();

  const handleOpenBot = () => {
    const username = botUsername || 'malxamibot';
    window.open(`https://t.me/${username}`, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center text-center py-6"
    >
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="relative mb-6 text-gray-900"
      >
        <NellXLogo className="text-3xl" />

        {/* Telegram badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
          className="absolute -bottom-3 right-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-3 border-white shadow-lg"
        >
          <MessageCircle size={14} className="text-white" />
        </motion.div>
      </motion.div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Регистрация через бота
      </h2>

      {/* Description */}
      <p className="text-gray-500 mb-6 max-w-xs leading-relaxed">
        Создайте аккаунт в нашем Telegram боте.
      </p>

      {/* Benefits */}
      <div className="w-full space-y-3 mb-6">
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 text-left">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Shield size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">Безопасно</p>
            <p className="text-xs text-gray-500">Верификация через Telegram</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 text-left">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <Sparkles size={20} className="text-green-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">Уведомления</p>
            <p className="text-xs text-gray-500">О сделках в Telegram</p>
          </div>
        </div>
      </div>

      {/* Open Bot Button */}
      <Button
        onClick={handleOpenBot}
        className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
      >
        <MessageCircle size={20} />
        Открыть бота
        <ArrowRight size={16} />
      </Button>

      {/* Login Link */}
      <p className="mt-6 text-sm text-gray-500">
        Уже есть аккаунт?{' '}
        <button onClick={openLogin} className="text-gray-900 font-semibold hover:underline">
          Войти
        </button>
      </p>

      <p className="mt-3 text-xs text-gray-400">
        @{botUsername || 'malxamibot'}
      </p>
    </motion.div>
  );
}
