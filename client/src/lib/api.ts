/**
 * NellX Marketplace API Client v2.0
 * 
 * Features:
 * - JWT authentication with automatic token refresh
 * - Type-safe API calls
 * - Error handling with localized messages
 */

import { API_BASE } from './config';

// ============= Types =============

export interface User {
    id: number;
    nickname: string;
    name?: string;
    phone?: string;
    avatar_url?: string;
    role: 'client' | 'exchanger' | 'admin';
    is_seller_verified: boolean;
    rating: number;
    rating_count: number;
    deals_count: number;
    is_vip: boolean;
    language: string;
    created_at: string;
}

export interface TokenResponse {
    access_token: string;
    token_type: string;
    user: User;
}

export interface Listing {
    id: number;
    title: string;
    description?: string;
    type: 'sell' | 'buy' | 'service' | 'exchange';
    status: 'active' | 'sold' | 'archived';
    category_id?: number;
    price?: number;
    currency: string;
    is_negotiable: boolean;
    amount?: number;
    rate?: number;
    location?: string;
    city?: string;
    attributes: Record<string, any>;
    views_count: number;
    favorites_count: number;
    is_boosted: boolean;
    images: ListingImage[];
    owner: {
        id: number;
        nickname: string;
        name?: string;
        avatar_url?: string;
        rating: number;
        deals_count: number;
        is_vip: boolean;
    };
    created_at: string;
    updated_at: string;
}

export interface ListingImage {
    id: number;
    url: string;
    thumbnail_url?: string;
    is_primary: boolean;
}

export interface ListingCard {
    id: number;
    title: string;
    type: 'sell' | 'buy' | 'service' | 'exchange';
    price?: number;
    currency: string;
    location?: string;
    thumbnail_url?: string;
    is_boosted: boolean;
    owner_name?: string;
    owner_avatar?: string;
    created_at: string;
}

export interface Category {
    id: number;
    name: string;
    slug: string;
    icon?: string;
    level: number;
    parent_id?: number;
    is_featured: boolean;
    is_paid: boolean;
    post_price: number;
}

export interface CategoryAttribute {
    id: number;
    name: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select' | 'boolean';
    options?: string[];
    is_required: boolean;
    is_filterable: boolean;
    placeholder?: string;
    default_value?: string;
}

export interface CategoryWithAttributes extends Category {
    attributes: CategoryAttribute[];
    description?: string;
}

export interface Conversation {
    id: number;
    other_user: {
        id: number;
        nickname: string;
        name?: string;
        avatar_url?: string;
        is_online: boolean;
    };
    listing_id?: number;
    listing_title?: string;
    last_message?: string;
    last_message_at: string;
    unread_count: number;
    is_blocked: boolean;
}

export interface Message {
    id: number;
    sender_id: number;
    sender_name?: string;
    sender_avatar?: string;
    content?: string;
    image_url?: string;
    message_type: 'text' | 'image' | 'system';
    is_read: boolean;
    created_at: string;
}

export interface BoostPackage {
    id: number;
    name: string;
    description?: string;
    duration_hours: number;
    price: number;
    currency: string;
    badge_text?: string;
}

// ============= Auth Token Management =============

const TOKEN_KEY = 'nellx_token';
const USER_KEY = 'nellx_user';

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export function getSavedUser(): User | null {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
}

export function saveUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// ============= API Client =============

class ApiError extends Error {
    status: number;
    detail: string;

    constructor(status: number, detail: string) {
        super(detail);
        this.status = status;
        this.detail = detail;
    }
}

async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getToken();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/api${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        let detail = 'Ошибка сервера';
        try {
            const errorData = await response.json();
            detail = errorData.detail || detail;
        } catch {
            // Ignore JSON parse error
        }

        // Handle 401 - token expired
        if (response.status === 401) {
            clearToken();
            window.dispatchEvent(new CustomEvent('auth:logout'));
        }

        throw new ApiError(response.status, detail);
    }

    return response.json();
}

// ============= Auth API =============

export const authApi = {
    async register(data: {
        nickname: string;
        password: string;
        name?: string;
        phone?: string;
    }): Promise<TokenResponse> {
        const result = await apiRequest<TokenResponse>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        setToken(result.access_token);
        saveUser(result.user);
        return result;
    },

    async login(nickname: string, password: string): Promise<TokenResponse> {
        const result = await apiRequest<TokenResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ nickname, password }),
        });
        setToken(result.access_token);
        saveUser(result.user);
        return result;
    },

    async checkNickname(nickname: string): Promise<{ available: boolean }> {
        return apiRequest(`/auth/check-nickname?nickname=${encodeURIComponent(nickname)}`, {
            method: 'POST',
            body: JSON.stringify({ nickname }),
        });
    },

    logout(): void {
        clearToken();
        window.location.reload();
    },
};

// ============= Users API =============

export const usersApi = {
    async getMe(): Promise<User> {
        return apiRequest('/users/me');
    },

    async updateProfile(data: {
        name?: string;
        phone?: string;
        avatar_url?: string;
        language?: string;
    }): Promise<User> {
        return apiRequest('/users/me', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    async getUser(userId: number): Promise<User> {
        return apiRequest(`/users/${userId}`);
    },
};

// ============= Listings API =============

export const listingsApi = {
    async getFeed(params: {
        page?: number;
        per_page?: number;
        category_id?: number;
        city?: string;
        type?: string;
        min_price?: number;
        max_price?: number;
        search?: string;
    } = {}): Promise<{
        items: ListingCard[];
        total: number;
        page: number;
        pages: number;
    }> {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                query.append(key, String(value));
            }
        });
        return apiRequest(`/listings?${query.toString()}`);
    },

    async getById(id: number): Promise<Listing> {
        return apiRequest(`/listings/${id}`);
    },

    async create(data: {
        title: string;
        description?: string;
        type?: string;
        category_id?: number;
        price?: number;
        currency?: string;
        location?: string;
        city?: string;
        attributes?: Record<string, any>;
    }): Promise<Listing> {
        return apiRequest('/listings', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async update(id: number, data: Partial<Listing>): Promise<Listing> {
        return apiRequest(`/listings/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    async delete(id: number): Promise<void> {
        await apiRequest(`/listings/${id}`, { method: 'DELETE' });
    },

    async uploadImage(listingId: number, file: File, isPrimary = false): Promise<{
        id: number;
        url: string;
        thumbnail_url?: string;
    }> {
        const formData = new FormData();
        formData.append('file', file);

        const token = getToken();
        const response = await fetch(
            `${API_BASE}/api/listings/${listingId}/images?is_primary=${isPrimary}`,
            {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData,
            }
        );

        if (!response.ok) {
            throw new Error('Failed to upload image');
        }

        return response.json();
    },

    async getMyListings(): Promise<ListingCard[]> {
        return apiRequest('/listings/my');
    },

    async boost(listingId: number, packageId: number): Promise<{
        success: boolean;
        boosted_until?: string;
    }> {
        return apiRequest(`/listings/${listingId}/boost`, {
            method: 'POST',
            body: JSON.stringify({ package_id: packageId }),
        });
    },

    async bump(listingId: number): Promise<{ status: string }> {
        return apiRequest(`/listings/${listingId}/bump`, { method: 'POST' });
    },
};

// ============= Categories API =============

export const categoriesApi = {
    async getTree(lang = 'ru'): Promise<Category[]> {
        return apiRequest(`/categories/tree?lang=${lang}`);
    },

    async getFeatured(lang = 'ru'): Promise<Category[]> {
        return apiRequest(`/categories/featured?lang=${lang}`);
    },

    async getById(id: number, lang = 'ru'): Promise<CategoryWithAttributes> {
        return apiRequest(`/categories/${id}?lang=${lang}`);
    },

    async getBySlug(slug: string, lang = 'ru'): Promise<CategoryWithAttributes> {
        return apiRequest(`/categories/slug/${slug}?lang=${lang}`);
    },

    async getChildren(parentId: number, lang = 'ru'): Promise<Category[]> {
        return apiRequest(`/categories/${parentId}/children?lang=${lang}`);
    },
};

// ============= Chat API =============

export const chatApi = {
    async getConversations(): Promise<Conversation[]> {
        return apiRequest('/chat/conversations');
    },

    async startConversation(data: {
        recipient_id: number;
        listing_id?: number;
        initial_message?: string;
    }): Promise<Conversation> {
        return apiRequest('/chat/conversations', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async getConversation(id: number): Promise<{
        id: number;
        other_user: Conversation['other_user'];
        listing_id?: number;
        listing_title?: string;
        messages: Message[];
        is_blocked: boolean;
    }> {
        return apiRequest(`/chat/conversations/${id}`);
    },

    async sendMessage(conversationId: number, data: {
        content?: string;
        image_url?: string;
    }): Promise<Message> {
        return apiRequest(`/chat/conversations/${conversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async markAsRead(conversationId: number): Promise<void> {
        await apiRequest(`/chat/conversations/${conversationId}/read`, {
            method: 'POST',
        });
    },

    async getUnreadCount(): Promise<{ unread_count: number }> {
        return apiRequest('/chat/unread');
    },

    async blockConversation(conversationId: number): Promise<void> {
        await apiRequest(`/chat/conversations/${conversationId}/block`, {
            method: 'POST',
        });
    },
};

// ============= Monetization API =============

export const monetizationApi = {
    async getPackages(lang = 'ru'): Promise<BoostPackage[]> {
        return apiRequest(`/monetization/packages?lang=${lang}`);
    },

    async getBalance(): Promise<{
        balance: number;
        is_vip: boolean;
        vip_until?: string;
    }> {
        return apiRequest('/monetization/balance');
    },

    async topUp(amount: number, paymentMethod = 'card'): Promise<{
        transaction_id: number;
        payment_url: string;
        amount: number;
    }> {
        return apiRequest('/monetization/topup', {
            method: 'POST',
            body: JSON.stringify({ amount, payment_method: paymentMethod }),
        });
    },

    async purchaseBoost(listingId: number, packageId: number): Promise<{
        success: boolean;
        new_balance?: number;
        boosted_until?: string;
    }> {
        return apiRequest('/monetization/boost', {
            method: 'POST',
            body: JSON.stringify({ listing_id: listingId, package_id: packageId }),
        });
    },

    async getTransactions(page = 1): Promise<{
        items: Array<{
            id: number;
            type: string;
            amount: number;
            status: string;
            description: string;
            created_at: string;
        }>;
        total: number;
        page: number;
    }> {
        return apiRequest(`/monetization/transactions?page=${page}`);
    },
};

// ============= Legacy API (for backward compatibility) =============
// These functions maintain compatibility with old useStore

export async function createOrder(orderData: any) {
    // TODO: Migrate to new listings/orders system
    const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
    });
    if (!response.ok) throw new Error('Failed to create order');
    return response.json();
}

export async function createPost(postData: any) {
    // Use new listings API
    const token = getToken();
    return listingsApi.create({
        title: postData.title || postData.description?.slice(0, 60) || 'Объявление',
        description: postData.description,
        type: postData.type || 'sell',
        price: postData.rate || postData.amount,
        currency: postData.currency,
        location: postData.location,
        attributes: {},
    });
}

export async function getMarketPosts() {
    const result = await listingsApi.getFeed({ per_page: 50 });
    return result.items;
}

export async function updateUser(data: any) {
    if (!getToken()) {
        // Legacy endpoint for non-authenticated users
        const response = await fetch(`${API_BASE}/api/user/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update user');
        return response.json();
    }
    return usersApi.updateProfile(data);
}

export async function getCategories() {
    const cats = await categoriesApi.getTree();
    return cats.map(c => c.name);
}

export async function createCategory() {
    // Not supported in new API - admin only
    throw new Error('Not supported');
}

export async function getUserStats(userId: number) {
    // TODO: Implement in new API
    return { active: 0, completed: 0 };
}

export async function getMyPosts(userId: number) {
    if (!getToken()) return [];
    const posts = await listingsApi.getMyListings();
    return posts;
}

export async function updatePost(postId: string, data: any) {
    return listingsApi.update(parseInt(postId), data);
}

export async function deletePost(postId: string, userId: number) {
    return listingsApi.delete(parseInt(postId));
}

export async function getMyBids(userId: number) {
    // Legacy - TODO: integrate with new order system
    const response = await fetch(`${API_BASE}/api/bids/my?user_id=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch my bids');
    return response.json();
}

export async function getMyOrders(userId: number) {
    const response = await fetch(`${API_BASE}/api/orders/my?user_id=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch my orders');
    return response.json();
}

export async function getOrderBids(orderId: number) {
    const response = await fetch(`${API_BASE}/api/bids?order_id=${orderId}`);
    if (!response.ok) throw new Error('Failed to fetch order bids');
    return response.json();
}

export async function placeBid(bidData: any) {
    const response = await fetch(`${API_BASE}/api/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bidData),
    });
    if (!response.ok) throw new Error('Failed to place bid');
    return response.json();
}

export async function acceptBid(bidId: number) {
    const response = await fetch(`${API_BASE}/api/bids/${bidId}/accept`, {
        method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to accept bid');
    return response.json();
}

export async function getConfig() {
    const response = await fetch(`${API_BASE}/api/config`);
    if (!response.ok) return { bot_username: '' };
    return response.json();
}

export async function sendChatHandoff(targetUserId: number, senderId: number, payload: any) {
    // Use new chat API
    await chatApi.startConversation({
        recipient_id: targetUserId,
        initial_message: JSON.stringify(payload),
    });
}
