'use client';

import type { Database } from '@gustri/database';
import type { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { Search } from 'lucide-react';
import Link from 'next/link';

type Category = Database['public']['Tables']['categories']['Row'];

type TFunc = ReturnType<typeof useTranslation>['t'];

interface MenuPageHeaderProps {
  categories: Category[];
  menuItemCount: number;
  filteredItemCount: number;
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddCategory: () => void;
  onAddMenuItem: () => void;
  getCategoryItemCount: (categoryId: string) => number;
  t: TFunc;
}

export function MenuPageHeader({
  categories,
  menuItemCount,
  filteredItemCount,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onAddCategory,
  onAddMenuItem,
  getCategoryItemCount,
  t,
}: MenuPageHeaderProps) {
  return (
    <header className="bg-white border-b shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm shrink-0">
              ←
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                {t('menu.title')}
              </h1>
              <p className="text-xs text-gray-400 hidden sm:block">
                {t('menu.items', { count: filteredItemCount })} ·{' '}
                {t('menu.categories', { count: categories.length })}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              onClick={onAddCategory}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">+ {t('menu.addCategory')}</span>
              <span className="sm:hidden">+ {t('menu.categoryShort')}</span>
            </Button>
            <Button onClick={onAddMenuItem} size="sm" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">+ {t('menu.addMenuItem')}</span>
              <span className="sm:hidden">+ {t('menu.itemShort')}</span>
            </Button>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('menu.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
          <button
            onClick={() => onSelectCategory(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
              selectedCategory === null
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {t('menu.allItems')} ({menuItemCount})
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                selectedCategory === category.id
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {category.icon || '📁'} {category.name} ({getCategoryItemCount(category.id)})
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
