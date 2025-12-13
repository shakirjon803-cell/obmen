import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCw, Check, Upload, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvatarEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (croppedImage: string, originalImage: string) => void;
    currentAvatar?: string;
    originalImage?: string; // Store original full-size image for re-editing
}

export function AvatarEditor({ isOpen, onClose, onSave, currentAvatar, originalImage }: AvatarEditorProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [originalSrc, setOriginalSrc] = useState<string | null>(null); // Track original image
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isSaving, setIsSaving] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load original image or reset when modal opens
    useEffect(() => {
        if (isOpen) {
            // Priority: originalImage > currentAvatar > null
            // Always prefer originalImage for re-editing (it's full-size)
            if (originalImage) {
                setImageSrc(originalImage);
                setOriginalSrc(originalImage);
            } else if (currentAvatar) {
                // Fallback to currentAvatar if no original exists
                setImageSrc(currentAvatar);
                setOriginalSrc(currentAvatar);
            } else {
                setImageSrc(null);
                setOriginalSrc(null);
            }
            setScale(1);
            setRotation(0);
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen, currentAvatar, originalImage]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('Файл слишком большой. Максимум 5MB');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const newImage = event.target?.result as string;
                setImageSrc(newImage);
                setOriginalSrc(newImage); // Store as original for future re-edits
                setScale(1);
                setRotation(0);
                setPosition({ x: 0, y: 0 });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!imageSrc) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        // Limit movement to prevent image from going out of bounds
        const limit = 150 * scale;
        setPosition({
            x: Math.max(-limit, Math.min(limit, newX)),
            y: Math.max(-limit, Math.min(limit, newY))
        });
    }, [isDragging, dragStart, scale]);

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Touch events for mobile
    const handleTouchStart = (e: React.TouchEvent) => {
        if (!imageSrc) return;
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    };

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const newX = touch.clientX - dragStart.x;
        const newY = touch.clientY - dragStart.y;
        const limit = 150 * scale;
        setPosition({
            x: Math.max(-limit, Math.min(limit, newX)),
            y: Math.max(-limit, Math.min(limit, newY))
        });
    }, [isDragging, dragStart, scale]);

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    const handleZoomIn = () => {
        setScale(prev => Math.min(prev + 0.2, 5));
    };

    const handleZoomOut = () => {
        setScale(prev => Math.max(prev - 0.2, 0.3));
    };

    const handleRotate = () => {
        setRotation(prev => (prev + 90) % 360);
    };

    const cropImage = async (): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!imageSrc || !canvasRef.current || !containerRef.current) {
                reject('No image');
                return;
            }

            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject('No context');
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                // Output size (final avatar size)
                const outputSize = 256;
                canvas.width = outputSize;
                canvas.height = outputSize;

                // Get the actual container size from DOM
                const containerRect = containerRef.current!.getBoundingClientRect();
                const containerSize = containerRect.width; // It's a square (aspect-square)

                // The ratio between output canvas and visual container
                const containerToOutputRatio = outputSize / containerSize;

                // Clear canvas
                ctx.clearRect(0, 0, outputSize, outputSize);

                // Create circular clip
                ctx.beginPath();
                ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();

                // Fill background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, outputSize, outputSize);

                // Save context state
                ctx.save();

                // Move to center of output canvas
                ctx.translate(outputSize / 2, outputSize / 2);

                // Apply position (scaled to output size)
                ctx.translate(position.x * containerToOutputRatio, position.y * containerToOutputRatio);

                // Apply scale
                ctx.scale(scale, scale);

                // Apply rotation
                ctx.rotate((rotation * Math.PI) / 180);

                // Calculate image size to fit in container
                // The image in preview has max-width/max-height of 300%
                // We need to match this sizing logic
                const imgAspect = img.width / img.height;
                let drawWidth, drawHeight;

                if (imgAspect > 1) {
                    // Wide image
                    drawHeight = containerSize * containerToOutputRatio;
                    drawWidth = drawHeight * imgAspect;
                } else {
                    // Tall or square image
                    drawWidth = containerSize * containerToOutputRatio;
                    drawHeight = drawWidth / imgAspect;
                }

                // Draw image centered
                ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

                // Restore context
                ctx.restore();

                // Convert to data URL with reduced quality for smaller size
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                resolve(dataUrl);
            };
            img.onerror = () => reject('Failed to load image');
            img.src = imageSrc;
        });
    };

    const handleSave = async () => {
        if (!imageSrc || !originalSrc) return;

        setIsSaving(true);
        try {
            const croppedImage = await cropImage();
            // Pass both cropped (for display) and original (for future re-editing)
            onSave(croppedImage, originalSrc);
            onClose();
        } catch (error) {
            console.error('Failed to crop image:', error);
            alert('Ошибка обработки изображения');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-2xl w-full max-w-sm overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900">Редактор аватарки</h3>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4">
                        {!imageSrc ? (
                            // Upload area
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all"
                            >
                                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4">
                                    <Upload size={28} className="text-white" />
                                </div>
                                <p className="text-gray-900 font-medium mb-1">Загрузить фото</p>
                                <p className="text-sm text-gray-400">JPG, PNG до 5MB</p>
                            </div>
                        ) : (
                            // Crop area
                            <>
                                <div
                                    ref={containerRef}
                                    className="relative aspect-square rounded-2xl overflow-hidden bg-gray-900 cursor-move select-none"
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                    onTouchStart={handleTouchStart}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                >
                                    {/* Image */}
                                    <div
                                        className="absolute inset-0 flex items-center justify-center"
                                        style={{
                                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                                            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                                        }}
                                    >
                                        <img
                                            ref={imageRef}
                                            src={imageSrc}
                                            alt="Preview"
                                            className="max-w-none"
                                            style={{ width: 'auto', height: 'auto', maxWidth: '300%', maxHeight: '300%' }}
                                            draggable={false}
                                        />
                                    </div>

                                    {/* Circular crop overlay */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        {/* Dark corners with circular cutout */}
                                        <svg className="w-full h-full">
                                            <defs>
                                                <mask id="circleMask">
                                                    <rect width="100%" height="100%" fill="white" />
                                                    <circle cx="50%" cy="50%" r="140" fill="black" />
                                                </mask>
                                            </defs>
                                            <rect
                                                width="100%"
                                                height="100%"
                                                fill="rgba(0,0,0,0.6)"
                                                mask="url(#circleMask)"
                                            />
                                            <circle
                                                cx="50%"
                                                cy="50%"
                                                r="140"
                                                fill="none"
                                                stroke="white"
                                                strokeWidth="3"
                                                strokeDasharray="8 4"
                                            />
                                        </svg>
                                    </div>

                                    {/* Move hint */}
                                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                                        <Move size={12} />
                                        Перетащите
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center justify-center gap-2">
                                    <button
                                        onClick={handleZoomOut}
                                        className="p-3 hover:bg-gray-100 rounded-xl transition-colors"
                                        title="Уменьшить"
                                    >
                                        <ZoomOut size={20} className="text-gray-600" />
                                    </button>

                                    <input
                                        type="range"
                                        min="0.3"
                                        max="5"
                                        step="0.1"
                                        value={scale}
                                        onChange={(e) => setScale(parseFloat(e.target.value))}
                                        className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                                    />

                                    <button
                                        onClick={handleZoomIn}
                                        className="p-3 hover:bg-gray-100 rounded-xl transition-colors"
                                        title="Увеличить"
                                    >
                                        <ZoomIn size={20} className="text-gray-600" />
                                    </button>

                                    <div className="w-px h-6 bg-gray-200 mx-2" />

                                    <button
                                        onClick={handleRotate}
                                        className="p-3 hover:bg-gray-100 rounded-xl transition-colors"
                                        title="Повернуть"
                                    >
                                        <RotateCw size={20} className="text-gray-600" />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="p-4 border-t border-gray-100 flex gap-2">
                        {imageSrc ? (
                            <>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                                >
                                    Другое фото
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={cn(
                                        "flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors",
                                        isSaving ? "opacity-50" : "hover:bg-gray-800"
                                    )}
                                >
                                    {isSaving ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Check size={18} />
                                            Сохранить
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={onClose}
                                className="w-full py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                            >
                                Отмена
                            </button>
                        )}
                    </div>

                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {/* Hidden canvas for cropping */}
                    <canvas ref={canvasRef} className="hidden" />
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
