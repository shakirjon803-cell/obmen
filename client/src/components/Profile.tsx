import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/hooks/useStore';
import { BadgeCheck, Edit2, LogOut, Loader2, Store, Sparkles, Star, Trash2, Send, CheckCircle, Camera, X, Globe, HelpCircle, ChevronRight, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { AvatarEditor } from './AvatarEditor';

const API_BASE = '';

// Avatar component with edit capability
function Avatar({
  name,
  avatarUrl,
  size = 'lg',
  editable = false,
  onEditClick
}: {
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
  onEditClick?: () => void;
}) {
  const sizeClasses = { sm: 'w-8 h-8 text-sm', md: 'w-16 h-16 text-xl', lg: 'w-24 h-24 text-3xl' };
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;

  const avatarContent = avatarUrl ? (
    <img src={avatarUrl} alt={name} className={cn("rounded-full object-cover w-full h-full")} />
  ) : (
    <div className={cn("rounded-full flex items-center justify-center text-white font-bold w-full h-full", colors[colorIndex])}>
      {name?.charAt(0).toUpperCase() || '?'}
    </div>
  );

  if (editable) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onEditClick}
        className={cn("relative cursor-pointer overflow-hidden", sizeClasses[size])}
      >
        {avatarContent}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-full">
          <Camera size={24} className="text-white" />
        </div>
      </motion.div>
    );
  }

  return <div className={sizeClasses[size]}>{avatarContent}</div>;
}


// Confetti Animation
function Confetti({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ y: -20, x: Math.random() * window.innerWidth, rotate: 0, opacity: 1 }}
          animate={{ y: window.innerHeight + 20, rotate: Math.random() * 720, opacity: 0 }}
          transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 0.5, ease: 'easeOut' }}
          className={cn("absolute w-3 h-3 rounded-sm", ['bg-yellow-400', 'bg-pink-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500'][i % 5])}
        />
      ))}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={14} className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
      ))}
    </div>
  );
}

type TabType = 'posts' | 'favorites' | 'reviews';

export function Profile() {
  const { language, registration, role, setLanguage, logout, updateProfile, stats, fetchStats, setRole, myPosts, fetchMyPosts, removePost, setRegistration, setEditingPost } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState(registration.name);
  const [newAvatar, setNewAvatar] = useState<string | undefined>(registration.avatarUrl);
  const [originalAvatarSrc, setOriginalAvatarSrc] = useState<string | undefined>(registration.originalAvatarUrl);
  const [activeTab, setActiveTab] = useState<TabType>('posts');

  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Favorites
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  // Seller verification
  const [showSellerModal, setShowSellerModal] = useState(false);
  const [sellerCode, setSellerCode] = useState('');
  const [sellerError, setSellerError] = useState('');
  const [isVerifyingSeller, setIsVerifyingSeller] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  // Avatar prompt for first-time users
  const [showAvatarPrompt, setShowAvatarPrompt] = useState(false);
  // Avatar editor modal
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  // Settings sidebar
  const [showSettings, setShowSettings] = useState(false);

  // Tab ref for underline animation
  const tabsRef = useRef<HTMLDivElement>(null);
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });

  const { userId } = useStore();

  useEffect(() => {
    fetchStats();
    fetchMyPosts();

    // Show avatar prompt if no avatar and profile just opened
    if (!registration.avatarUrl && registration.completed) {
      const hasSeenPrompt = localStorage.getItem('avatar_prompt_seen');
      if (!hasSeenPrompt) {
        setTimeout(() => setShowAvatarPrompt(true), 500);
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'reviews') loadReviews();
    if (activeTab === 'favorites') loadFavorites();
  }, [activeTab]);

  const loadFavorites = async () => {
    setLoadingFavorites(true);
    try {
      const res = await fetch(`${API_BASE}/api/favorites?user_id=${userId}`);
      const data = await res.json();
      setFavorites(data || []);
    } catch (e) {
      console.error('Failed to load favorites');
    } finally {
      setLoadingFavorites(false);
    }
  };

  const loadReviews = async () => {
    setLoadingReviews(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/1/reviews`);
      const data = await res.json();
      setReviews(data || []);
    } catch (e) {
      console.error('Failed to load reviews');
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleRequestSellerCode = async () => {
    setIsRequestingCode(true);
    setSellerError('');

    // Try to get telegram_id from WebApp first, then from registration data
    const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
    const telegramId = tgUser?.id || registration.telegramId;

    if (!telegramId) {
      setSellerError('Telegram ID не найден. Перезайдите в аккаунт.');
      setIsRequestingCode(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/request-seller-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: telegramId })
      });
      const data = await res.json();

      if (data.error) {
        setSellerError('Ошибка отправки. Попробуйте снова.');
      } else {
        setCodeSent(true);
      }
    } catch (e) {
      setSellerError('Ошибка сети');
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleOpenSellerModal = () => {
    setShowSellerModal(true);
    setSellerCode('');
    setSellerError('');
    setCodeSent(false);
  };

  const handleBecomeSeller = async () => {
    setSellerError('');
    if (!sellerCode || sellerCode.length < 4) {
      setSellerError('Введите код');
      return;
    }

    // Try to get telegram_id from WebApp first, then from registration data
    const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
    const telegramId = tgUser?.id || registration.telegramId;

    if (!telegramId) {
      setSellerError('Telegram ID не найден. Перезайдите в аккаунт.');
      return;
    }

    setIsVerifyingSeller(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-seller`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: sellerCode.trim(), telegram_id: telegramId })
      });
      const data = await res.json();

      if (data.error) {
        setSellerError('Неверный код');
        return;
      }

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

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Удалить этот пост?')) return;
    try {
      await removePost(postId);
      fetchMyPosts();
    } catch (e) {
      alert('Ошибка удаления');
    }
  };

  const handleEditPost = (post: any) => {
    // Open edit modal with post data
    setEditingPost(post);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update name
      await updateProfile({ name: newName });

      // Update avatar on server if account_id exists
      if (registration.accountId && (newAvatar !== registration.avatarUrl || originalAvatarSrc !== registration.originalAvatarUrl)) {
        await fetch(`${API_BASE}/api/user/avatar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: registration.accountId,
            avatar_url: newAvatar || null,
            original_avatar_url: originalAvatarSrc || null // Save original for future re-editing
          })
        });
      }

      // Update local state
      setRegistration({
        ...registration,
        name: newName,
        avatarUrl: newAvatar,
        originalAvatarUrl: originalAvatarSrc
      });

      setIsEditing(false);
    } catch (e) {
      console.error('Failed to save profile:', e);
      alert('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDismissAvatarPrompt = (addLater: boolean) => {
    setShowAvatarPrompt(false);
    if (addLater) {
      localStorage.setItem('avatar_prompt_seen', 'true');
    } else {
      // Open avatar editor directly
      setShowAvatarEditor(true);
      localStorage.setItem('avatar_prompt_seen', 'true');
    }
  };

  const handleAvatarEditorSave = async (croppedImage: string, originalImage: string) => {
    setNewAvatar(croppedImage);
    setOriginalAvatarSrc(originalImage); // Store original for future re-editing
    setIsEditing(true); // Make sure we're in edit mode to save
  };

  return (
    <>
      {/* Avatar Editor Modal */}
      <AvatarEditor
        isOpen={showAvatarEditor}
        onClose={() => setShowAvatarEditor(false)}
        onSave={handleAvatarEditorSave}
        currentAvatar={newAvatar || registration.avatarUrl}
        originalImage={originalAvatarSrc || registration.originalAvatarUrl}
      />

      <Confetti show={showConfetti} />

      {/* Avatar Prompt Modal */}
      <AnimatePresence>
        {showAvatarPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm text-center"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera size={32} className="text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Добавить фото?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Добавьте фото профиля чтобы другие пользователи узнавали вас
              </p>
              <button
                onClick={() => handleDismissAvatarPrompt(false)}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium mb-2"
              >
                Добавить фото
              </button>
              <button
                onClick={() => handleDismissAvatarPrompt(true)}
                className="w-full py-2 text-gray-500 text-sm"
              >
                Позже
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="space-y-5 pb-20"
      >
        {/* Profile Header with Menu Button */}
        <div className="relative">
          {/* Menu Button - Top Right */}
          <button
            onClick={() => setShowSettings(true)}
            className="absolute right-0 top-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors z-10"
          >
            <Menu size={24} />
          </button>

          <div className="flex flex-col items-center text-center">
            <Avatar
              name={registration.name || 'User'}
              avatarUrl={isEditing ? newAvatar : registration.avatarUrl}
              size="lg"
              editable={isEditing}
              onEditClick={() => setShowAvatarEditor(true)}
            />

            {isEditing ? (
              <div className="mt-3 w-full max-w-xs">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ваше имя" className="text-center" />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { setIsEditing(false); setNewAvatar(registration.avatarUrl); }} className="flex-1 py-2 text-gray-600 text-sm">Отмена</button>
                  <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm">
                    {isSaving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Сохранить'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="mt-3 text-xl font-bold text-gray-900">{registration.name || 'Пользователь'}</h2>
                <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-1">
                  {role === 'exchanger' ? (
                    <span className="flex items-center gap-1 text-green-600"><Store size={14} />Обменник</span>
                  ) : (
                    <span>Клиент</span>
                  )}
                  <BadgeCheck size={14} className="text-blue-500" />
                </div>
                <button onClick={() => setIsEditing(true)} className="mt-2 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <Edit2 size={12} />Редактировать
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-xl text-center">
            <span className="block text-xl font-bold text-gray-900">{stats.active}</span>
            <span className="text-xs text-gray-500">Активных</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl text-center">
            <span className="block text-xl font-bold text-gray-900">{stats.completed}</span>
            <span className="text-xs text-gray-500">Завершено</span>
          </div>
        </div>

        {/* Become Seller */}
        {role !== 'exchanger' && (
          <button
            onClick={handleOpenSellerModal}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
          >
            <Store size={18} />
            Стать обменником
          </button>
        )}

        {/* Tabs with animated underline */}
        <div className="relative" ref={tabsRef}>
          <div className="flex border-b border-gray-200">
            {[
              { key: 'posts', label: 'Мои посты' },
              { key: 'favorites', label: 'Избранное' },
              { key: 'reviews', label: 'Отзывы' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={(e) => {
                  setActiveTab(tab.key as TabType);
                  const target = e.currentTarget;
                  setUnderlineStyle({
                    left: target.offsetLeft,
                    width: target.offsetWidth
                  });
                }}
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-colors relative',
                  activeTab === tab.key ? 'text-gray-900' : 'text-gray-500'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Animated underline */}
          <motion.div
            className="absolute bottom-0 h-0.5 bg-orange-500 rounded-full"
            initial={false}
            animate={{
              left: underlineStyle.left || (tabsRef.current?.querySelector('button')?.offsetLeft ?? 0),
              width: underlineStyle.width || (tabsRef.current?.querySelector('button')?.offsetWidth ?? 100)
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'posts' && (
            <motion.div key="posts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {myPosts.length === 0 ? (
                <div className="text-center py-8 text-gray-400"><p>У вас пока нет постов</p></div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {myPosts.map((post: any) => (
                    <motion.div
                      key={post.id}
                      whileTap={{ scale: 0.98 }}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleEditPost(post)}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 relative">
                        {post.image_data || post.thumbnailUrl ? (
                          <img
                            src={post.image_data || post.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                            <span className="text-2xl font-bold text-gray-300">{post.currency || 'USD'}</span>
                          </div>
                        )}
                        {/* Rate Badge */}
                        {post.rate && (
                          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-sm">
                            {post.rate}
                          </div>
                        )}
                        {/* Type Badge */}
                        {post.type && (
                          <div className={cn(
                            "absolute top-2 left-2 text-xs font-medium px-2 py-1 rounded-lg",
                            post.type === 'buy' ? "bg-blue-500 text-white" : "bg-orange-500 text-white"
                          )}>
                            {post.type === 'buy' ? 'Куплю' : 'Продам'}
                          </div>
                        )}
                        {/* Edit indicator */}
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="opacity-0 hover:opacity-100 bg-white/90 rounded-full p-2 transition-opacity">
                            <Edit2 size={16} className="text-gray-700" />
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-3">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2 min-h-[40px]">
                          {post.description?.slice(0, 40) || post.buy_description?.slice(0, 40) || 'Обмен валюты'}
                        </p>
                        <div className="flex items-center justify-between">
                          {post.location && (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <span className="truncate max-w-[60px]">{post.location}</span>
                            </div>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'favorites' && (
            <motion.div key="favorites" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {loadingFavorites ? (
                <div className="text-center py-8"><Loader2 className="animate-spin mx-auto text-gray-400" size={24} /></div>
              ) : favorites.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>Нет избранных постов</p>
                  <p className="text-sm mt-1">Нажмите ❤️ на постах чтобы добавить</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {favorites.map((post: any) => (
                    <motion.div
                      key={post.id}
                      whileTap={{ scale: 0.98 }}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => window.location.href = `/post/${post.id}`}
                    >
                      <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 relative">
                        {post.image_data || post.thumbnailUrl ? (
                          <img src={post.image_data || post.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                            <span className="text-2xl font-bold text-gray-300">{post.currency || 'USD'}</span>
                          </div>
                        )}
                        {post.rate && (
                          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-sm">
                            {post.rate}
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2 min-h-[40px]">
                          {post.title || post.description?.slice(0, 40) || 'Обмен валюты'}
                        </p>
                        {post.location && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <span className="truncate">{post.location}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'reviews' && (
            <motion.div key="reviews" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
              {loadingReviews ? (
                <div className="text-center py-8"><Loader2 className="animate-spin mx-auto text-gray-400" size={24} /></div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-8 text-gray-400"><p>Пока нет отзывов</p></div>
              ) : (
                reviews.map((review: any) => (
                  <div key={review.id} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar name={review.from_name || 'User'} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{review.from_name}</p>
                        <StarRating rating={review.rating} />
                      </div>
                    </div>
                    {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Seller Modal */}
      <AnimatePresence>
        {showSellerModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSellerModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="text-white" size={24} />
                </div>
                <h3 className="text-lg font-bold">Стать обменником</h3>
                <p className="text-sm text-gray-500 mt-1">Получите код подтверждения в Telegram</p>
              </div>

              {!codeSent && (
                <button
                  onClick={handleRequestSellerCode}
                  disabled={isRequestingCode}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 mb-4 transition-colors"
                >
                  {isRequestingCode ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      <Send size={18} />
                      Отправить код
                    </>
                  )}
                </button>
              )}

              {codeSent && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-xl mb-4">
                  <CheckCircle size={18} />
                  <span className="text-sm">Код отправлен в Telegram!</span>
                </div>
              )}

              <Input
                value={sellerCode}
                onChange={(e) => setSellerCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXX"
                className="text-center text-lg tracking-wider py-3 mb-3"
              />

              {sellerError && (
                <p className="text-red-500 text-sm text-center mb-3">{sellerError}</p>
              )}

              <button onClick={handleBecomeSeller} disabled={isVerifyingSeller || !sellerCode} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium disabled:opacity-50 hover:shadow-lg transition-shadow">
                {isVerifyingSeller ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Подтвердить'}
              </button>

              <button onClick={() => setShowSellerModal(false)} className="w-full py-2 mt-2 text-gray-500 text-sm hover:text-gray-700">Отмена</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Sidebar */}
      <AnimatePresence>
        {showSettings && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowSettings(false)}
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white z-50 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">Настройки</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Settings Content */}
              <div className="p-4 space-y-4">
                {/* Language Section */}
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-3">
                    <Globe size={16} />
                    Язык
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setLanguage('ru')}
                      className={cn(
                        "w-full py-3 px-4 rounded-xl text-left text-sm font-medium flex items-center justify-between transition-colors",
                        language === 'ru' ? "bg-orange-50 text-orange-600" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      Русский
                      {language === 'ru' && <CheckCircle size={16} />}
                    </button>
                    <button
                      onClick={() => setLanguage('uz')}
                      className={cn(
                        "w-full py-3 px-4 rounded-xl text-left text-sm font-medium flex items-center justify-between transition-colors",
                        language === 'uz' ? "bg-orange-50 text-orange-600" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      O'zbekcha
                      {language === 'uz' && <CheckCircle size={16} />}
                    </button>
                  </div>
                </div>

                {/* Support */}
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-3">
                    <HelpCircle size={16} />
                    Помощь
                  </div>
                  <a
                    href="https://t.me/nellx_support"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    Поддержка
                    <ChevronRight size={16} className="text-gray-400" />
                  </a>
                </div>

                {/* App Info */}
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 text-center mb-4">
                    NellX v1.0.0
                  </p>
                  <button
                    onClick={logout}
                    className="w-full py-3 text-red-600 bg-red-50 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                  >
                    <LogOut size={18} />
                    Выйти
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
