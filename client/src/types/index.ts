export type Language = 'ru' | 'uz';
export type TabKey = 'feed' | 'create' | 'offers' | 'profile';
export type Role = 'client' | 'exchanger' | null;

export interface FeedPost {
  id: string;
  pair: string;
  fromCurrency: string;
  toCurrency: string;
  location: string;
  timeAgo: string;
  delta: string;
  deltaType: 'positive' | 'negative' | 'best';
  amountStr: string;
  language: Language;
  title?: string;
  thumbnailUrl?: string;
  description?: string;
  acceptedCurrencies?: string[];
  reviews?: Review[];
  averageRating?: number;
  category?: string;
  owner?: 'me' | 'other';
  ownerId?: number;
  type?: 'buy' | 'sell';
  amount?: number;
  rate?: number;
  currency?: string;
  image_data?: string;
}

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  timeAgo: string;
}

export interface Offer {
  id: string;
  exchangerName: string;
  isVerified: boolean;
  rateText: string;
  eta: string;
  isBest: boolean;
}

export interface IncomingRequest {
  id: string;
  amountStr: string;
  fromUser: string;
  isNew: boolean;
}

export interface RequestStatus {
  steps: {
    label: string;
    time: string;
    completed: boolean;
  }[];
  details: {
    send: string;
    receive: string;
    exchanger: string;
  };
}

export interface RegistrationData {
  name: string;
  phone: string;
  username?: string;
  role: Role;
  agreed: boolean;
  verified?: boolean;
  completed?: boolean;
  avatarUrl?: string;
  originalAvatarUrl?: string; // Full-size original for re-editing
  telegramId?: number;
  accountId?: number;
}
export interface Order {
  id: number;
  user_id: number;
  amount: number;
  currency: string;
  location: string;
  delivery_type: string;
  status: string;
  created_at: string;
  bids?: Bid[];
}

export interface Bid {
  id: number;
  order_id: number;
  exchanger_id: number;
  rate: number;
  time_estimate: string;
  comment: string;
  created_at: string;
  rating?: number;
  deals_count?: number;
  amount?: number; // For exchanger view
  currency?: string; // For exchanger view
  order_status?: string; // For exchanger view
  location?: string; // For exchanger view
  status?: string; // 'pending', 'accepted', 'rejected'
}
