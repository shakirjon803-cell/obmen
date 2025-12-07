import React, { useState, useMemo } from 'react';
import { useStore } from '@/hooks/useStore';
import { MapPin, Search, X, Plus, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export function Feed() {
  const {
    searchQuery,
    setSearchQuery,
    getFilteredPosts,
    categoryFilter,
    setCategoryFilter,
    role,
    fetchCategories,
    addCategory,
    myPosts,
    fetchMyPosts,
    fetchMarketPosts,
    userId
  } = useStore();

  const navigate = useNavigate();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [isMyPostsMode, setIsMyPostsMode] = useState(false);

  React.useEffect(() => {
    fetchCategories();
    fetchMarketPosts();
  }, []);

  React.useEffect(() => {
    if (isMyPostsMode) {
      fetchMyPosts();
    }
  }, [isMyPostsMode]);

  const handleAddCategory = async () => {
    if (newCategory.trim()) {
      await addCategory(newCategory.trim());
      setCategoryFilter(newCategory.trim());
      setNewCategory('');
      setShowAddCategory(false);
    }
  };

  const debouncedSearch = useMemo(() => {
    const timeoutId = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [localSearch, setSearchQuery]);

  React.useEffect(() => {
    return debouncedSearch;
  }, [debouncedSearch]);

  const filteredPosts = isMyPostsMode ? myPosts : getFilteredPosts();

  const handleClearSearch = () => {
    setLocalSearch('');
    setSearchQuery('');
  };

  const isOwnPost = (post: any) => {
    return post.ownerId === userId || post.user_id === userId;
  };

  // Navigate to post page instead of modal
  const handlePostClick = (post: any) => {
    navigate(`/post/${post.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className="space-y-4"
    >
      {/* Search Bar */}
      <div className="relative">
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

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        <button
          onClick={() => { setCategoryFilter(null); setIsMyPostsMode(false); }}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
            !categoryFilter && !isMyPostsMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
          )}
        >
          Все
        </button>

        {role === 'exchanger' && (
          <button
            onClick={() => { setIsMyPostsMode(true); setCategoryFilter(null); }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
              isMyPostsMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
            )}
          >
            Мои
          </button>
        )}

        {['USD', 'RUB', 'EGP', 'USDT'].map((cat) => (
          <button
            key={cat}
            onClick={() => { setCategoryFilter(cat); setIsMyPostsMode(false); }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
              categoryFilter === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
            )}
          >
            {cat}
          </button>
        ))}

        {role === 'exchanger' && !showAddCategory && (
          <button
            onClick={() => setShowAddCategory(true)}
            className="p-1.5 rounded-lg bg-gray-100 text-gray-600"
          >
            <Plus size={14} />
          </button>
        )}

        {showAddCategory && (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              placeholder="..."
              className="w-16 px-2 py-1 text-sm bg-white border border-gray-200 rounded-lg"
            />
            <button onClick={handleAddCategory} className="p-1 bg-gray-900 text-white rounded">
              <Check size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Posts Grid - 3 columns, square */}
      <div className="grid grid-cols-3 gap-2">
        {filteredPosts.map((post) => (
          <div
            key={post.id}
            onClick={() => handlePostClick(post)}
            className="aspect-square bg-white rounded-xl border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-all relative"
          >
            {/* Background Image or Gradient */}
            {(post.thumbnailUrl || post.image_data) ? (
              <img
                src={post.thumbnailUrl || post.image_data}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-2">
                <div className="text-lg font-bold text-gray-800">{post.currency || 'USD'}</div>
                {post.rate && (
                  <div className="text-sm font-semibold text-green-600">{post.rate}</div>
                )}
              </div>
            )}

            {/* Overlay with info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              {post.amount && (
                <div className="text-white text-xs font-medium">
                  {post.amount?.toLocaleString()} {post.currency}
                </div>
              )}
              {post.location && (
                <div className="text-white/70 text-[10px] flex items-center gap-0.5">
                  <MapPin size={8} />
                  {post.location}
                </div>
              )}
            </div>

            {/* Own post badge */}
            {isOwnPost(post) && (
              <div className="absolute top-1 right-1 bg-gray-900 text-white text-[8px] px-1.5 py-0.5 rounded">
                Ваш
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredPosts.length === 0 && (
        <div className="text-center py-12">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Search size={20} className="text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">Нет постов</p>
        </div>
      )}
    </motion.div>
  );
}
