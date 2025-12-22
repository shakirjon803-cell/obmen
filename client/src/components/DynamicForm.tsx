/**
 * DynamicForm - Renders form fields based on category attributes
 * 
 * Supports:
 * - text, number, date, select, boolean input types
 * - Validation
 * - Localized labels
 */

import React from 'react';
import { CategoryAttribute } from '@/lib/api';

interface DynamicFormProps {
    attributes: CategoryAttribute[];
    values: Record<string, any>;
    onChange: (name: string, value: any) => void;
    errors?: Record<string, string>;
}

export function DynamicForm({ attributes, values, onChange, errors = {} }: DynamicFormProps) {
    const renderField = (attr: CategoryAttribute) => {
        const value = values[attr.name] ?? attr.default_value ?? '';
        const error = errors[attr.name];

        const baseInputClass = `
      w-full px-4 py-3 rounded-xl border transition-colors
      ${error
                ? 'border-red-500 focus:ring-red-500/20'
                : 'border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10'
            }
    `.trim();

        const label = (
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {attr.label}
                {attr.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
        );

        switch (attr.type) {
            case 'text':
                return (
                    <div key={attr.id} className="mb-4">
                        {label}
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => onChange(attr.name, e.target.value)}
                            placeholder={attr.placeholder || ''}
                            className={baseInputClass}
                        />
                        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                    </div>
                );

            case 'number':
                return (
                    <div key={attr.id} className="mb-4">
                        {label}
                        <input
                            type="number"
                            value={value}
                            onChange={(e) => onChange(attr.name, e.target.value ? Number(e.target.value) : '')}
                            placeholder={attr.placeholder || ''}
                            min={attr.min_value}
                            max={attr.max_value}
                            className={baseInputClass}
                        />
                        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                    </div>
                );

            case 'date':
                return (
                    <div key={attr.id} className="mb-4">
                        {label}
                        <input
                            type="date"
                            value={value}
                            onChange={(e) => onChange(attr.name, e.target.value)}
                            className={baseInputClass}
                        />
                        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                    </div>
                );

            case 'select':
                return (
                    <div key={attr.id} className="mb-4">
                        {label}
                        <select
                            value={value}
                            onChange={(e) => onChange(attr.name, e.target.value)}
                            className={baseInputClass}
                        >
                            <option value="">Выберите...</option>
                            {attr.options?.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                    </div>
                );

            case 'boolean':
                return (
                    <div key={attr.id} className="mb-4 flex items-center gap-3">
                        <input
                            type="checkbox"
                            id={attr.name}
                            checked={!!value}
                            onChange={(e) => onChange(attr.name, e.target.checked)}
                            className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                        <label htmlFor={attr.name} className="text-sm font-medium text-gray-700">
                            {attr.label}
                        </label>
                        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                    </div>
                );

            default:
                return null;
        }
    };

    if (attributes.length === 0) {
        return null;
    }

    return (
        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
            <h4 className="font-semibold text-gray-900 mb-3">Дополнительные характеристики</h4>
            {attributes.sort((a, b) => a.id - b.id).map(renderField)}
        </div>
    );
}

export function validateDynamicForm(
    attributes: CategoryAttribute[],
    values: Record<string, any>
): Record<string, string> {
    const errors: Record<string, string> = {};

    attributes.forEach((attr) => {
        const value = values[attr.name];

        // Required check
        if (attr.is_required) {
            if (value === undefined || value === null || value === '') {
                errors[attr.name] = 'Обязательное поле';
                return;
            }
        }

        // Type-specific validation
        if (value !== undefined && value !== null && value !== '') {
            if (attr.type === 'number') {
                if (attr.min_value !== undefined && value < attr.min_value) {
                    errors[attr.name] = `Минимум: ${attr.min_value}`;
                }
                if (attr.max_value !== undefined && value > attr.max_value) {
                    errors[attr.name] = `Максимум: ${attr.max_value}`;
                }
            }
        }
    });

    return errors;
}

export default DynamicForm;
