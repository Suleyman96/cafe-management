"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCategories, useMenuItems } from "@/hooks/use-menu";
import { useCartStore } from "@/store/cart-store";
import { useLanguageStore } from "@/store/language-store";
import { getLocalizedField } from "@/types";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MenuItemCard } from "./menu-item-card";
import { ShoppingCart, ArrowLeft } from "lucide-react";

interface MenuScreenProps {
  tableId: string;
}

export function MenuScreen({ tableId }: MenuScreenProps) {
  const router = useRouter();
  const { language } = useLanguageStore();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: menuItems, isLoading: itemsLoading } = useMenuItems(selectedCategory);
  const itemCount = useCartStore((state) => state.getItemCount());

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
          <h1 className="text-xl font-bold">Menu</h1>
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

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(undefined)}
            className="whitespace-nowrap"
          >
            All
          </Button>
          {categories?.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="whitespace-nowrap"
            >
              {category.icon && <span className="mr-1">{category.icon}</span>}
              {getLocalizedField(category, "name", language)}
            </Button>
          ))}
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {menuItems?.map((item) => (
          <MenuItemCard key={item.id} item={item} />
        ))}
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


