import { CheckCircle2 } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { t } from '@/lib/i18n';
import { Button } from './ui/button';
import { motion } from 'framer-motion';

export function Onboarding() {
  const { language, setOnboardingSeen, openLogin } = useStore();

  const features = [
    t('welcomeFeature1', language),
    t('welcomeFeature2', language),
    t('welcomeFeature3', language)
  ];

  const handleGetStarted = () => {
    setOnboardingSeen(true);
  };

  const handleLoginClick = () => {
    // First mark onboarding as seen, then open login
    setOnboardingSeen(true);
    openLogin();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col items-center justify-center min-h-screen p-6 bg-white"
    >
      <div className="w-full max-w-md space-y-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.2 }}
          className="text-center space-y-3"
        >
          <h1 className="text-4xl font-bold">{t('appName', language)}</h1>
          <p className="text-gray-500">{t('welcomeTitle', language)}</p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.2 }}
          className="space-y-4"
        >
          {features.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-gray-900 mt-0.5 flex-shrink-0" />
              <p className="text-gray-700">{feature}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.2 }}
          className="space-y-3 pt-4"
        >
          <Button
            onClick={handleGetStarted}
            className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium"
          >
            {t('getStarted', language)}
          </Button>

          <Button
            onClick={handleLoginClick}
            variant="outline"
            className="w-full py-3 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-medium"
          >
            {t('alreadyHaveAccount', language)}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
