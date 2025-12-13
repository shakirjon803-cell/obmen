import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/hooks/useStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { t } from '@/lib/i18n';
import { Clock, ChevronDown, ChevronUp, Loader, DollarSign, MapPin, Send, CheckCircle, X, Trash2, Archive, MessageCircle, User } from 'lucide-react';
import { Button } from './ui/button';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import type { Bid, Order } from '@/types';

const API_BASE = '';

// Time ago helper function
function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds} сек назад`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} д назад`;
}

// Swipeable Order Card Component for exchangers
function SwipeableOrderCard({
  order,
  onAccept,
  onDismiss,
  children
}: {
  order: Order;
  onAccept: (order: Order) => void;
  onDismiss: (orderId: number) => void;
  children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [-150, 0, 150],
    ['#ef4444', '#ffffff', '#22c55e']
  );
  const opacity = useTransform(x, [-150, -50, 0, 50, 150], [1, 0.5, 0, 0.5, 1]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 100) {
      // Swiped right - Accept/Offer rate
      onAccept(order);
    } else if (info.offset.x < -100) {
      // Swiped left - Dismiss
      onDismiss(order.id);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Background actions */}
      <motion.div
        style={{ backgroundColor: background }}
        className="absolute inset-0 flex items-center justify-between px-6 rounded-xl"
      >
        <motion.div style={{ opacity }} className="flex items-center gap-2 text-white">
          <X size={24} />
          <span className="font-medium">Пропустить</span>
        </motion.div>
        <motion.div style={{ opacity }} className="flex items-center gap-2 text-white">
          <span className="font-medium">Предложить</span>
          <CheckCircle size={24} />
        </motion.div>
      </motion.div>

      {/* Swipeable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative bg-white border border-gray-200 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}

export function Offers() {
  const { language, role, myOrders, fetchMyOrders, fetchOrderBids, acceptBid, userId } = useStore();
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [orderBids, setOrderBids] = useState<Record<number, Bid[]>>({});
  const [loadingBids, setLoadingBids] = useState<Record<number, boolean>>({});

  // For exchangers - orders they can bid on
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [acceptedBids, setAcceptedBids] = useState<Bid[]>([]);  // accepted bids (in progress)
  const [completedBids, setCompletedBids] = useState<Bid[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // Dismissed orders - stored in localStorage
  const [dismissedOrderIds, setDismissedOrderIds] = useState<number[]>(() => {
    const stored = localStorage.getItem('dismissedOrders');
    return stored ? JSON.parse(stored) : [];
  });

  // Tab state for exchangers: active, accepted, completed
  const [exchangerTab, setExchangerTab] = useState<'active' | 'accepted' | 'completed'>('active');

  // Bid form state
  const [bidOrderId, setBidOrderId] = useState<number | null>(null);
  const [bidRate, setBidRate] = useState('');
  const [bidComment, setBidComment] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);

  // WebSocket handler for real-time updates
  const handleWSMessage = useCallback((type: string, data: any) => {
    console.log('WebSocket message:', type, data);
    if (type === 'new_order' && role === 'exchanger') {
      // Add new order to list if it's not from us
      if (data.user_id !== userId) {
        setActiveOrders(prev => [data, ...prev.filter(o => o.id !== data.id)]);
      }
    } else if (type === 'new_bid' && role === 'client') {
      // Refresh orders to get new bid
      fetchMyOrders();
    }
  }, [role, userId, fetchMyOrders]);

  // Connect to WebSocket (non-blocking, delayed)
  useWebSocket(handleWSMessage);

  // Initial fetch - fast, non-blocking
  useEffect(() => {
    // Show UI immediately, fetch data in background
    setInitialLoading(false);

    if (role === 'exchanger') {
      fetchActiveOrdersSilent();
      fetchMyBidsSilent();
    } else {
      fetchMyOrders();
    }

    // Refresh every 5 seconds for real-time feel (like Uber)
    const interval = setInterval(() => {
      if (role === 'exchanger') {
        fetchActiveOrdersSilent();
        fetchMyBidsSilent();
      } else {
        fetchMyOrders();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [role]);

  // Silent fetch - no loading spinner
  const fetchActiveOrdersSilent = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/orders/active`);
      const data = await res.json();
      // Filter out own orders and dismissed orders
      const filtered = (data || []).filter((o: Order) =>
        o.user_id !== userId && !dismissedOrderIds.includes(o.id)
      );
      setActiveOrders(filtered);
    } catch (e) {
      console.error('Failed to fetch orders');
    }
  };

  const fetchMyBidsSilent = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bids/my?user_id=${userId}`);
      const data = await res.json();
      const accepted = data.filter((b: Bid) => b.status === 'accepted');
      const completed = data.filter((b: Bid) => b.status === 'completed' || b.status === 'rejected');
      setAcceptedBids(accepted);
      setCompletedBids(completed);
    } catch (e) {
      console.error('Failed to fetch bids');
    }
  };

  const toggleOrder = async (orderId: number) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (!orderBids[orderId]) {
      setLoadingBids(prev => ({ ...prev, [orderId]: true }));
      const bids = await fetchOrderBids(orderId);
      setOrderBids(prev => ({ ...prev, [orderId]: bids }));
      setLoadingBids(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleAcceptBid = async (bidId: number) => {
    if (confirm(t('confirmAcceptBid', language) || 'Accept this offer?')) {
      await acceptBid(bidId);
      fetchMyOrders();
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (confirm('Отменить эту заявку?')) {
      try {
        await fetch(`${API_BASE}/api/orders/${orderId}/cancel`, { method: 'POST' });
        fetchMyOrders();
      } catch (e) {
        alert('Ошибка при отмене');
      }
    }
  };

  const handleClearArchive = async () => {
    if (confirm('Очистить все завершённые заявки?')) {
      try {
        await fetch(`${API_BASE}/api/bids/completed?user_id=${userId}`, { method: 'DELETE' });
        setCompletedBids([]);
      } catch (e) {
        alert('Ошибка при очистке');
      }
    }
  };

  const handleDismissOrder = (orderId: number) => {
    // Remove order from local list (dismiss/skip)
    setActiveOrders(prev => prev.filter(o => o.id !== orderId));
    // Store in dismissed list
    const newDismissed = [...dismissedOrderIds, orderId];
    setDismissedOrderIds(newDismissed);
    localStorage.setItem('dismissedOrders', JSON.stringify(newDismissed));
    // Optionally persist to server
    fetch(`${API_BASE}/api/orders/${orderId}/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    }).catch(() => { });
  };

  const handleSwipeAccept = (order: Order) => {
    // Open bid form for this order
    setBidOrderId(order.id);
  };

  const handleSubmitBid = async () => {
    if (!bidOrderId || !bidRate) return;

    setSubmittingBid(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const res = await fetch(`${API_BASE}/api/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: bidOrderId,
          exchanger_id: userId,
          rate: parseFloat(bidRate),
          time_estimate: '15',
          comment: bidComment
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const savedBidOrderId = bidOrderId;
        setBidOrderId(null);
        setBidRate('');
        setBidComment('');
        setActiveOrders(prev => prev.filter(o => o.id !== savedBidOrderId));
        alert('✅ Предложение отправлено клиенту!');
      } else {
        alert('Ошибка отправки');
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        alert('Таймаут. Попробуйте еще раз.');
      } else {
        alert('Ошибка отправки');
      }
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleCompleteDeal = async (bidId: number) => {
    if (!confirm('Завершить сделку? Клиент получит уведомление.')) return;

    try {
      const res = await fetch(`${API_BASE}/api/bids/${bidId}/complete`, { method: 'POST' });
      if (res.ok) {
        // Move from accepted to completed
        setAcceptedBids(prev => prev.filter(b => b.id !== bidId));
        fetchMyBidsSilent();
        alert('✅ Сделка завершена!');
      }
    } catch (e) {
      alert('Ошибка при завершении');
    }
  };

  // Initial loading spinner
  if (initialLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  // EXCHANGER VIEW
  if (role === 'exchanger') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => setExchangerTab('active')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all ${exchangerTab === 'active'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Заявки ({activeOrders.length})
          </button>
          <button
            onClick={() => setExchangerTab('accepted')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all ${exchangerTab === 'accepted'
              ? 'bg-green-500 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            В работе ({acceptedBids.length})
          </button>
          <button
            onClick={() => setExchangerTab('completed')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all ${exchangerTab === 'completed'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Архив ({completedBids.length})
          </button>
        </div>

        {/* Active Orders Tab */}
        {exchangerTab === 'active' && (
          <>
            {activeOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Archive size={48} className="mx-auto mb-3 opacity-30" />
                {t('noActiveOrders', language) || 'Нет активных заявок'}
              </div>
            ) : (
              <>
                {/* Swipe hint */}
                <div className="text-xs text-gray-400 text-center mb-2">
                  ← Пропустить · Свайпните · Предложить →
                </div>
                <div className="space-y-3">
                  {activeOrders.map((order) => (
                    <SwipeableOrderCard
                      key={order.id}
                      order={order}
                      onAccept={handleSwipeAccept}
                      onDismiss={handleDismissOrder}
                    >
                      <div className="p-4">
                        {/* User Identity - Clickable */}
                        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                            {(order as any).client_name?.charAt(0) || <User size={18} />}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {(order as any).client_name || 'Клиент'}
                            </div>
                            {(order as any).client_username && (
                              <a
                                href={`https://t.me/${(order as any).client_username.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-blue-500 hover:underline"
                              >
                                @{(order as any).client_username.replace('@', '')}
                              </a>
                            )}
                          </div>
                          {/* Quick contact button */}
                          {(order as any).client_username && (
                            <a
                              href={`https://t.me/${(order as any).client_username.replace('@', '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              <MessageCircle size={16} />
                            </a>
                          )}
                        </div>

                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="text-2xl font-bold text-gray-900">
                              {order.amount} <span className="text-green-500">{order.currency}</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                              <MapPin size={14} />
                              {order.location}
                            </div>
                          </div>
                          <span className="text-xs text-orange-500 font-medium bg-orange-50 px-2 py-1 rounded-full">
                            {timeAgo(order.created_at)}
                          </span>
                        </div>

                        {bidOrderId === order.id ? (
                          <div className="space-y-3 pt-3 border-t border-gray-100">
                            <div className="text-sm font-medium text-gray-700 mb-2">
                              Предложите курс для {(order as any).client_name || 'клиента'}
                            </div>
                            <input
                              type="number"
                              placeholder="Ваш курс"
                              value={bidRate}
                              onChange={(e) => setBidRate(e.target.value)}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                              autoFocus
                            />
                            <input
                              type="text"
                              placeholder="Комментарий (необязательно)"
                              value={bidComment}
                              onChange={(e) => setBidComment(e.target.value)}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                            />
                            <div className="flex gap-2">
                              <Button onClick={() => setBidOrderId(null)} variant="outline" size="sm" className="flex-1">
                                Отмена
                              </Button>
                              <Button onClick={handleSubmitBid} size="sm" className="flex-1 bg-green-500 hover:bg-green-600" disabled={submittingBid || !bidRate}>
                                {submittingBid ? <Loader size={16} className="animate-spin" /> : (
                                  <><Send size={14} className="mr-1" />Отправить</>
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button onClick={() => setBidOrderId(order.id)} className="w-full mt-2" size="sm">
                            <DollarSign size={16} className="mr-1" />
                            Предложить курс
                          </Button>
                        )}
                      </div>
                    </SwipeableOrderCard>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Accepted (In Progress) Tab */}
        {exchangerTab === 'accepted' && (
          <>
            {acceptedBids.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle size={48} className="mx-auto mb-3 opacity-30" />
                Нет активных сделок
              </div>
            ) : (
              <div className="space-y-3">
                {acceptedBids.map((bid: Bid) => (
                  <div key={bid.id} className="bg-white rounded-xl border border-green-200 overflow-hidden shadow-sm">
                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold text-gray-900">Заявка #{bid.order_id}</div>
                          <div className="text-sm text-gray-600">Курс: {bid.rate}</div>
                          <div className="text-sm text-gray-500">{(bid as any).amount} {(bid as any).currency}</div>
                          <div className="text-xs text-gray-400 mt-1">📍 {(bid as any).location}</div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-green-500 text-white font-medium">
                          ✓ В работе
                        </span>
                      </div>

                      {/* Client info */}
                      <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                        <div className="text-xs text-gray-500 mb-1">Клиент:</div>
                        <div className="font-medium text-gray-900">{(bid as any).client_name || 'Клиент'}</div>
                        {(bid as any).client_phone && (
                          <div className="text-sm text-gray-600">📞 {(bid as any).client_phone}</div>
                        )}
                      </div>

                      {/* Contact buttons */}
                      <div className="flex gap-2 mt-3">
                        {/* Telegram link via user ID */}
                        <a
                          href={`tg://user?id=${(bid as any).client_telegram_id}`}
                          className="flex-1 py-2.5 px-4 bg-blue-500 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
                        >
                          <MessageCircle size={16} />
                          Написать
                        </a>
                        {(bid as any).client_phone && (
                          <a
                            href={`tel:${(bid as any).client_phone}`}
                            className="py-2.5 px-4 bg-green-500 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
                          >
                            📞
                          </a>
                        )}
                      </div>

                      {/* Complete Deal button */}
                      <button
                        onClick={() => handleCompleteDeal(bid.id)}
                        className="w-full mt-3 py-2.5 px-4 bg-gray-900 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
                      >
                        <CheckCircle size={16} />
                        Завершить сделку
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Completed Tab */}
        {exchangerTab === 'completed' && (
          <>
            {completedBids.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearArchive} className="w-full">
                <Trash2 size={16} className="mr-2" />
                Очистить архив
              </Button>
            )}

            {completedBids.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle size={48} className="mx-auto mb-3 opacity-30" />
                Нет завершённых заявок
              </div>
            ) : (
              <div className="space-y-2">
                {completedBids.map((bid: Bid) => (
                  <div key={bid.id} className="bg-white p-3 rounded-xl border border-gray-200 flex justify-between items-center">
                    <div>
                      <div className="font-medium">Курс: {bid.rate}</div>
                      <div className="text-xs text-gray-500">Заявка #{bid.order_id}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${bid.status === 'completed'
                      ? 'bg-green-100 text-green-600'
                      : bid.status === 'accepted'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-red-100 text-red-600'
                      }`}>
                      {bid.status === 'completed' ? '✓ Завершено' : bid.status === 'accepted' ? '✓ Принято' : '✗ Отклонено'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </motion.div>
    );
  }

  // CLIENT VIEW
  const activeClientOrders = myOrders.filter((o: Order) => o.status === 'active');
  const closedClientOrders = myOrders.filter((o: Order) => o.status !== 'active');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <h2 className="text-title">{t('myOrders', language) || 'Мои заявки'}</h2>

      {/* Active Orders */}
      {activeClientOrders.length > 0 && (
        <div className="space-y-3">
          {activeClientOrders.map((order) => (
            <div key={order.id} className="border rounded-2xl bg-white border-gray-200 overflow-hidden shadow-sm">
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleOrder(order.id)}
              >
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {order.amount} <span className="text-green-500">{order.currency}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                    <MapPin size={14} />
                    {order.location}
                    <span className="text-orange-500 font-medium">• {timeAgo(order.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-600">
                    {orderBids[order.id]?.length || 0} откликов
                  </span>
                  {expandedOrderId === order.id ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </div>
              </div>

              <AnimatePresence>
                {expandedOrderId === order.id && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden bg-gray-50"
                  >
                    <div className="p-4 space-y-3 border-t border-gray-200">
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('offers', language)} ({orderBids[order.id]?.length || 0})
                      </h4>

                      {loadingBids[order.id] ? (
                        <div className="flex justify-center py-4">
                          <Loader className="animate-spin text-gray-400" size={20} />
                        </div>
                      ) : orderBids[order.id]?.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          Пока нет предложений
                        </div>
                      ) : (
                        orderBids[order.id]?.map((bid) => (
                          <div key={bid.id} className={`p-3 rounded-lg border ${bid.status === 'accepted' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-semibold">{(bid as any).exchanger_name || 'Обменник'}</div>
                                <div className="font-medium text-green-600">Курс: {bid.rate}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock size={12} /> {bid.time_estimate || '15'} мин
                                </div>
                              </div>
                              <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">
                                ★ {bid.rating?.toFixed(1) || '5.0'}
                              </span>
                            </div>
                            {bid.comment && (
                              <div className="text-sm text-gray-600 mb-3 bg-gray-50 p-2 rounded">
                                "{bid.comment}"
                              </div>
                            )}
                            {bid.status === 'accepted' ? (
                              <>
                                <div className="w-full py-2 text-center text-green-600 bg-green-100 rounded-md font-medium text-sm flex items-center justify-center gap-1 mb-2">
                                  <CheckCircle size={14} />
                                  Предложение принято!
                                </div>

                                {/* Exchanger contact info */}
                                <div className="p-2 bg-white rounded-lg border border-gray-200 mb-2">
                                  <div className="text-xs text-gray-500">Обменник:</div>
                                  <div className="font-medium">{(bid as any).exchanger_name || 'Обменник'}</div>
                                  {(bid as any).exchanger_phone && (
                                    <div className="text-sm text-gray-600">📞 {(bid as any).exchanger_phone}</div>
                                  )}
                                </div>

                                {/* Contact button */}
                                {(bid as any).exchanger_username ? (
                                  <a
                                    href={`https://t.me/${(bid as any).exchanger_username.replace('@', '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-blue-600"
                                  >
                                    <MessageCircle size={16} />
                                    Написать @{(bid as any).exchanger_username.replace('@', '')}
                                  </a>
                                ) : (bid as any).exchanger_phone ? (
                                  <a
                                    href={`tel:${(bid as any).exchanger_phone}`}
                                    className="w-full py-2.5 bg-green-500 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                                  >
                                    📞 Позвонить
                                  </a>
                                ) : null}
                              </>
                            ) : (
                              <Button size="sm" className="w-full" onClick={() => handleAcceptBid(bid.id)}>
                                ✓ Принять предложение
                              </Button>
                            )}
                          </div>
                        ))
                      )}

                      {/* Cancel button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-red-500 border-red-200 hover:bg-red-50"
                        onClick={() => handleCancelOrder(order.id)}
                      >
                        <X size={16} className="mr-1" />
                        Отменить заявку
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Closed Orders */}
      {closedClientOrders.length > 0 && (
        <>
          <h3 className="text-sm font-medium text-gray-500 mt-4">Завершённые заявки</h3>
          <div className="space-y-2">
            {closedClientOrders.map((order) => (
              <div key={order.id} className="p-3 bg-gray-50 rounded-xl flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-600">{order.amount} {order.currency}</div>
                  <div className="text-xs text-gray-400">{order.location}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-600">
                  {order.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {myOrders.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Archive size={48} className="mx-auto mb-3 opacity-30" />
          {t('noOrders', language) || 'Нет заявок'}
        </div>
      )}
    </motion.div>
  );
}
