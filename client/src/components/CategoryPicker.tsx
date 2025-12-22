/**
 * CategoryPicker - Hierarchical category selector
 * 
 * Features:
 * - Nested navigation (drill-down)
 * - Search
 * - Featured categories
 * - Icons with emoji
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, Search, X } from 'lucide-react';
import { categoriesApi, Category, CategoryWithAttributes } from '@/lib/api';

interface CategoryPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (category: CategoryWithAttributes) => void;
    language?: 'ru' | 'uz' | 'en';
}

interface CategoryTreeNode extends Category {
    children?: CategoryTreeNode[];
}

export function CategoryPicker({
    isOpen,
    onClose,
    onSelect,
    language = 'ru',
}: CategoryPickerProps) {
    const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [breadcrumbs, setBreadcrumbs] = useState<CategoryTreeNode[]>([]);
    const [currentLevel, setCurrentLevel] = useState<CategoryTreeNode[]>([]);

    // Load categories tree
    useEffect(() => {
        if (!isOpen) return;

        const loadCategories = async () => {
            try {
                setIsLoading(true);
                const tree = await categoriesApi.getTree(language);
                setCategories(tree as CategoryTreeNode[]);
                setCurrentLevel(tree as CategoryTreeNode[]);
            } catch (error) {
                console.error('Failed to load categories:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadCategories();
    }, [isOpen, language]);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setBreadcrumbs([]);
            setCurrentLevel(categories);
        }
    }, [isOpen, categories]);

    const handleSelectCategory = async (cat: CategoryTreeNode) => {
        // If has children, drill down
        if (cat.children && cat.children.length > 0) {
            setBreadcrumbs([...breadcrumbs, cat]);
            setCurrentLevel(cat.children);
            return;
        }

        // Leaf category - load attributes and return
        try {
            const fullCategory = await categoriesApi.getById(cat.id, language);
            onSelect(fullCategory);
            onClose();
        } catch (error) {
            console.error('Failed to load category:', error);
        }
    };

    const handleBack = () => {
        if (breadcrumbs.length === 0) {
            onClose();
            return;
        }

        const newBreadcrumbs = [...breadcrumbs];
        newBreadcrumbs.pop();
        setBreadcrumbs(newBreadcrumbs);

        if (newBreadcrumbs.length === 0) {
            setCurrentLevel(categories);
        } else {
            setCurrentLevel(newBreadcrumbs[newBreadcrumbs.length - 1].children || []);
        }
    };

    // Search functionality
    const flattenCategories = (cats: CategoryTreeNode[], result: CategoryTreeNode[] = []): CategoryTreeNode[] => {
        cats.forEach(cat => {
            result.push(cat);
            if (cat.children) {
                flattenCategories(cat.children, result);
            }
        });
        return result;
    };

    const searchResults = searchQuery
        ? flattenCategories(categories).filter(cat =>
            cat.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : [];

    const displayCategories = searchQuery ? searchResults : currentLevel;

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
        >
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
                        {breadcrumbs.length > 0 ? <ArrowLeft size={20} /> : <X size={20} />}
                    </button>

                    <h3 className="font-bold text-lg">
                        {breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].name : 'Выберите категорию'}
                    </h3>

                    <div className="w-10" /> {/* Spacer */}
                </div>

                {/* Breadcrumbs */}
                {breadcrumbs.length > 0 && !searchQuery && (
                    <div className="px-4 py-2 flex items-center gap-1 text-sm text-gray-500 overflow-x-auto">
                        <span
                            onClick={() => {
                                setBreadcrumbs([]);
                                setCurrentLevel(categories);
                            }}
                            className="cursor-pointer hover:text-gray-900"
                        >
                            Все
                        </span>
                        {breadcrumbs.map((bc, idx) => (
                            <React.Fragment key={bc.id}>
                                <ChevronRight size={14} />
                                <span
                                    onClick={() => {
                                        const newBc = breadcrumbs.slice(0, idx + 1);
                                        setBreadcrumbs(newBc);
                                        setCurrentLevel(bc.children || []);
                                    }}
                                    className="cursor-pointer hover:text-gray-900 truncate max-w-[100px]"
                                >
                                    {bc.name}
                                </span>
                            </React.Fragment>
                        ))}
                    </div>
                )}

                {/* Search */}
                <div className="px-4 py-2">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск категории..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Categories list */}
                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : displayCategories.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            {searchQuery ? 'Ничего не найдено' : 'Нет категорий'}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {displayCategories.map((cat, index) => (
                                <motion.button
                                    key={cat.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                    onClick={() => handleSelectCategory(cat)}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                                >
                                    {/* Icon */}
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl">
                                        {cat.icon || '📦'}
                                    </div>

                                    {/* Name */}
                                    <div className="flex-1 min-w-0">
                                        <span className="font-medium text-gray-900 block truncate">
                                            {cat.name}
                                        </span>
                                        {cat.is_paid && (
                                            <span className="text-xs text-orange-500">
                                                Платная публикация
                                            </span>
                                        )}
                                    </div>

                                    {/* Arrow if has children */}
                                    {cat.children && cat.children.length > 0 && (
                                        <ChevronRight size={20} className="text-gray-400" />
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

export default CategoryPicker;
