import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Language, TabKey, Role, FeedPost, Offer, IncomingRequest, RequestStatus, RegistrationData, Order, Bid } from '@/types';
import {
  createOrder, createPost, updateUser, getCategories, createCategory, getUserStats, getMyPosts, updatePost, deletePost,
  getMyBids, getMyOrders, getOrderBids, placeBid, getConfig, acceptBid, getMarketPosts
} from '@/lib/api';

interface AppState {
  language: Language;
  activeTab: TabKey;
  role: Role;
  registration: RegistrationData;
  feedPosts: FeedPost[];
  myPosts: FeedPost[]; // Added myPosts
  offers: Offer[];
  incomingRequests: IncomingRequest[];
  requestStatus: RequestStatus | null;
  prefillData: { fromCurrency?: string; toCurrency?: string } | null;
  showOfferModal: boolean;
  showHandoffModal: boolean;
  handoffData: {
    orderId?: string;
    amountStr?: string;
  } | null;
  searchQuery: string;
  selectedPost: FeedPost | null;
  onboardingSeen: boolean;
  categoryFilter: string | null;
  showAddReviewModal: boolean;
  hasAccount: boolean;
  loginMode: boolean;
  showAddPostModal: boolean;
  userId: number; // Added userId
  isSwitchingRole: boolean;
  categories: string[];
  stats: { active: number; completed: number };

  setLanguage: (lang: Language) => void;
  setActiveTab: (tab: TabKey) => void;
  setRole: (role: Role) => void;
  setRegistration: (data: Partial<RegistrationData>) => void;
  completeRegistration: () => void;
  openCreateWithPrefill: (from: string, to: string) => void;
  clearPrefill: () => void;
  setShowOfferModal: (show: boolean) => void;
  setShowHandoffModal: (show: boolean) => void;
  setHandoffData: (data: AppState['handoffData']) => void;
  setSearchQuery: (query: string) => void;
  setSelectedPost: (post: FeedPost | null) => void;
  getFilteredPosts: () => FeedPost[];
  setOnboardingSeen: (seen: boolean) => void;
  setCategoryFilter: (category: string | null) => void;
  setShowAddReviewModal: (show: boolean) => void;
  addReview: (postId: string, review: Omit<import('@/types').Review, 'id'>) => void;
  openLogin: () => void;
  closeLogin: () => void;
  completeLogin: (data: { name: string; phone: string }) => void;
  toggleRole: () => Promise<void>;
  updateProfile: (data: { name: string; phone?: string }) => Promise<void>;
  setShowAddPostModal: (show: boolean) => void;
  addPost: (post: Omit<FeedPost, 'id' | 'language'>) => Promise<void>; // Changed to async
  submitOrder: (order: any) => Promise<void>; // Added submitOrder
  logout: () => void;
  fetchCategories: () => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchMyPosts: () => Promise<void>;
  editPost: (postId: string, data: any) => Promise<void>;
  removePost: (postId: string) => Promise<void>;
  editingPost: FeedPost | null;
  setEditingPost: (post: FeedPost | null) => void;
  myBids: Bid[];
  myOrders: Order[];
  fetchMyBids: () => Promise<void>;
  fetchMyOrders: () => Promise<void>;
  fetchOrderBids: (orderId: number) => Promise<Bid[]>;
  submitBid: (bidData: any) => Promise<void>;
  acceptBid: (bidId: number) => Promise<void>;
  botUsername: string;
  fetchConfig: () => Promise<void>;
  fetchMarketPosts: () => Promise<void>;
  setTelegramUser: (data: { id?: number; username?: string; name?: string }) => void;
  loadAccountAvatar: () => Promise<void>;
}

const sampleFeedPostsRU: FeedPost[] = [];
const sampleFeedPostsUZ: FeedPost[] = [];
const sampleOffers: Offer[] = [];
const sampleIncomingRequests: IncomingRequest[] = [];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      language: 'ru',
      activeTab: 'feed',
      role: null,
      registration: {
        name: '',
        phone: '',
        username: '',
        role: null,
        agreed: false,
        verified: false
      },
      feedPosts: sampleFeedPostsRU,
      myPosts: [], // Initialize myPosts
      offers: sampleOffers,
      incomingRequests: sampleIncomingRequests,
      requestStatus: null,
      prefillData: null,
      showOfferModal: false,
      showHandoffModal: false,
      handoffData: null,
      searchQuery: '',
      selectedPost: null,
      onboardingSeen: false,
      categoryFilter: null,
      showAddReviewModal: false,
      hasAccount: false,
      loginMode: false,
      showAddPostModal: false,
      userId: Math.floor(Math.random() * 1_000_000_000), // overwritten by Telegram init data
      isSwitchingRole: false,
      categories: ['USD', 'BTC', 'UZS'],
      stats: { active: 0, completed: 0 },
      myBids: [],
      myOrders: [],
      botUsername: '',
      fetchMarketPosts: async () => {
        try {
          const posts = await getMarketPosts();
          const mapped: FeedPost[] = posts.map((p: any) => ({
            id: String(p.id),
            pair: `${p.currency}`,
            fromCurrency: p.currency,
            toCurrency: p.currency,
            location: p.location || '',
            timeAgo: '',
            delta: '+0%',
            deltaType: 'positive',
            amountStr: `${p.amount} @ ${p.rate}`,
            language: 'ru',
            title: p.title || p.description?.slice(0, 60) || p.currency || '',
            thumbnailUrl: p.image_data,
            description: p.description,
            acceptedCurrencies: [p.currency],
            category: p.category,
            owner: 'other',
            ownerId: p.user_id,
            type: p.type,
            amount: p.amount,
            rate: p.rate,
            currency: p.currency,
            author_username: p.author_username,
            author_name: p.author_name
          }));
          set({ feedPosts: mapped });
        } catch (error) {
          console.error('Failed to fetch market posts', error);
        }
      },

      fetchConfig: async () => {
        try {
          const config = await getConfig();
          set({ botUsername: config.bot_username });
        } catch (error) {
          console.error('Failed to fetch config', error);
        }
      },

      setLanguage: (lang) => set(() => ({
        language: lang,
        feedPosts: lang === 'ru' ? sampleFeedPostsRU : sampleFeedPostsUZ
      })),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setRole: (role) => set({ role }),

      setRegistration: (data) => set((state) => ({
        registration: { ...state.registration, ...data }
      })),

      completeRegistration: () => set((state) => ({
        registration: { ...state.registration, completed: true },
        role: state.registration.role,
        activeTab: 'feed',
        hasAccount: true
      })),

      openCreateWithPrefill: (from, to) => set({
        activeTab: 'create',
        prefillData: { fromCurrency: from, toCurrency: to }
      }),

      clearPrefill: () => set({ prefillData: null }),

      setShowOfferModal: (show) => set({ showOfferModal: show }),

      setShowHandoffModal: (show) => set({ showHandoffModal: show }),

      setHandoffData: (data) => set({ handoffData: data }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      setSelectedPost: (post) => set({ selectedPost: post }),

      setOnboardingSeen: (seen) => set({ onboardingSeen: seen }),

      setCategoryFilter: (category) => set({ categoryFilter: category }),

      setShowAddReviewModal: (show) => set({ showAddReviewModal: show }),

      addReview: (postId, review) => set((state) => {
        const newReview = {
          ...review,
          id: Date.now().toString()
        };

        const updatedPosts = state.feedPosts.map(post => {
          if (post.id === postId) {
            const reviews = [...(post.reviews || []), newReview];
            const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
            return { ...post, reviews, averageRating };
          }
          return post;
        });

        return {
          feedPosts: updatedPosts,
          selectedPost: state.selectedPost?.id === postId
            ? { ...state.selectedPost, reviews: [...(state.selectedPost.reviews || []), newReview] }
            : state.selectedPost
        };
      }),

      getFilteredPosts: () => {
        const { feedPosts, searchQuery, categoryFilter } = get();
        let filtered = feedPosts;

        if (categoryFilter) {
          filtered = filtered.filter(post => post.category === categoryFilter);
        }

        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(post =>
            (post.title?.toLowerCase().includes(query)) ||
            post.pair.toLowerCase().includes(query) ||
            post.location.toLowerCase().includes(query)
          );
        }

        return filtered;
      },

      openLogin: () => set({ loginMode: true, onboardingSeen: true }),

      closeLogin: () => set({ loginMode: false }),

      completeLogin: (data) => set((state) => ({
        registration: { ...state.registration, name: data.name, phone: data.phone, agreed: true, verified: true },
        hasAccount: true,
        loginMode: false,
        activeTab: 'feed'
      })),

      toggleRole: async () => {
        set({ isSwitchingRole: true });
        await new Promise(resolve => setTimeout(resolve, 800)); // Fake loading
        set((state) => ({
          role: state.role === 'client' ? 'exchanger' : 'client',
          isSwitchingRole: false
        }));
      },

      setShowAddPostModal: (show) => set({ showAddPostModal: show }),

      addPost: async (post) => {
        const state = get();
        const newPost: FeedPost = {
          ...post,
          id: Date.now().toString(),
          language: state.language,
          owner: 'me',
          ownerId: state.userId
        };

        // Optimistic update
        set((state) => ({
          feedPosts: [newPost, ...state.feedPosts]
        }));

        try {
          await createPost({
            user_id: state.userId,
            type: post.type || 'sell',
            amount: post.amount || 0,
            currency: post.currency || post.fromCurrency || '',
            rate: post.rate || 0,
            location: post.location || '',
            description: post.description || '',
            image_data: (post as any).image_data,
            title: post.title || ''
          });
        } catch (error) {
          console.error('Failed to sync post to backend', error);
        }
      },

      submitOrder: async (order) => {
        const state = get();
        try {
          const response = await createOrder({
            user_id: state.userId,
            ...order
          });
          // Set handoff data
          set({
            handoffData: {
              orderId: response.id,
              amountStr: `${order.amount} ${order.currency} `
            },
            showHandoffModal: true
          });
        } catch (error) {
          console.error('Failed to submit order', error);
          throw error;
        }
      },

      updateProfile: async (data: { name: string; phone?: string }) => {
        const state = get();
        try {
          await updateUser({
            user_id: state.userId,
            name: data.name,
            phone: data.phone || state.registration.phone || '',
            username: state.registration.username
          });
          set((state) => ({
            registration: { ...state.registration, ...data }
          }));
        } catch (error) {
          console.error('Failed to update profile', error);
          throw error;
        }
      },

      fetchCategories: async () => {
        try {
          const categories = await getCategories();
          set({ categories });
        } catch (error) {
          console.error('Failed to fetch categories', error);
        }
      },

      addCategory: async (name: string) => {
        const state = get();
        try {
          await createCategory(name, state.userId);
          // Refresh categories
          const categories = await getCategories();
          set({ categories });
        } catch (error) {
          console.error('Failed to add category', error);
          throw error;
        }
      },

      fetchStats: async () => {
        const state = get();
        try {
          const stats = await getUserStats(state.userId);
          set({ stats });
        } catch (error) {
          console.error('Failed to fetch stats', error);
        }
      },

      editingPost: null,
      setEditingPost: (post) => set({ editingPost: post }),

      fetchMyPosts: async () => {
        const state = get();
        try {
          const posts = await getMyPosts(state.userId);
          set({ myPosts: posts });
        } catch (error) {
          console.error('Failed to fetch my posts', error);
        }
      },

      editPost: async (postId: string, data: any) => {
        const state = get();
        try {
          await updatePost(postId, { ...data, user_id: state.userId });
          // Refresh posts
          const posts = await getMyPosts(state.userId);
          set({ myPosts: posts });
          set({ editingPost: null }); // Close modal
        } catch (error) {
          console.error('Failed to edit post', error);
          throw error;
        }
      },

      removePost: async (postId: string) => {
        const state = get();
        try {
          await deletePost(postId, state.userId);
          // Refresh posts
          const posts = await getMyPosts(state.userId);
          set({ myPosts: posts });
        } catch (error) {
          console.error('Failed to remove post', error);
          throw error;
        }
      },

      fetchMyBids: async () => {
        const state = get();
        if (!state.userId) return;
        try {
          const bids = await getMyBids(state.userId);
          set({ myBids: bids });
        } catch (error) {
          console.error('Failed to fetch my bids', error);
        }
      },

      fetchMyOrders: async () => {
        const state = get();
        if (!state.userId) return;
        try {
          const orders = await getMyOrders(state.userId);
          set({ myOrders: orders });
        } catch (error) {
          console.error('Failed to fetch my orders', error);
        }
      },

      fetchOrderBids: async (orderId: number) => {
        try {
          const bids = await getOrderBids(orderId);
          return bids;
        } catch (error) {
          console.error('Failed to fetch order bids', error);
          return [];
        }
      },

      submitBid: async (bidData: any) => {
        const state = get();
        try {
          await placeBid({ ...bidData, exchanger_id: state.userId });
          get().fetchMyBids();
        } catch (error) {
          console.error('Failed to submit bid', error);
        }
      },

      acceptBid: async (bidId: number) => {
        try {
          const res = await acceptBid(bidId);
          // Refresh orders to show updated status
          get().fetchMyOrders();
          // Open handoff modal
          const state = get();
          const order = state.myOrders.find(o => o.id === res.order_id);
          if (order) {
            set({
              showHandoffModal: true,
              handoffData: {
                orderId: order.id.toString(),
                amountStr: `${order.amount} ${order.currency}`
              }
            });
          }
        } catch (error) {
          console.error('Failed to accept bid', error);
        }
      },

      logout: () => {
        // Clear localStorage first
        localStorage.removeItem('obmen-storage');
        // Reset state
        set({
          registration: { name: '', phone: '', username: '', role: null, agreed: false, verified: false },
          role: null,
          hasAccount: false,
          loginMode: false,
          activeTab: 'feed',
          feedPosts: [],
          selectedPost: null,
          onboardingSeen: true // Keep onboarding seen
        });
        // Force reload to clean state
        window.location.reload();
      },

      setTelegramUser: (data: { id?: number; username?: string; name?: string }) => {
        set((state) => ({
          userId: data.id || state.userId,
          registration: {
            ...state.registration,
            username: data.username || state.registration.username,
            name: data.name || state.registration.name
          }
        }));
      },

      loadAccountAvatar: async () => {
        const state = get();
        const accountId = state.registration.accountId;
        if (!accountId) return;

        try {
          const res = await fetch(`/api/account?account_id=${accountId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.avatar_url || data.original_avatar_url) {
              set((s) => ({
                registration: {
                  ...s.registration,
                  avatarUrl: data.avatar_url,
                  originalAvatarUrl: data.original_avatar_url
                }
              }));
            }
          }
        } catch (e) {
          console.error('Failed to load account avatar', e);
        }
      }

    }),
    {
      name: 'obmen-storage',
      storage: createJSONStorage(() => localStorage),
      // DON'T persist feedPosts - they contain base64 images and overflow localStorage!
      partialize: (state) => ({
        language: state.language,
        role: state.role,
        registration: {
          ...state.registration,
          avatarUrl: undefined, // Don't persist avatar base64
          originalAvatarUrl: undefined
        },
        hasAccount: state.hasAccount,
        onboardingSeen: state.onboardingSeen,
        userId: state.userId
      }),
    }
  )
);
