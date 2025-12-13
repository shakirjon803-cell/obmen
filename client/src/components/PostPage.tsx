import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Star, Loader2, Trash2, ExternalLink, Heart, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/hooks/useStore';

const API_BASE = '';

// Avatar component
function Avatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl?: string; size?: 'sm' | 'md' | 'lg' }) {
    const sizeClasses = { sm: 'w-10 h-10 text-sm', md: 'w-12 h-12 text-base', lg: 'w-16 h-16 text-xl' };
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
    const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;

    if (avatarUrl) {
        return (
            <div className={cn("rounded-full overflow-hidden", sizeClasses[size])}>
                <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            </div>
        );
    }

    return (
        <div className={cn("rounded-full flex items-center justify-center text-white font-bold", sizeClasses[size], colors[colorIndex])}>
            {name?.charAt(0).toUpperCase() || '?'}
        </div>
    );
}

// Star Rating
function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} size={14} className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
            ))}
        </div>
    );
}

// Parse URLs in text and make them clickable
function ParsedDescription({ text }: { text: string }) {
    if (!text) return null;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return (
        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
            {parts.map((part, i) => {
                if (part.match(urlRegex)) {
                    return (
                        <a
                            key={i}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part.length > 40 ? part.slice(0, 40) + '...' : part}
                            <ExternalLink size={12} />
                        </a>
                    );
                }
                return part;
            })}
        </p>
    );
}

// Recommendation Card Component
function RecommendationCard({ post, onClick }: { post: any; onClick: () => void }) {
    const hasImage = post.image_data || post.thumbnailUrl;
    const imageUrl = post.image_data || post.thumbnailUrl;
    const priceDisplay = post.rate ? `${post.rate} ${post.currency || ''}`.trim() :
        post.amount ? `${post.amount.toLocaleString()} ${post.currency || ''}`.trim() : '';

    return (
        <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className="bg-white rounded-xl overflow-hidden cursor-pointer"
        >
            {/* Image - 4:3 aspect ratio */}
            <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden rounded-lg">
                {hasImage ? (
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
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
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors"
                >
                    <Heart size={12} />
                </button>
            </div>

            {/* Content */}
            <div className="p-2">
                <p className="text-xs font-medium text-gray-900 line-clamp-2 min-h-[32px]">
                    {post.description?.slice(0, 40) || 'Обмен валюты'}
                </p>
                {priceDisplay && (
                    <p className="font-bold text-sm text-gray-900 mt-1">{priceDisplay}</p>
                )}
                {post.location && (
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
                        <MapPin size={10} />
                        <span className="truncate">{post.location}</span>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

export function PostPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { userId, removePost } = useStore();

    const [post, setPost] = useState<any>(null);
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (id) {
            loadPost();
            loadRecommendations();
        }
    }, [id]);

    const loadPost = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/posts/${id}`);
            if (!res.ok) throw new Error('Not found');
            const data = await res.json();
            setPost(data);
        } catch (e) {
            setError('Пост не найден');
        } finally {
            setLoading(false);
        }
    };

    const loadRecommendations = async () => {
        try {
            // Get all posts and filter out the current post and posts from the same user
            const res = await fetch(`${API_BASE}/api/market`);
            if (res.ok) {
                const allPosts = await res.json();
                // Filter: different post, different user, max 10 posts
                const filtered = allPosts
                    .filter((p: any) => String(p.id) !== id)
                    .slice(0, 10);
                setRecommendations(filtered);
            }
        } catch (e) {
            console.error('Failed to load recommendations');
        }
    };

    const handleDelete = async () => {
        if (!confirm('Удалить этот пост?')) return;
        try {
            await removePost(id!);
            navigate('/');
        } catch (e) {
            alert('Ошибка удаления');
        }
    };

    // Fixed Telegram contact handler
    const handleContact = () => {
        // Try multiple ways to get the username
        let username = post?.author_username || post?.username;

        if (username) {
            // Clean the username - remove @ if present
            username = username.replace(/^@/, '').trim();
            // Open Telegram with the username
            const telegramUrl = `https://t.me/${username}`;
            window.open(telegramUrl, '_blank');
        } else if (post?.user_id) {
            // Fallback: use tg://user?id= protocol for users without username
            const telegramUrl = `tg://user?id=${post.user_id}`;
            window.location.href = telegramUrl;
        } else {
            alert('Контактные данные пользователя недоступны');
        }
    };

    const handleRecommendationClick = (recPost: any) => {
        navigate(`/post/${recPost.id}`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="text-center py-20">
                <p className="text-gray-500">{error || 'Пост не найден'}</p>
                <button onClick={() => navigate('/')} className="mt-4 text-blue-500">
                    Вернуться
                </button>
            </div>
        );
    }

    const isOwner = post.user_id === userId;
    const hasImage = post.image_data || post.thumbnailUrl;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pb-28"
        >
            {/* Author Header */}
            <div className="flex items-center gap-3 mb-4">
                <button onClick={() => navigate(`/user/${post.user_id}`)}>
                    <Avatar name={post.author_name || 'User'} avatarUrl={post.author_avatar_url} size="md" />
                </button>
                <div className="flex-1">
                    <button
                        onClick={() => navigate(`/user/${post.user_id}`)}
                        className="font-semibold text-gray-900 hover:underline"
                    >
                        {post.author_name || 'Пользователь'}
                    </button>
                    <div className="flex items-center gap-2">
                        <StarRating rating={5} />
                        <span className="text-xs text-gray-500">5.0</span>
                    </div>
                </div>
                <span className="text-xs text-gray-400">
                    {new Date(post.created_at).toLocaleDateString('ru')}
                </span>
            </div>

            {/* Hero Image with Nellx Fallback */}
            <div className="rounded-2xl overflow-hidden mb-5 bg-gradient-to-br from-gray-100 to-gray-50">
                {hasImage ? (
                    <img
                        src={post.image_data || post.thumbnailUrl}
                        alt=""
                        className="w-full aspect-video object-cover"
                    />
                ) : (
                    <div className="w-full aspect-video flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-20 h-20 rounded-2xl bg-white shadow-md flex items-center justify-center">
                                <span className="text-4xl font-bold text-gray-300">N</span>
                            </div>
                            <span className="text-lg text-gray-400 font-medium">NellX</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Primary Info */}
            <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                    {/* Rate */}
                    <div>
                        {post.rate ? (
                            <div className="text-3xl font-bold text-gray-900">{post.rate}</div>
                        ) : (
                            <div className="text-xl font-bold text-gray-900">{post.currency || 'USD'}</div>
                        )}
                        {post.amount && (
                            <div className="text-sm text-gray-500">
                                {post.amount.toLocaleString()} {post.currency}
                            </div>
                        )}
                    </div>

                    {/* Location */}
                    {post.location && (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
                            <MapPin size={14} />
                            {post.location}
                        </div>
                    )}
                </div>

                {/* Type Badge */}
                {post.type && (
                    <div className={cn(
                        "inline-block px-3 py-1 rounded-full text-xs font-medium",
                        post.type === 'buy' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                    )}>
                        {post.type === 'buy' ? 'Покупка' : 'Продажа'}
                    </div>
                )}
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-3">Описание</h3>
                <ParsedDescription text={post.description || post.buy_description || ''} />
            </div>

            {/* Recommendations Section - 2 Column Grid */}
            {recommendations.length > 0 && (
                <div className="mt-6 mb-6">
                    <h3 className="font-bold text-gray-900 mb-4 text-lg">
                        Рекомендации для вас
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {recommendations.map((rec) => (
                            <RecommendationCard
                                key={rec.id}
                                post={rec}
                                onClick={() => handleRecommendationClick(rec)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Floating Action Button */}
            <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto">
                {isOwner ? (
                    <button
                        onClick={handleDelete}
                        className="w-full py-4 bg-red-500 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg"
                    >
                        <Trash2 size={20} />
                        Удалить пост
                    </button>
                ) : (
                    <button
                        onClick={handleContact}
                        className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all"
                    >
                        <Send size={20} />
                        Написать в Telegram
                    </button>
                )}
            </div>
        </motion.div>
    );
}
