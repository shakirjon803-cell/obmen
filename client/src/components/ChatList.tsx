/**
 * ChatList - Inbox with all conversations
 */

import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Search, ChevronRight } from 'lucide-react';
import { Conversation } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ChatListProps {
    conversations: Conversation[];
    isLoading: boolean;
    onSelectConversation: (conversationId: number) => void;
}

function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Today - show time
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.getDate() === yesterday.getDate()) {
        return 'Вчера';
    }

    // This week - show day name
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString('ru', { weekday: 'short' });
    }

    // Older - show date
    return date.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

function ConversationItem({
    conversation,
    onClick,
}: {
    conversation: Conversation;
    onClick: () => void;
}) {
    const { other_user, last_message, last_message_at, unread_count, listing_title } = conversation;

    return (
        <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className="flex items-center gap-3 p-4 bg-white rounded-2xl cursor-pointer hover:bg-gray-50 transition-colors"
        >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-semibold overflow-hidden">
                    {other_user.avatar_url ? (
                        <img src={other_user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        other_user.name?.[0] || other_user.nickname[0].toUpperCase()
                    )}
                </div>

                {/* Online indicator */}
                {other_user.is_online && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-gray-900 truncate">
                        {other_user.name || other_user.nickname}
                    </h4>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {formatTime(last_message_at)}
                    </span>
                </div>

                {listing_title && (
                    <p className="text-xs text-blue-500 truncate mb-0.5">
                        {listing_title}
                    </p>
                )}

                <p className={cn(
                    "text-sm truncate",
                    unread_count > 0 ? "text-gray-900 font-medium" : "text-gray-500"
                )}>
                    {last_message || 'Нажмите, чтобы начать диалог'}
                </p>
            </div>

            {/* Unread badge or arrow */}
            <div className="flex-shrink-0">
                {unread_count > 0 ? (
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                        <span className="text-xs text-white font-semibold">
                            {unread_count > 99 ? '99+' : unread_count}
                        </span>
                    </div>
                ) : (
                    <ChevronRight size={20} className="text-gray-300" />
                )}
            </div>
        </motion.div>
    );
}

export function ChatList({ conversations, isLoading, onSelectConversation }: ChatListProps) {
    const [searchQuery, setSearchQuery] = React.useState('');

    const filteredConversations = conversations.filter(conv => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            conv.other_user.name?.toLowerCase().includes(query) ||
            conv.other_user.nickname.toLowerCase().includes(query) ||
            conv.listing_title?.toLowerCase().includes(query)
        );
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 mt-4">Загрузка...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск диалогов..."
                    className="w-full pl-11 pr-4 py-3 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-gray-900/10 focus:bg-white transition-all"
                />
            </div>

            {/* Conversations list */}
            {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <MessageCircle size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {searchQuery ? 'Ничего не найдено' : 'Нет сообщений'}
                    </h3>
                    <p className="text-gray-500 text-center text-sm">
                        {searchQuery
                            ? 'Попробуйте изменить запрос'
                            : 'Начните диалог с продавцом, нажав "Написать" в объявлении'
                        }
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredConversations.map((conv, index) => (
                        <motion.div
                            key={conv.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                        >
                            <ConversationItem
                                conversation={conv}
                                onClick={() => onSelectConversation(conv.id)}
                            />
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ChatList;
