import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/hooks/useStore';
import { MapPin, Search, X, Heart, MoreHorizontal, ChevronLeft, ChevronRight, Flame, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { EditPostSheet } from './EditPostSheet';

// Product Card Component - Avito/Marketplace style
function ProductCard({ post, onClick, favoriteIds, userId, onFavoriteToggle, onHide, onReport, onEdit, onDelete }: {
  post: any;
  onClick: () => void;
  favoriteIds?: number[];
  userId?: number;
  onFavoriteToggle?: (postId: number, isFavorite: boolean) => void;
  onHide?: (postId: number) => void;
  onReport?: (postId: number, authorId: number) => void;
  onEdit?: (post: any) => void;
  onDelete?: (postId: number) => void;
}) {
  const isFavorite = favoriteIds?.includes(Number(post.id)) || false;
  const [showMenu, setShowMenu] = useState(false);
  const isOwner = userId && (post.user_id === userId || post.ownerId === userId);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;

    try {
      if (isFavorite) {
        await fetch(`/api/favorites/${post.id}?user_id=${userId}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/favorites/${post.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId })
        });
      }
      onFavoriteToggle?.(Number(post.id), !isFavorite);
    } catch (e) {
      console.error('Failed to toggle favorite');
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleHide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onHide?.(Number(post.id));
  };

  const handleReport = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onReport?.(Number(post.id), post.ownerId || post.user_id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onEdit?.(post);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onDelete?.(Number(post.id));
  };

  const hasImage = post.image_data || post.thumbnailUrl;
  const imageUrl = post.image_data || post.thumbnailUrl;

  // Format price display
  const priceDisplay = post.rate ? `${post.rate} ${post.currency || ''}`.trim() :
    post.amount ? `${post.amount.toLocaleString()} ${post.currency || ''}`.trim() : '';

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden cursor-pointer group"
    >
      {/* Image Container - 4:3 aspect ratio */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden rounded-xl">
        {hasImage ? (
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          /* Nellx Logo Placeholder */
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-300">N</span>
              </div>
              <span className="text-xs text-gray-400 font-medium">NellX</span>
            </div>
          </div>
        )}

        {/* Type Badge (NEW / Куплю / Продам) */}
        {post.type && (
          <div className={cn(
            "absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded",
            post.type === 'buy' ? "bg-blue-500 text-white" : "bg-orange-500 text-white"
          )}>
            {post.type === 'buy' ? 'КУПЛЮ' : 'ПРОДАМ'}
          </div>
        )}

        {/* Favorite & Menu Icons */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            onClick={handleFavoriteClick}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all",
              isFavorite ? "bg-red-500 text-white" : "bg-white/90 backdrop-blur-sm text-gray-600 hover:bg-white"
            )}
          >
            <Heart size={16} className={isFavorite ? "fill-current" : ""} />
          </button>
          <div className="relative">
            <button
              onClick={handleMenuClick}
              className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-gray-600 hover:bg-white transition-all"
            >
              <MoreHorizontal size={16} />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 min-w-[160px]">
                {isOwner ? (
                  <>
                    <button
                      onClick={handleEdit}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={handleDelete}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      Удалить
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleReport}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      Пожаловаться
                    </button>
                    <button
                      onClick={handleHide}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      Не интересует
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Title */}
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 min-h-[40px] leading-tight">
          {post.description?.slice(0, 60) || post.buy_description?.slice(0, 60) || 'Обмен валюты'}
        </h3>

        {/* Price */}
        {priceDisplay && (
          <p className="font-bold text-gray-900 mt-1.5">
            {priceDisplay}
          </p>
        )}

        {/* Location */}
        {post.location && (
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
            <MapPin size={12} className="text-gray-400" />
            <span className="truncate">{post.location}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Grid of Product Cards
function ProductGrid({
  posts,
  onPostClick,
  favoriteIds,
  userId,
  onFavoriteToggle,
  onHide,
  onReport,
  onEdit,
  onDelete
}: {
  posts: any[];
  onPostClick: (post: any) => void;
  favoriteIds?: number[];
  userId?: number;
  onFavoriteToggle?: (postId: number, isFavorite: boolean) => void;
  onHide?: (postId: number) => void;
  onReport?: (postId: number, authorId: number) => void;
  onEdit?: (post: any) => void;
  onDelete?: (postId: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {posts.map((post, index) => (
        <motion.div
          key={post.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
        >
          <ProductCard
            post={post}
            onClick={() => onPostClick(post)}
            favoriteIds={favoriteIds}
            userId={userId}
            onFavoriteToggle={onFavoriteToggle}
            onHide={onHide}
            onReport={onReport}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </motion.div>
      ))}
    </div>
  );
}

// Horizontal Scrollable Row with Navigation Arrows
function SwimLane({
  title,
  icon: Icon,
  posts,
  onPostClick,
  gradient
}: {
  title: string;
  icon: React.ElementType;
  posts: any[];
  onPostClick: (post: any) => void;
  gradient?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener('scroll', checkScroll);
      return () => ref.removeEventListener('scroll', checkScroll);
    }
  }, [posts]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (posts.length === 0) return null;

  return (
    <div className="mb-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", gradient || "bg-gray-100")}>
            <Icon size={16} className="text-white" />
          </div>
          <h3 className="font-bold text-gray-900">{title}</h3>
        </div>

        {/* Navigation Arrows */}
        <div className="flex gap-1">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all",
              canScrollLeft
                ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                : "bg-gray-50 text-gray-300 cursor-not-allowed"
            )}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all",
              canScrollRight
                ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                : "bg-gray-50 text-gray-300 cursor-not-allowed"
            )}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Horizontal Scroll */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {posts.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPostClick(post)}
            className="flex-shrink-0 w-44 snap-start cursor-pointer"
          >
            <div className="bg-white rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
              {/* Thumbnail - 4:3 aspect ratio */}
              <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden rounded-xl">
                {post.image_data || post.thumbnailUrl ? (
                  <img
                    src={post.image_data || post.thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                        <span className="text-lg font-bold text-gray-300">N</span>
                      </div>
                      <span className="text-[10px] text-gray-400">NellX</span>
                    </div>
                  </div>
                )}

                {/* Favorite Icon */}
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors"
                >
                  <Heart size={14} />
                </button>

                {/* Type Badge */}
                {post.type && (
                  <div className={cn(
                    "absolute top-2 left-2 text-[9px] font-semibold px-1.5 py-0.5 rounded",
                    post.type === 'buy' ? "bg-blue-500 text-white" : "bg-orange-500 text-white"
                  )}>
                    {post.type === 'buy' ? 'КУПЛЮ' : 'ПРОДАМ'}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2.5">
                <p className="text-xs font-medium text-gray-900 line-clamp-2 min-h-[32px]">
                  {post.description?.slice(0, 40) || post.buy_description?.slice(0, 40) || 'Обмен валюты'}
                </p>
                {post.rate && (
                  <p className="font-bold text-sm text-gray-900 mt-1">
                    {post.rate} {post.currency || ''}
                  </p>
                )}
                {post.location && (
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1.5">
                    <MapPin size={10} />
                    <span className="truncate">{post.location}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Animated Banner Carousel
function BannerCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const banners = [
    { id: 1, gradient: 'from-blue-500 to-purple-600', title: 'Лучшие курсы', subtitle: 'Обмен без комиссии' },
    { id: 2, gradient: 'from-orange-400 to-pink-500', title: 'Быстро и надёжно', subtitle: 'Проверенные обменники' },
    { id: 3, gradient: 'from-green-400 to-teal-500', title: 'NellX', subtitle: 'P2P обмен валют' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mb-6">
      <div className="relative overflow-hidden rounded-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "w-full h-32 bg-gradient-to-r p-5 flex flex-col justify-end",
              banners[activeIndex].gradient
            )}
          >
            <motion.h2
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-white text-xl font-bold"
            >
              {banners[activeIndex].title}
            </motion.h2>
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white/80 text-sm"
            >
              {banners[activeIndex].subtitle}
            </motion.p>
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        <button
          onClick={() => setActiveIndex((prev) => (prev - 1 + banners.length) % banners.length)}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
        >
          <ChevronLeft size={18} className="text-white" />
        </button>
        <button
          onClick={() => setActiveIndex((prev) => (prev + 1) % banners.length)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
        >
          <ChevronRight size={18} className="text-white" />
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-3">
        {banners.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              i === activeIndex ? "bg-gray-900 w-6" : "bg-gray-300 w-2"
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function Feed() {
  const {
    searchQuery,
    setSearchQuery,
    getFilteredPosts,
    userId,
    removePost,
    setEditingPost
  } = useStore();

  const navigate = useNavigate();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportPostId, setReportPostId] = useState<number | null>(null);
  const [reportAuthorId, setReportAuthorId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState('');

  // Fetch favorites and hidden posts on mount
  useEffect(() => {
    if (userId) {
      fetch(`/api/favorites/ids?user_id=${userId}`)
        .then(r => r.json())
        .then(ids => setFavoriteIds(ids || []))
        .catch(() => { });

      fetch(`/api/hidden?user_id=${userId}`)
        .then(r => r.json())
        .then(ids => setHiddenIds(ids || []))
        .catch(() => { });
    }
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(localSearch), 250);
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);

  // Filter out hidden posts
  const allPosts = getFilteredPosts().filter((p: any) => !hiddenIds.includes(Number(p.id)));

  // Split posts into categories
  const hotPosts = allPosts.slice(0, 8);
  const recentPosts = allPosts;

  const handlePostClick = (post: any) => {
    navigate(`/post/${post.id}`);
  };

  const handleClearSearch = () => {
    setLocalSearch('');
    setSearchQuery('');
  };

  const handleFavoriteToggle = (postId: number, isFavorite: boolean) => {
    if (isFavorite) {
      setFavoriteIds(prev => [...prev, postId]);
    } else {
      setFavoriteIds(prev => prev.filter(id => id !== postId));
    }
  };

  const handleHide = async (postId: number) => {
    if (!userId) return;
    try {
      await fetch('/api/hidden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, post_id: postId })
      });
      setHiddenIds(prev => [...prev, postId]);
    } catch (e) {
      console.error('Failed to hide post');
    }
  };

  const handleReport = (postId: number, authorId: number) => {
    setReportPostId(postId);
    setReportAuthorId(authorId);
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!userId || !reportReason) return;
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporter_id: userId,
          reported_user_id: reportAuthorId,
          post_id: reportPostId,
          reason: reportReason
        })
      });
      setShowReportModal(false);
      setReportReason('');
      alert('Жалоба отправлена!');
    } catch (e) {
      console.error('Failed to submit report');
    }
  };

  const handleEdit = (post: any) => {
    setEditingPost(post);
  };

  const handleDelete = async (postId: number) => {
    if (!confirm('Удалить этот пост?')) return;
    try {
      await removePost(String(postId));
    } catch (e) {
      alert('Ошибка удаления');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-4 pb-20"
    >
      {/* Search Bar */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Поиск..."
          className="w-full pl-11 pr-10 py-3 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-gray-900/10 focus:bg-white transition-all"
        />
        {localSearch && (
          <button onClick={handleClearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Banner Carousel */}
      <BannerCarousel />

      {/* Hot Deals - Horizontal Swimlane */}
      <SwimLane
        title="Рекомендации для вас"
        icon={Flame}
        posts={hotPosts}
        onPostClick={handlePostClick}
        gradient="bg-gradient-to-br from-orange-500 to-red-500"
      />

      {/* All Posts - Vertical Grid */}
      <div className="mt-6">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          Все объявления
        </h3>

        {recentPosts.length > 0 ? (
          <ProductGrid
            posts={recentPosts}
            onPostClick={handlePostClick}
            favoriteIds={favoriteIds}
            userId={userId}
            onFavoriteToggle={handleFavoriteToggle}
            onHide={handleHide}
            onReport={handleReport}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500">Пока нет постов</p>
            <p className="text-sm text-gray-400 mt-1">Станьте первым обменником!</p>
          </div>
        )}
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowReportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-gray-900 mb-4">Пожаловаться</h3>

              <div className="space-y-2 mb-4">
                {['Спам', 'Мошенничество', 'Неприемлемый контент', 'Другое'].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setReportReason(reason)}
                    className={`w-full py-2.5 px-4 rounded-xl text-left text-sm font-medium transition-all ${reportReason === reason
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2.5 text-gray-600 bg-gray-100 rounded-xl font-medium"
                >
                  Отмена
                </button>
                <button
                  onClick={submitReport}
                  disabled={!reportReason}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-medium disabled:opacity-50"
                >
                  Отправить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Post Sheet */}
      <EditPostSheet />
    </motion.div>
  );
}
