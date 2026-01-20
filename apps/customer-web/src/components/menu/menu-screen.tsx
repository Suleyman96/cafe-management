"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCategories, useMenuItems } from "@/hooks/use-menu";
import { useCartStore } from "@/store/cart-store";
import { useLanguageStore } from "@/store/language-store";
import { getLocalizedField, type MenuItemWithCategory } from "@/types";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MenuItemCard } from "./menu-item-card";
import { ShoppingCart, ArrowLeft, Search, X, Leaf, Flame, Wheat } from "lucide-react";

interface MenuScreenProps {
  tableId: string;
}

type DietaryFilter = "vegetarian" | "vegan" | "gluten_free" | "spicy";

export function MenuScreen({ tableId }: MenuScreenProps) {
  const router = useRouter();
  const { language } = useLanguageStore();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [dietaryFilters, setDietaryFilters] = useState<DietaryFilter[]>([]);

  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: menuItems, isLoading: itemsLoading } = useMenuItems(selectedCategory);
  const itemCount = useCartStore((state) => state.getItemCount());

  // Filter menu items based on search and dietary preferences
  const filteredItems = useMemo(() => {
    if (!menuItems) return [];

    return menuItems.filter((item) => {
      // Search filter
      if (searchQuery) {
        const name = getLocalizedField(item, "name", language).toLowerCase();
        const description = getLocalizedField(item, "description", language).toLowerCase();
        const query = searchQuery.toLowerCase();

        if (!name.includes(query) && !description.includes(query)) {
          return false;
        }
      }

      // Dietary filters
      if (dietaryFilters.length > 0) {
        if (dietaryFilters.includes("vegetarian") && !item.is_vegetarian) return false;
        if (dietaryFilters.includes("vegan") && !item.is_vegan) return false;
        if (dietaryFilters.includes("gluten_free") && !item.is_gluten_free) return false;
        if (dietaryFilters.includes("spicy") && !item.is_spicy) return false;
      }

      return true;
    });
  }, [menuItems, searchQuery, dietaryFilters, language]);

  const toggleDietaryFilter = (filter: DietaryFilter) => {
    setDietaryFilters((prev) =>
      prev.includes(filter)
        ? prev.filter((f) => f !== filter)
        : [...prev, filter]
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDietaryFilters([]);
    setShowSearch(false);
  };

  const hasActiveFilters = searchQuery || dietaryFilters.length > 0;

  if (categoriesLoading || itemsLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {showSearch ? (
            <div className="flex-1 mx-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search menu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 rounded-full border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <h1 className="text-xl font-bold">Menu</h1>
          )}

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearch(!showSearch)}
            >
              {showSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/table/${tableId}/cart`)}
              className="relative"
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {itemCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Dietary Filters */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
          <Button
            variant={dietaryFilters.includes("vegetarian") ? "default" : "outline"}
            size="sm"
            onClick={() => toggleDietaryFilter("vegetarian")}
            className="whitespace-nowrap flex-shrink-0"
          >
            <Leaf className="h-3.5 w-3.5 mr-1 text-green-600" />
            Vegetarian
          </Button>
          <Button
            variant={dietaryFilters.includes("vegan") ? "default" : "outline"}
            size="sm"
            onClick={() => toggleDietaryFilter("vegan")}
            className="whitespace-nowrap flex-shrink-0"
          >
            <Leaf className="h-3.5 w-3.5 mr-1 text-green-700" />
            Vegan
          </Button>
          <Button
            variant={dietaryFilters.includes("gluten_free") ? "default" : "outline"}
            size="sm"
            onClick={() => toggleDietaryFilter("gluten_free")}
            className="whitespace-nowrap flex-shrink-0"
          >
            <Wheat className="h-3.5 w-3.5 mr-1" />
            Gluten Free
          </Button>
          <Button
            variant={dietaryFilters.includes("spicy") ? "default" : "outline"}
            size="sm"
            onClick={() => toggleDietaryFilter("spicy")}
            className="whitespace-nowrap flex-shrink-0"
          >
            <Flame className="h-3.5 w-3.5 mr-1 text-red-600" />
            Spicy
          </Button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(undefined)}
            className="whitespace-nowrap flex-shrink-0"
          >
            All
          </Button>
          {categories?.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="whitespace-nowrap flex-shrink-0"
            >
              {category.icon && <span className="mr-1">{category.icon}</span>}
              {getLocalizedField(category, "name", language)}
            </Button>
          ))}
        </div>

        {/* Active Filters Indicator */}
        {hasActiveFilters && (
          <div className="px-4 pb-2 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filteredItems.length} items found
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs h-6"
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Menu Items Grid */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground mb-4">
              {hasActiveFilters
                ? "No items match your filters"
                : "No menu items available"
              }
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Cart Button (Fixed Bottom) */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button
            size="xl"
            className="w-full"
            onClick={() => router.push(`/table/${tableId}/cart`)}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            View Cart ({itemCount} items)
          </Button>
        </div>
      )}
    </div>
  );
}
