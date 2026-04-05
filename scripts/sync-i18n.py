#!/usr/bin/env python3
"""
Sync all i18n language files with English source of truth.

- Adds missing translations from translation dictionaries
- Removes obsolete keys not present in English
- Preserves existing translations
- Sorts keys alphabetically
- Writes back with proper JSON formatting
"""

import json
import os
import sys

LOCALES_DIR = os.path.join(
    os.path.dirname(__file__),
    '..', 'packages', 'i18n', 'src', 'locales'
)

LANGUAGES = [
    'ar', 'az', 'de', 'el', 'es', 'fa', 'fr',
    'id', 'it', 'ja', 'ka', 'kk', 'ko',
    'pt', 'ru', 'th', 'tr', 'uk', 'uz'
]

# Group A: languages missing the most keys (188)
GROUP_A = ['ar', 'el', 'fa', 'id', 'it', 'ja', 'ka', 'kk', 'ko', 'ru', 'th', 'uk', 'uz']
# Group B: languages missing 180 keys (have calls.acknowledge etc + menu.items/categories + orders.closed)
GROUP_B = ['de', 'es', 'fr', 'pt', 'tr']
# Group C: az - missing 163 keys (also has orders.cancelItem etc)
GROUP_C = ['az']

FILES_TO_SYNC = ['staff.json', 'auth.json', 'customer.json', 'nav.json']


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


def sync_file(en_data, lang_data, translations, lang, obsolete_keys=None):
    """
    Sync a language file with English source.
    - Add missing keys from translations dict
    - Remove keys not in English
    - Remove explicitly obsolete keys
    - Preserve existing translations
    """
    en_keys = set(en_data.keys())
    lang_keys = set(lang_data.keys())

    # Start with existing data
    result = dict(lang_data)

    # Remove obsolete keys (not in English)
    removed = 0
    for key in lang_keys - en_keys:
        del result[key]
        removed += 1

    # Remove explicitly obsolete keys
    if obsolete_keys:
        for key in obsolete_keys:
            if key in result:
                del result[key]
                removed += 1

    # Add missing keys
    added = 0
    missing = en_keys - lang_keys
    for key in missing:
        if key in translations and lang in translations[key]:
            result[key] = translations[key][lang]
            added += 1
        else:
            # Fallback to English if no translation available
            result[key] = en_data[key]
            added += 1
            print(f'  WARNING: No translation for {key} in {lang}, using English fallback')

    # Sort keys alphabetically
    result = dict(sorted(result.items()))

    return result, added, removed


def main():
    # Import translations from part files
    sys.path.insert(0, os.path.dirname(__file__))

    from importlib import import_module

    # Staff translations split across 3 part files
    part1 = import_module('i18n-staff-part1')
    part2 = import_module('i18n-staff-part2')
    part3 = import_module('i18n-staff-part3')
    other_mod = import_module('i18n-translations-other')

    # Build combined staff translations dict from all parts
    staff_translations = {}
    staff_translations.update(part1.PART1)
    staff_translations.update(part2.PART2)
    staff_translations.update(part3.PART3)

    # Add Group A only keys (from part3)
    if hasattr(part3, 'GROUP_A_ONLY'):
        for key, langs in part3.GROUP_A_ONLY.items():
            if key not in staff_translations:
                staff_translations[key] = {}
            for lang, val in langs.items():
                if lang in GROUP_A:
                    staff_translations[key][lang] = val

    auth_translations = dict(other_mod.AUTH_TRANSLATIONS)
    customer_translations = dict(other_mod.CUSTOMER_TRANSLATIONS)
    nav_translations = dict(other_mod.NAV_TRANSLATIONS)
    customer_obsolete = other_mod.CUSTOMER_OBSOLETE_KEYS

    # Staff obsolete keys (old feedback workflow keys)
    staff_obsolete = [
        'feedback.ackShort', 'feedback.acknowledge', 'feedback.acknowledgedTab',
        'feedback.allTab', 'feedback.by', 'feedback.dismiss',
        'feedback.dismissConfirm', 'feedback.dismissedTab',
        'feedback.failedAcknowledge', 'feedback.failedDismiss',
        'feedback.failedRespond', 'feedback.feedbackAcknowledged',
        'feedback.feedbackDismissed', 'feedback.noResponse',
        'feedback.pendingTab', 'feedback.resolvedTab',
        'feedback.respond', 'feedback.respondResolve',
        'feedback.responseSent', 'feedback.sendResponse',
        'feedback.sending', 'feedback.staffResponse',
        'feedback.status.acknowledged', 'feedback.status.dismissed',
        'feedback.status.resolved', 'feedback.writeResponse',
    ]

    total_added = 0
    total_removed = 0

    for lang in LANGUAGES:
        print(f'\n=== {lang.upper()} ===')
        lang_dir = os.path.join(LOCALES_DIR, lang)

        for fname in FILES_TO_SYNC:
            en_path = os.path.join(LOCALES_DIR, 'en', fname)
            lang_path = os.path.join(lang_dir, fname)

            if not os.path.exists(lang_path):
                print(f'  {fname}: SKIPPED (file not found)')
                continue

            en_data = load_json(en_path)
            lang_data = load_json(lang_path)

            # Select appropriate translations and obsolete keys
            if fname == 'staff.json':
                translations = staff_translations
                obsolete = staff_obsolete
            elif fname == 'auth.json':
                translations = auth_translations
                obsolete = None
            elif fname == 'customer.json':
                translations = customer_translations
                obsolete = customer_obsolete
            elif fname == 'nav.json':
                translations = nav_translations
                obsolete = None
            else:
                continue

            result, added, removed = sync_file(
                en_data, lang_data, translations, lang, obsolete
            )

            if added > 0 or removed > 0:
                save_json(lang_path, result)
                print(f'  {fname}: +{added} added, -{removed} removed')
                total_added += added
                total_removed += removed
            else:
                print(f'  {fname}: OK (no changes)')

    print(f'\n=== SUMMARY ===')
    print(f'Total added: {total_added}')
    print(f'Total removed: {total_removed}')
    print(f'Languages processed: {len(LANGUAGES)}')

    # Verify sync
    print(f'\n=== VERIFICATION ===')
    all_good = True
    for lang in LANGUAGES:
        for fname in FILES_TO_SYNC:
            en_path = os.path.join(LOCALES_DIR, 'en', fname)
            lang_path = os.path.join(LOCALES_DIR, lang, fname)
            if not os.path.exists(lang_path):
                continue
            en_keys = set(load_json(en_path).keys())
            lang_keys = set(load_json(lang_path).keys())
            missing = en_keys - lang_keys
            extra = lang_keys - en_keys
            if missing or extra:
                print(f'  {lang}/{fname}: FAIL - missing={len(missing)} extra={len(extra)}')
                if missing:
                    print(f'    Missing: {sorted(missing)[:5]}...')
                all_good = False

    if all_good:
        print('  All files in sync!')
    else:
        print('  Some files still have issues.')


if __name__ == '__main__':
    main()
