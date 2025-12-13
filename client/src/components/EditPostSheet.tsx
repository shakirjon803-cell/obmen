import { useState, useEffect, useRef } from 'react';
import { X, ImagePlus, Trash2, Loader2, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { t } from '@/lib/i18n';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const CURRENCIES = ['USD', 'EUR', 'EGP', 'RUB', 'AED', 'USDT'];
const LOCATIONS = ['Район 4.5', 'Район 6-10', 'Ваха', 'Хургада', 'Шарм-эль-Шейх', 'Каир'];

const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 500;

export function EditPostSheet() {
    const { language, editingPost, setEditingPost, editPost, fetchMarketPosts } = useStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Primary fields
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [imageData, setImageData] = useState<string | null>(null);

    // Optional fields (collapsible)
    const [showOptionalFields, setShowOptionalFields] = useState(false);
    const [amount, setAmount] = useState('');
    const [rate, setRate] = useState('');
    const [location, setLocation] = useState('');
    const [currency, setCurrency] = useState('');
    const [type, setType] = useState<'buy' | 'sell'>('sell');

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (editingPost) {
            setTitle(editingPost.title || editingPost.description?.slice(0, MAX_TITLE_LENGTH) || '');
            setDescription(editingPost.description || '');
            setAmount(editingPost.amount?.toString() || '');
            setRate(editingPost.rate?.toString() || '');
            setLocation(editingPost.location || '');
            setCurrency(editingPost.currency || '');
            setType(editingPost.type || 'sell');
            setImageData(editingPost.image_data || editingPost.thumbnailUrl || null);
            // Auto-expand optional fields if any have values
            if (editingPost.location || editingPost.currency || editingPost.rate) {
                setShowOptionalFields(true);
            }
        }
    }, [editingPost]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setImageData(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setImageData(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value.length <= MAX_TITLE_LENGTH) {
            setTitle(value);
        }
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        if (value.length <= MAX_DESCRIPTION_LENGTH) {
            setDescription(value);
        }
    };

    const handleSubmit = async () => {
        if (!editingPost || !title.trim()) {
            return;
        }

        setIsSubmitting(true);
        try {
            await editPost(editingPost.id, {
                title: title.trim(),
                description: description.trim(),
                amount: parseFloat(amount) || 0,
                rate: parseFloat(rate) || 0,
                type,
                currency,
                location,
                image_data: imageData
            });
            setEditingPost(null);
            fetchMarketPosts();
        } catch (error) {
            console.error('Failed to update post', error);
            alert('Ошибка сохранения');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!editingPost) return null;

    return (
        <AnimatePresence>
            {editingPost && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        className="fixed inset-0 bg-black/50 z-40"
                        onClick={() => setEditingPost(null)}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, y: '100%' }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-x-0 bottom-0 bg-white rounded-t-2xl z-50 max-h-[90vh] flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h2 className="text-base font-bold">{t('editPost', language)}</h2>
                            <button
                                onClick={() => setEditingPost(null)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Title (Mandatory) */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-2">
                                    Заголовок <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={handleTitleChange}
                                    placeholder="Введите заголовок объявления..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                                />
                                <p className={cn(
                                    "text-xs mt-1",
                                    title.length >= MAX_TITLE_LENGTH ? "text-red-500" : "text-gray-400"
                                )}>
                                    {title.length}/{MAX_TITLE_LENGTH}
                                </p>
                            </div>

                            {/* Image Upload */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-2">
                                    <ImagePlus size={12} className="inline mr-1" />
                                    Фото
                                </label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageSelect}
                                    className="hidden"
                                />
                                {imageData ? (
                                    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100">
                                        <img src={imageData} alt="" className="w-full h-full object-cover" />
                                        <button
                                            onClick={handleRemoveImage}
                                            className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full aspect-video rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                                    >
                                        <ImagePlus size={32} className="text-gray-400" />
                                        <span className="text-sm text-gray-500">Нажмите чтобы загрузить</span>
                                    </button>
                                )}
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-2">
                                    {t('description', language)}
                                </label>
                                <textarea
                                    placeholder="Описание..."
                                    value={description}
                                    onChange={handleDescriptionChange}
                                    rows={3}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-200"
                                />
                                <p className={cn(
                                    "text-xs mt-1",
                                    description.length >= MAX_DESCRIPTION_LENGTH ? "text-red-500" : "text-gray-400"
                                )}>
                                    {description.length}/{MAX_DESCRIPTION_LENGTH}
                                </p>
                            </div>

                            {/* Optional Fields Toggle */}
                            <button
                                onClick={() => setShowOptionalFields(!showOptionalFields)}
                                className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                <span>Дополнительные параметры</span>
                                {showOptionalFields ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>

                            {/* Optional Fields (Collapsible) */}
                            <AnimatePresence>
                                {showOptionalFields && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-4 overflow-hidden"
                                    >
                                        {/* Type Toggle */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-2">Тип</label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setType('buy')}
                                                    className={cn(
                                                        "flex-1 py-3 rounded-xl font-medium transition-all",
                                                        type === 'buy'
                                                            ? "bg-blue-500 text-white"
                                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    )}
                                                >
                                                    Покупаю
                                                </button>
                                                <button
                                                    onClick={() => setType('sell')}
                                                    className={cn(
                                                        "flex-1 py-3 rounded-xl font-medium transition-all",
                                                        type === 'sell'
                                                            ? "bg-orange-500 text-white"
                                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    )}
                                                >
                                                    Продаю
                                                </button>
                                            </div>
                                        </div>

                                        {/* Currency */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-2">Валюта</label>
                                            <div className="flex flex-wrap gap-2">
                                                {CURRENCIES.map((c) => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setCurrency(currency === c ? '' : c)}
                                                        className={cn(
                                                            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                                            currency === c
                                                                ? "bg-gray-900 text-white"
                                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                        )}
                                                    >
                                                        {c}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Amount & Rate */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-2">
                                                    {t('amount', language)}
                                                </label>
                                                <input
                                                    type="number"
                                                    placeholder="1000"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-2">
                                                    Курс
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="50.5"
                                                    value={rate}
                                                    onChange={(e) => setRate(e.target.value)}
                                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                                />
                                            </div>
                                        </div>

                                        {/* Location */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-2">
                                                <MapPin size={12} className="inline mr-1" />
                                                Район
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {LOCATIONS.map((loc) => (
                                                    <button
                                                        key={loc}
                                                        onClick={() => setLocation(location === loc ? '' : loc)}
                                                        className={cn(
                                                            "px-3 py-2 rounded-lg text-sm transition-all",
                                                            location === loc
                                                                ? "bg-gray-900 text-white"
                                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                        )}
                                                    >
                                                        {loc}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100">
                            <Button
                                onClick={handleSubmit}
                                disabled={!title.trim() || isSubmitting}
                                className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : t('saveChanges', language)}
                            </Button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
