-- Migration: Simplify multilingual columns
-- Removes per-language columns (name_en, name_az, name_ru, name_tr, description_*)
-- Replaces with single name/description columns
-- Adds preferred_language to staff table

-- Step 1: Add new columns to menu_items
ALTER TABLE menu_items ADD COLUMN name text;
ALTER TABLE menu_items ADD COLUMN description text;

-- Step 2: Add new columns to categories
ALTER TABLE categories ADD COLUMN name text;
ALTER TABLE categories ADD COLUMN description text;

-- Step 3: Copy data from English columns
UPDATE menu_items SET name = name_en, description = description_en;
UPDATE categories SET name = name_en, description = description_en;

-- Step 4: Make name NOT NULL
ALTER TABLE menu_items ALTER COLUMN name SET NOT NULL;
ALTER TABLE categories ALTER COLUMN name SET NOT NULL;

-- Step 5: Drop old language columns from menu_items
ALTER TABLE menu_items DROP COLUMN name_en;
ALTER TABLE menu_items DROP COLUMN name_az;
ALTER TABLE menu_items DROP COLUMN name_ru;
ALTER TABLE menu_items DROP COLUMN name_tr;
ALTER TABLE menu_items DROP COLUMN description_en;
ALTER TABLE menu_items DROP COLUMN description_az;
ALTER TABLE menu_items DROP COLUMN description_ru;
ALTER TABLE menu_items DROP COLUMN description_tr;

-- Step 6: Drop old language columns from categories
ALTER TABLE categories DROP COLUMN name_en;
ALTER TABLE categories DROP COLUMN name_az;
ALTER TABLE categories DROP COLUMN name_ru;
ALTER TABLE categories DROP COLUMN name_tr;
ALTER TABLE categories DROP COLUMN description_en;
ALTER TABLE categories DROP COLUMN description_az;
ALTER TABLE categories DROP COLUMN description_ru;
ALTER TABLE categories DROP COLUMN description_tr;

-- Step 7: Add preferred_language to staff
ALTER TABLE staff ADD COLUMN preferred_language text DEFAULT 'en';
