import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, MessageCircle, Star, User, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/hooks/useStore';

const API_BASE = '';

// Avatar component
function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
    const sizeClasses = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
    const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;

    return (
        <div className={cn("rounded-full flex items-center justify-center text-white font-bold", sizeClasses[size], colors[colorIndex])}>
            {name?.charAt(0).toUpperCase() || '?'}
        </div>
    );
}

export function PostPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { userId, removePost } = useStore();

    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (id) {
            loadPost();
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

    const handleDelete = async () => {
        if (!confirm('Удалить этот пост?')) return;
        try {
            await removePost(id!);
            navigate('/');
        } catch (e) {
            alert('Ошибка удаления');
        }
    };

    const handleContact = () => {
        // Open Telegram chat with post author
        if (post?.author_username) {
            window.open(`https://t.me/${post.author_username}`, '_blank');
        }
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
                    Вернуться назад
                </button>
            </div>
        );
    }

    const isOwner = post.user_id === userId;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pb-20"
        >
            {/* Post Content */}
            <div className="bg-white">
                {/* Author */}
                <div className="p-4 border-b border-gray-100">
                    <button
                        onClick={() => navigate(`/user/${post.user_id}`)}
                        className="flex items-center gap-3"
                    >
                        <Avatar name={post.author_name || 'User'} size="md" />
                        <div className="text-left">
                            <p className="font-medium text-gray-900">{post.author_name || 'Пользователь'}</p>
                            <p className="text-xs text-gray-500">@{post.author_username || 'user'}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-1 text-yellow-500">
                            <Star size={14} className="fill-yellow-500" />
                            <span className="text-sm">{post.rating || '5.0'}</span>
                        </div>
                    </button>
                </div>

                {/* Description */}
                <div className="p-4">
                    <p className="text-gray-900 whitespace-pre-wrap">{post.description || post.buy_description}</p>
                </div>

                {/* Location */}
                {post.location && (
                    <div className="px-4 pb-4">
                        <div className="inline-flex items-center gap-1.5 text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                            <MapPin size={14} />
                            {post.location}
                        </div>
                    </div>
                )}

                {/* Time */}
                <div className="px-4 pb-4">
                    <p className="text-xs text-gray-400">
                        {new Date(post.created_at).toLocaleString('ru')}
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="p-4 space-y-3">
                {isOwner ? (
                    <>
                        <button
                            onClick={handleDelete}
                            className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-medium flex items-center justify-center gap-2"
                        >
                            <Trash2 size={18} />
                            Удалить пост
                        </button>
                    </>
                ) : (
                    <button
                        onClick={handleContact}
                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                        <MessageCircle size={18} />
                        Написать автору
                    </button>
                )}
            </div>

            {/* Author Profile Link */}
            {!isOwner && (
                <div className="px-4">
                    <button
                        onClick={() => navigate(`/user/${post.user_id}`)}
                        className="w-full py-3 border border-gray-200 rounded-xl font-medium flex items-center justify-center gap-2 text-gray-700"
                    >
                        <User size={18} />
                        Профиль автора
                    </button>
                </div>
            )}
        </motion.div>
    );
}
