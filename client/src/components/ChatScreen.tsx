/**
 * ChatScreen - Individual chat conversation view
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Image as ImageIcon, MoreVertical, Check, CheckCheck } from 'lucide-react';
import { Message } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ChatScreenProps {
    conversationId: number;
    otherUser: {
        id: number;
        nickname: string;
        name?: string;
        avatar_url?: string;
        is_online: boolean;
    };
    listingTitle?: string;
    messages: Message[];
    currentUserId: number;
    isLoading: boolean;
    onBack: () => void;
    onSendMessage: (content: string, imageUrl?: string) => Promise<void>;
    onTyping: () => void;
}

function formatMessageTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({
    message,
    isMine,
    showAvatar,
    otherUserAvatar,
    otherUserName,
}: {
    message: Message;
    isMine: boolean;
    showAvatar: boolean;
    otherUserAvatar?: string;
    otherUserName?: string;
}) {
    if (message.message_type === 'system') {
        return (
            <div className="flex justify-center my-4">
                <div className="bg-gray-100 rounded-full px-4 py-1.5 text-xs text-gray-500">
                    {message.content}
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "flex gap-2 mb-2",
            isMine ? "flex-row-reverse" : "flex-row"
        )}>
            {/* Avatar (for other user) */}
            {!isMine && (
                <div className="w-8 h-8 flex-shrink-0">
                    {showAvatar && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold overflow-hidden">
                            {otherUserAvatar ? (
                                <img src={otherUserAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                                otherUserName?.[0] || '?'
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Message content */}
            <div className={cn(
                "max-w-[75%]",
                isMine ? "items-end" : "items-start"
            )}>
                {/* Image */}
                {message.image_url && (
                    <div className={cn(
                        "rounded-2xl overflow-hidden mb-1",
                        isMine ? "rounded-br-md" : "rounded-bl-md"
                    )}>
                        <img
                            src={message.image_url}
                            alt=""
                            className="max-w-full max-h-60 object-cover"
                            onClick={() => window.open(message.image_url, '_blank')}
                        />
                    </div>
                )}

                {/* Text */}
                {message.content && (
                    <div className={cn(
                        "px-4 py-2.5 rounded-2xl text-sm",
                        isMine
                            ? "bg-blue-500 text-white rounded-br-md"
                            : "bg-gray-100 text-gray-900 rounded-bl-md"
                    )}>
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                )}

                {/* Time & read status */}
                <div className={cn(
                    "flex items-center gap-1 mt-1 text-[10px] text-gray-400",
                    isMine ? "justify-end" : "justify-start"
                )}>
                    <span>{formatMessageTime(message.created_at)}</span>
                    {isMine && (
                        message.is_read
                            ? <CheckCheck size={12} className="text-blue-500" />
                            : <Check size={12} />
                    )}
                </div>
            </div>
        </div>
    );
}

export function ChatScreen({
    conversationId,
    otherUser,
    listingTitle,
    messages,
    currentUserId,
    isLoading,
    onBack,
    onSendMessage,
    onTyping,
}: ChatScreenProps) {
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSend = async () => {
        const content = inputValue.trim();
        if (!content || isSending) return;

        setIsSending(true);
        setInputValue('');

        try {
            await onSendMessage(content);
        } catch (error) {
            // Restore message on error
            setInputValue(content);
        } finally {
            setIsSending(false);
            inputRef.current?.focus();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);

        // Send typing indicator (debounced)
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
            onTyping();
        }, 500);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Group messages by date
    const groupedMessages: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    messages.forEach(msg => {
        const msgDate = new Date(msg.created_at).toLocaleDateString('ru', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });

        if (msgDate !== currentDate) {
            currentDate = msgDate;
            groupedMessages.push({ date: msgDate, messages: [msg] });
        } else {
            groupedMessages[groupedMessages.length - 1].messages.push(msg);
        }
    });

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>

                {/* User info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold overflow-hidden">
                            {otherUser.avatar_url ? (
                                <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                otherUser.name?.[0] || otherUser.nickname[0].toUpperCase()
                            )}
                        </div>
                        {otherUser.is_online && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                        )}
                    </div>

                    <div className="min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">
                            {otherUser.name || otherUser.nickname}
                        </h4>
                        {listingTitle && (
                            <p className="text-xs text-blue-500 truncate">{listingTitle}</p>
                        )}
                        {otherUser.is_online && !listingTitle && (
                            <p className="text-xs text-green-500">Онлайн</p>
                        )}
                    </div>
                </div>

                {/* Menu button */}
                <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                    <MoreVertical size={20} className="text-gray-600" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                            <span className="text-2xl">👋</span>
                        </div>
                        <p className="text-gray-500 text-sm">
                            Начните диалог! Напишите сообщение ниже.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {groupedMessages.map((group, groupIndex) => (
                            <div key={group.date}>
                                {/* Date separator */}
                                <div className="flex justify-center mb-4">
                                    <span className="bg-gray-100 rounded-full px-4 py-1 text-xs text-gray-500">
                                        {group.date}
                                    </span>
                                </div>

                                {/* Messages */}
                                {group.messages.map((msg, msgIndex) => {
                                    const isMine = msg.sender_id === currentUserId;
                                    const prevMsg = msgIndex > 0 ? group.messages[msgIndex - 1] : null;
                                    const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id;

                                    return (
                                        <MessageBubble
                                            key={msg.id}
                                            message={msg}
                                            isMine={isMine}
                                            showAvatar={showAvatar}
                                            otherUserAvatar={otherUser.avatar_url}
                                            otherUserName={otherUser.name || otherUser.nickname}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                    {/* Attach image button */}
                    <button className="p-2.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                        <ImageIcon size={20} />
                    </button>

                    {/* Text input */}
                    <div className="flex-1 relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={handleInputChange}
                            onKeyPress={handleKeyPress}
                            placeholder="Сообщение..."
                            className="w-full px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:ring-2 focus:ring-blue-500/20 focus:bg-white border-0 transition-all"
                        />
                    </div>

                    {/* Send button */}
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isSending}
                        className={cn(
                            "p-2.5 rounded-full transition-all",
                            inputValue.trim()
                                ? "bg-blue-500 text-white"
                                : "bg-gray-100 text-gray-400"
                        )}
                    >
                        {isSending ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Send size={20} />
                        )}
                    </motion.button>
                </div>
            </div>
        </div>
    );
}

export default ChatScreen;
