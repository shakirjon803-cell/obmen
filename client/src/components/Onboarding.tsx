import { Sparkles, Shield, Zap } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { t } from '@/lib/i18n';
import { Button } from './ui/button';
import { motion } from 'framer-motion';

function NellXLogo() {
  return (
    <img
      src="/gemini_generated_image_4g9jw74g9jw74g9j.png"
      alt="NellX"
      className="h-20 w-auto"
    />
  );
}

export function Onboarding() {
  const { language, setOnboardingSeen, openLogin } = useStore();

  const features = [
    { icon: Zap, text: t('welcomeFeature1', language), color: 'bg-amber-500' },
    { icon: Shield, text: t('welcomeFeature2', language), color: 'bg-blue-500' },
    { icon: Sparkles, text: t('welcomeFeature3', language), color: 'bg-emerald-500' },
  ];

  const handleGetStarted = () => {
    setOnboardingSeen(true);
  };

  const handleLoginClick = () => {
    setOnboardingSeen(true);
    openLogin();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center min-h-screen p-6 bg-white"
    >
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="flex justify-center"
        >
          <NellXLogo />
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center text-gray-500 text-lg"
        >
          {t('welcomeTitle', language)}
        </motion.p>

        {/* Features */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl"
            >
              <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center flex-shrink-0`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-gray-700 font-medium">{feature.text}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="space-y-3 pt-4"
        >
          <Button
            onClick={handleGetStarted}
            className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-semibold text-lg"
          >
            {t('getStarted', language)}
          </Button>

          <Button
            onClick={handleLoginClick}
            variant="outline"
            className="w-full py-4 border-2 border-gray-200 text-gray-700 hover:bg-gray-50 rounded-2xl font-semibold text-lg"
          >
            {t('alreadyHaveAccount', language)}
          </Button>
        </motion.div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pt-2">
          P2P Exchange
        </p>
      </div>
    </motion.div>
  );
}
