import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Category, MenuItem, MenuItemWithCategory } from "@/types";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as Category[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useMenuItems(categoryId?: string) {
  return useQuery({
    queryKey: ["menu_items", categoryId],
    queryFn: async () => {
      let query = supabase
        .from("menu_items")
        .select("*, category:categories(*)")
        .eq("is_available", true)
        .order("display_order", { ascending: true });

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as MenuItemWithCategory[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useMenuItem(itemId: string) {
  return useQuery({
    queryKey: ["menu_item", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*, category:categories(*)")
        .eq("id", itemId)
        .single();

      if (error) throw error;
      return data as MenuItemWithCategory;
    },
    staleTime: 1000 * 60 * 5,
  });
}


