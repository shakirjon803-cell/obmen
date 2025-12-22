/**
 * useChat Hook - Real-time messaging with WebSocket
 * 
 * Features:
 * - WebSocket connection management
 * - Auto-reconnect on disconnect
 * - Message sending/receiving
 * - Typing indicators
 * - Read receipts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { WS_URL } from '@/lib/config';
import { chatApi, getToken, Message, Conversation } from '@/lib/api';

interface ChatState {
    conversations: Conversation[];
    currentConversation: {
        id: number;
        other_user: Conversation['other_user'];
        listing_id?: number;
        listing_title?: string;
        messages: Message[];
        is_blocked: boolean;
    } | null;
    unreadCount: number;
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;
}

interface UseChatOptions {
    userId: number;
    autoConnect?: boolean;
}

interface WebSocketMessage {
    type: 'message' | 'typing' | 'read' | 'online' | 'error';
    conversation_id?: number;
    data: any;
}

export function useChat({ userId, autoConnect = true }: UseChatOptions) {
    const [state, setState] = useState<ChatState>({
        conversations: [],
        currentConversation: null,
        unreadCount: 0,
        isConnected: false,
        isLoading: true,
        error: null,
    });

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    // Load conversations
    const loadConversations = useCallback(async () => {
        try {
            const token = getToken();
            if (!token) return;

            const conversations = await chatApi.getConversations();
            const { unread_count } = await chatApi.getUnreadCount();

            setState(prev => ({
                ...prev,
                conversations,
                unreadCount: unread_count,
                isLoading: false,
            }));
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                error: error.message,
                isLoading: false,
            }));
        }
    }, []);

    // Load single conversation with messages
    const openConversation = useCallback(async (conversationId: number) => {
        try {
            setState(prev => ({ ...prev, isLoading: true }));

            const conversation = await chatApi.getConversation(conversationId);

            setState(prev => ({
                ...prev,
                currentConversation: conversation,
                isLoading: false,
                // Update unread count in conversations list
                conversations: prev.conversations.map(c =>
                    c.id === conversationId ? { ...c, unread_count: 0 } : c
                ),
            }));
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                error: error.message,
                isLoading: false,
            }));
        }
    }, []);

    // Start new conversation
    const startConversation = useCallback(async (
        recipientId: number,
        listingId?: number,
        initialMessage?: string
    ): Promise<number | null> => {
        try {
            const conversation = await chatApi.startConversation({
                recipient_id: recipientId,
                listing_id: listingId,
                initial_message: initialMessage,
            });

            // Refresh conversations list
            await loadConversations();

            return conversation.id;
        } catch (error: any) {
            setState(prev => ({ ...prev, error: error.message }));
            return null;
        }
    }, [loadConversations]);

    // Send message
    const sendMessage = useCallback(async (
        conversationId: number,
        content: string,
        imageUrl?: string
    ) => {
        try {
            const message = await chatApi.sendMessage(conversationId, {
                content,
                image_url: imageUrl,
            });

            // Add message to current conversation
            setState(prev => ({
                ...prev,
                currentConversation: prev.currentConversation
                    ? {
                        ...prev.currentConversation,
                        messages: [...prev.currentConversation.messages, message],
                    }
                    : null,
                // Update last message in conversations list
                conversations: prev.conversations.map(c =>
                    c.id === conversationId
                        ? { ...c, last_message: content || '[Изображение]', last_message_at: message.created_at }
                        : c
                ),
            }));

            // Also send via WebSocket for real-time update to other user
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'message',
                    conversation_id: conversationId,
                    data: message,
                }));
            }

            return message;
        } catch (error: any) {
            setState(prev => ({ ...prev, error: error.message }));
            throw error;
        }
    }, []);

    // Send typing indicator
    const sendTyping = useCallback((conversationId: number) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'typing',
                conversation_id: conversationId,
            }));
        }
    }, []);

    // Mark messages as read
    const markAsRead = useCallback(async (conversationId: number) => {
        try {
            await chatApi.markAsRead(conversationId);

            // Update local state
            setState(prev => ({
                ...prev,
                currentConversation: prev.currentConversation
                    ? {
                        ...prev.currentConversation,
                        messages: prev.currentConversation.messages.map(m => ({
                            ...m,
                            is_read: true,
                        })),
                    }
                    : null,
                conversations: prev.conversations.map(c =>
                    c.id === conversationId ? { ...c, unread_count: 0 } : c
                ),
                unreadCount: prev.unreadCount - (
                    prev.conversations.find(c => c.id === conversationId)?.unread_count || 0
                ),
            }));

            // Notify via WebSocket
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'read',
                    conversation_id: conversationId,
                }));
            }
        } catch (error: any) {
            console.error('Failed to mark as read:', error);
        }
    }, []);

    // Close current conversation
    const closeConversation = useCallback(() => {
        setState(prev => ({ ...prev, currentConversation: null }));
    }, []);

    // WebSocket connection
    const connect = useCallback(() => {
        const token = getToken();
        if (!token || !userId) return;

        // Close existing connection
        if (wsRef.current) {
            wsRef.current.close();
        }

        const wsUrl = `${WS_URL}/${userId}`;
        console.log('Connecting to WebSocket:', wsUrl);

        try {
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                console.log('WebSocket connected');
                setState(prev => ({ ...prev, isConnected: true }));
                reconnectAttempts.current = 0;
            };

            wsRef.current.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code);
                setState(prev => ({ ...prev, isConnected: false }));

                // Auto-reconnect with exponential backoff
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                    console.log(`Reconnecting in ${delay}ms...`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current++;
                        connect();
                    }, delay);
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setState(prev => ({ ...prev, error: 'Ошибка соединения' }));
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);

                    switch (message.type) {
                        case 'message':
                            // New message received
                            handleNewMessage(message.conversation_id!, message.data);
                            break;

                        case 'typing':
                            // Someone is typing
                            handleTyping(message.conversation_id!, message.data.user_id);
                            break;

                        case 'read':
                            // Messages were read
                            handleRead(message.conversation_id!);
                            break;

                        case 'online':
                            // User online status changed
                            handleOnlineStatus(message.data.user_id, message.data.is_online);
                            break;
                    }
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
        }
    }, [userId]);

    // Handle incoming message
    const handleNewMessage = useCallback((conversationId: number, message: Message) => {
        setState(prev => {
            // Update current conversation if it's open
            const updatedCurrentConversation = prev.currentConversation?.id === conversationId
                ? {
                    ...prev.currentConversation,
                    messages: [...prev.currentConversation.messages, message],
                }
                : prev.currentConversation;

            // Update conversations list
            const updatedConversations = prev.conversations.map(c =>
                c.id === conversationId
                    ? {
                        ...c,
                        last_message: message.content || '[Изображение]',
                        last_message_at: message.created_at,
                        unread_count: prev.currentConversation?.id === conversationId ? 0 : c.unread_count + 1,
                    }
                    : c
            );

            // Sort by last message
            updatedConversations.sort((a, b) =>
                new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
            );

            return {
                ...prev,
                currentConversation: updatedCurrentConversation,
                conversations: updatedConversations,
                unreadCount: prev.currentConversation?.id === conversationId
                    ? prev.unreadCount
                    : prev.unreadCount + 1,
            };
        });
    }, []);

    // Handle typing indicator
    const handleTyping = useCallback((conversationId: number, typingUserId: number) => {
        // You can implement typing indicator display here
        console.log(`User ${typingUserId} is typing in conversation ${conversationId}`);
    }, []);

    // Handle read receipt
    const handleRead = useCallback((conversationId: number) => {
        setState(prev => ({
            ...prev,
            currentConversation: prev.currentConversation?.id === conversationId
                ? {
                    ...prev.currentConversation,
                    messages: prev.currentConversation.messages.map(m => ({
                        ...m,
                        is_read: true,
                    })),
                }
                : prev.currentConversation,
        }));
    }, []);

    // Handle online status
    const handleOnlineStatus = useCallback((onlineUserId: number, isOnline: boolean) => {
        setState(prev => ({
            ...prev,
            conversations: prev.conversations.map(c =>
                c.other_user.id === onlineUserId
                    ? { ...c, other_user: { ...c.other_user, is_online: isOnline } }
                    : c
            ),
            currentConversation: prev.currentConversation?.other_user.id === onlineUserId
                ? {
                    ...prev.currentConversation,
                    other_user: { ...prev.currentConversation.other_user, is_online: isOnline },
                }
                : prev.currentConversation,
        }));
    }, []);

    // Disconnect
    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    // Auto-connect on mount
    useEffect(() => {
        if (autoConnect && userId) {
            loadConversations();
            connect();
        }

        return () => {
            disconnect();
        };
    }, [autoConnect, userId, loadConversations, connect, disconnect]);

    return {
        ...state,
        loadConversations,
        openConversation,
        startConversation,
        sendMessage,
        sendTyping,
        markAsRead,
        closeConversation,
        connect,
        disconnect,
    };
}

export default useChat;
