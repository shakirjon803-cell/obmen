/**
 * Chat Page - Main chat container
 * Combines ChatList and ChatScreen components
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '@/hooks/useChat';
import { useStore } from '@/hooks/useStore';
import { ChatList } from './ChatList';
import { ChatScreen } from './ChatScreen';

export function Chat() {
    const { userId } = useStore();
    const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);

    const {
        conversations,
        currentConversation,
        unreadCount,
        isConnected,
        isLoading,
        error,
        openConversation,
        sendMessage,
        sendTyping,
        closeConversation,
        loadConversations,
    } = useChat({ userId, autoConnect: true });

    const handleSelectConversation = useCallback(async (conversationId: number) => {
        setSelectedConversationId(conversationId);
        await openConversation(conversationId);
    }, [openConversation]);

    const handleBack = useCallback(() => {
        setSelectedConversationId(null);
        closeConversation();
        loadConversations(); // Refresh inbox
    }, [closeConversation, loadConversations]);

    const handleSendMessage = useCallback(async (content: string, imageUrl?: string) => {
        if (!selectedConversationId) return;
        await sendMessage(selectedConversationId, content, imageUrl);
    }, [selectedConversationId, sendMessage]);

    const handleTyping = useCallback(() => {
        if (!selectedConversationId) return;
        sendTyping(selectedConversationId);
    }, [selectedConversationId, sendTyping]);

    return (
        <div className="h-full relative">
            {/* Connection status */}
            {!isConnected && !isLoading && (
                <div className="absolute top-0 left-0 right-0 bg-yellow-500 text-white text-xs text-center py-1 z-50">
                    Переподключение...
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-xs text-center py-1 z-50">
                    {error}
                </div>
            )}

            <AnimatePresence mode="wait">
                {selectedConversationId && currentConversation ? (
                    <motion.div
                        key="chat-screen"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="absolute inset-0 bg-white z-40"
                    >
                        <ChatScreen
                            conversationId={currentConversation.id}
                            otherUser={currentConversation.other_user}
                            listingTitle={currentConversation.listing_title}
                            messages={currentConversation.messages}
                            currentUserId={userId}
                            isLoading={isLoading}
                            onBack={handleBack}
                            onSendMessage={handleSendMessage}
                            onTyping={handleTyping}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="chat-list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full"
                    >
                        <div className="p-4">
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">
                                Сообщения
                                {unreadCount > 0 && (
                                    <span className="ml-2 text-sm bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                        {unreadCount}
                                    </span>
                                )}
                            </h2>
                            <p className="text-gray-500 text-sm mb-4">
                                Диалоги с продавцами и покупателями
                            </p>
                        </div>

                        <div className="px-4 pb-20">
                            <ChatList
                                conversations={conversations}
                                isLoading={isLoading}
                                onSelectConversation={handleSelectConversation}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default Chat;
