# Multi-Language Support - TODO for Later

## Current Status: English Only ✅

For simplicity and faster development, the app currently uses **English only**:
- Categories: `name_en`, `description_en`
- Menu Items: `name_en`, `description_en`

## Database Schema (Already Prepared)

The database already has columns for 4 languages:
- English (en)
- Azerbaijani (az)
- Russian (ru)
- Turkish (tr)

**Tables with multi-language support:**
- `categories`: name_en, name_az, name_ru, name_tr, description_*
- `menu_items`: name_en, name_az, name_ru, name_tr, description_*

## When to Add Multi-Language

Add multi-language support **after** all core features are completed:
1. ✅ Menu Management
2. ⏳ Order Management
3. ⏳ Table Management
4. ⏳ Payment Management
5. ⏳ Reports & Analytics

## How to Add Multi-Language Later

### 1. Update Forms (Easy)

In `category-modal.tsx` and `menu-item-modal.tsx`:

```typescript
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'az', label: 'Azerbaijani' },
  { code: 'ru', label: 'Russian' },
  { code: 'tr', label: 'Turkish' },
];

// Add to formData
const [formData, setFormData] = useState({
  name_en: '',
  name_az: '',  // Add these
  name_ru: '',  // Add these
  name_tr: '',  // Add these
  // ... same for descriptions
});

// Show all language fields
{LANGUAGES.map((lang) => (
  <input
    value={formData[`name_${lang.code}`]}
    onChange={(e) => setFormData({ 
      ...formData, 
      [`name_${lang.code}`]: e.target.value 
    })}
  />
))}
```

### 2. Add Language Selector

Create a language store:

```typescript
// src/store/language-store.ts
import { create } from 'zustand';

interface LanguageStore {
  language: 'en' | 'az' | 'ru' | 'tr';
  setLanguage: (lang: 'en' | 'az' | 'ru' | 'tr') => void;
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  language: 'en',
  setLanguage: (language) => set({ language }),
}));
```

### 3. Display Correct Language

In display components:

```typescript
const { language } = useLanguageStore();

// Instead of:
<h2>{category.name_en}</h2>

// Use:
<h2>{category[`name_${language}`] || category.name_en}</h2>
```

### 4. Update Customer Web App

The customer web app (`customer-web/`) will need:
- Language selector in the header
- Display items in selected language
- Fallback to English if translation missing

## Benefits of Current Approach

✅ **Faster Development**: Focus on features, not translations
✅ **Clean Forms**: Simpler, less clutter
✅ **Easy Testing**: One language = faster to test
✅ **Database Ready**: All columns already exist
✅ **Easy Migration**: Just update UI components later

## Estimated Time to Add Multi-Language

Once all features are done, adding multi-language support should take:
- **1-2 hours** to update all forms
- **30 minutes** to add language selector
- **1 hour** to update display components
- **Total: ~3-4 hours** ⏱️

## Files to Update Later

When adding multi-language:
1. `src/components/menu/category-modal.tsx` - Add language fields
2. `src/components/menu/menu-item-modal.tsx` - Add language fields
3. `src/app/(staff)/menu/page.tsx` - Display based on selected language
4. `src/store/language-store.ts` - Create language store (NEW)
5. `src/app/layout.tsx` - Add language selector to header
6. `customer-web/` - All customer-facing pages

## Notes

- The database columns exist and are nullable (except `name_en`)
- `name_en` is required, others are optional
- Always show English as fallback if translation missing
- Consider using a translation library like `react-i18next` for UI labels


