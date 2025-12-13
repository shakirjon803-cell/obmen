import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, MapPin, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/hooks/useStore';

const API_BASE = '';

// Avatar component
function Avatar({ name, avatarUrl, size = 'lg' }: { name: string; avatarUrl?: string; size?: 'sm' | 'md' | 'lg' }) {
    const sizeClasses = { sm: 'w-10 h-10 text-sm', md: 'w-16 h-16 text-xl', lg: 'w-24 h-24 text-3xl' };
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
    const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;

    if (avatarUrl) {
        return <img src={avatarUrl} alt={name} className={cn("rounded-full object-cover", sizeClasses[size])} />;
    }

    return (
        <div className={cn("rounded-full flex items-center justify-center text-white font-bold", sizeClasses[size], colors[colorIndex])}>
            {name?.charAt(0).toUpperCase() || '?'}
        </div>
    );
}

function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} size={16} className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
            ))}
        </div>
    );
}

type Tab = 'posts' | 'reviews';

export function UserPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { userId } = useStore();

    const [profile, setProfile] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('posts');

    const isOwnProfile = id === String(userId);

    useEffect(() => {
        if (id) {
            loadProfile();
            loadPosts();
            loadReviews();
        }
    }, [id]);

    const loadProfile = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/users/${id}`);
            const data = await res.json();
            setProfile(data);
        } catch (e) {
            console.error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const loadPosts = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/users/${id}/posts`);
            const data = await res.json();
            setPosts(data || []);
        } catch (e) {
            console.error('Failed to load posts');
        }
    };

    const loadReviews = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/users/${id}/reviews`);
            const data = await res.json();
            setReviews(data || []);
        } catch (e) {
            console.error('Failed to load reviews');
        }
    };

    // Fixed Telegram contact handler
    const handleContact = () => {
        // Try multiple ways to get the username
        let username = profile?.username || profile?.nickname;

        if (username) {
            // Clean the username - remove @ if present
            username = username.replace(/^@/, '').trim();
            // Open Telegram with the username
            const telegramUrl = `https://t.me/${username}`;
            window.open(telegramUrl, '_blank');
        } else if (profile?.telegram_id || id) {
            // Fallback: use tg://user?id= protocol for users without username
            const telegramId = profile?.telegram_id || id;
            const telegramUrl = `tg://user?id=${telegramId}`;
            window.location.href = telegramUrl;
        } else {
            alert('Контактные данные пользователя недоступны');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="text-center py-20">
                <p className="text-gray-500">Пользователь не найден</p>
                <button onClick={() => navigate('/')} className="mt-4 text-blue-500">
                    Вернуться
                </button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pb-20"
        >
            {/* Profile Header */}
            <div className="flex flex-col items-center text-center py-6 bg-white">
                <Avatar name={profile.name || 'User'} avatarUrl={profile.avatar_url} size="lg" />
                <h2 className="mt-3 text-xl font-bold text-gray-900">{profile.name}</h2>
                <p className="text-sm text-gray-500">@{profile.nickname}</p>

                {/* Rating */}
                <div className="flex items-center gap-2 mt-3">
                    <StarRating rating={Math.round(profile.rating || 5)} />
                    <span className="text-sm text-gray-600">
                        {(profile.rating || 5).toFixed(1)} ({profile.review_count || 0} отзывов)
                    </span>
                </div>

                {/* Role Badge */}
                <div className={cn(
                    "mt-3 px-3 py-1 rounded-full text-xs font-medium",
                    profile.role === 'exchanger' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                )}>
                    {profile.role === 'exchanger' ? 'Обменник' : 'Клиент'}
                </div>

                {/* Contact Button - Only show for other users */}
                {!isOwnProfile && (
                    <button
                        onClick={handleContact}
                        className="mt-4 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center gap-2 active:scale-[0.98] transition-all"
                    >
                        <Send size={16} />
                        Написать в Telegram
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 m-4 rounded-xl p-1">
                <button
                    onClick={() => setActiveTab('posts')}
                    className={cn(
                        'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                        activeTab === 'posts' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                    )}
                >
                    Посты ({posts.length})
                </button>
                <button
                    onClick={() => setActiveTab('reviews')}
                    className={cn(
                        'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                        activeTab === 'reviews' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                    )}
                >
                    Отзывы ({reviews.length})
                </button>
            </div>

            {/* Content */}
            <div className="px-4 space-y-3">
                {activeTab === 'posts' && (
                    <>
                        {posts.length === 0 ? (
                            <p className="text-center text-gray-400 py-8">Нет постов</p>
                        ) : (
                            posts.map((post: any) => (
                                <button
                                    key={post.id}
                                    onClick={() => navigate(`/post/${post.id}`)}
                                    className="w-full bg-white rounded-xl p-4 text-left shadow-sm border border-gray-100"
                                >
                                    <p className="text-sm text-gray-900 line-clamp-2">{post.description || post.buy_description}</p>
                                    {post.location && (
                                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                                            <MapPin size={12} />
                                            {post.location}
                                        </div>
                                    )}
                                </button>
                            ))
                        )}
                    </>
                )}

                {activeTab === 'reviews' && (
                    <>
                        {reviews.length === 0 ? (
                            <p className="text-center text-gray-400 py-8">Нет отзывов</p>
                        ) : (
                            reviews.map((review: any) => (
                                <div key={review.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Avatar name={review.from_name || 'User'} size="sm" />
                                        <div>
                                            <p className="text-sm font-medium">{review.from_name}</p>
                                            <StarRating rating={review.rating} />
                                        </div>
                                    </div>
                                    {review.comment && (
                                        <p className="text-sm text-gray-600 mt-2">{review.comment}</p>
                                    )}
                                </div>
                            ))
                        )}
                    </>
                )}
            </div>
        </motion.div>
    );
}
