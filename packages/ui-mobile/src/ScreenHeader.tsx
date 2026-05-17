import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SEMANTIC_COLORS } from '@gustri/design-tokens';
import { useTranslation } from '@gustri/i18n';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './lib/paper-compat';

/**
 * Structural subset of `@react-navigation/stack`'s `StackHeaderProps`. Kept
 * inline rather than imported from the real package so this UI package
 * doesn't pin its own copy of `@react-navigation/stack` — pnpm would
 * otherwise instantiate a separate dependency context and the mobile app's
 * `StackHeaderProps` wouldn't unify with ours at type-check time.
 *
 * `@react-navigation/stack`'s real type is wider; the consuming
 * `header: (props) => <ScreenHeader {...props} />` setter passes the wider
 * shape into this narrower one, which TS accepts.
 */
interface StackHeaderPropsLite {
  navigation: { goBack: () => void };
  route: unknown;
  options: unknown;
  back?: { title?: string } | undefined;
}

type StackNavigationOptionsLike = Record<string, unknown>;

/**
 * Shape of the extra fields each stack screen may stuff into its
 * `Stack.Screen options` so this custom header can resolve them.
 *
 * `titleKey` + `titleNs` are read here so the navigator config can stay
 * static at module load (no `useTranslation` available there). Standard
 * `title` is still honored as a fallback for legacy callers.
 */
export interface ScreenHeaderOptions {
  /** i18n key resolved inside the header. */
  titleKey?: string;
  /** Namespace for `titleKey`. Defaults to `nav`. */
  titleNs?: string;
  /** Plain title — used only when `titleKey` is absent. */
  title?: string;
  /** Standard React Navigation render fns are forwarded through. */
  headerRight?: (props: { tintColor?: string }) => ReactNode;
  headerLeft?: (props: { tintColor?: string; canGoBack?: boolean }) => ReactNode;
}

/**
 * Helper that lets a stack config pass our custom `titleKey` / `titleNs` fields
 * alongside the standard React Navigation options. React Navigation typed its
 * `StackNavigationOptions` as a type alias (not an interface), so we can't
 * extend it via module augmentation — this is the next-cleanest thing.
 */
export function headerOptions(
  options: StackNavigationOptionsLike & ScreenHeaderOptions,
): StackNavigationOptionsLike {
  return options;
}

/**
 * Shared custom header used across every mobile Stack.Navigator.
 *
 * Why a custom header instead of React Navigation's default:
 *  - i18n: stack configs are evaluated at module load, so they can't call
 *    `useTranslation`. Reading `options.titleKey` here lets each screen
 *    declare a key statically and we resolve it reactively to the current
 *    locale (and re-render on language change).
 *  - Consistency: one place to tune typography, height, back-arrow style.
 *  - Slots: leaves `headerRight` open for the FreshnessIndicator (task 1.2)
 *    without each stack having to re-implement the layout.
 */
export function ScreenHeader({ navigation, route: _route, options, back }: StackHeaderPropsLite) {
  const insets = useSafeAreaInsets();
  const cfg = options as ScreenHeaderOptions;
  const ns = cfg.titleNs ?? 'nav';
  const { t } = useTranslation(ns);
  const title = cfg.titleKey ? t(cfg.titleKey) : (cfg.title ?? '');

  const leftSlot = cfg.headerLeft ? (
    cfg.headerLeft({ tintColor: SEMANTIC_COLORS.textPrimary, canGoBack: !!back })
  ) : back ? (
    <BackButton onPress={navigation.goBack} />
  ) : null;

  const rightSlot = cfg.headerRight
    ? cfg.headerRight({ tintColor: SEMANTIC_COLORS.textPrimary })
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.side}>{leftSlot}</View>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={[styles.side, styles.sideRight]}>{rightSlot}</View>
      </View>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation('common');
  return (
    <Pressable
      onPress={onPress}
      style={styles.iconButton}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('back')}
    >
      <MaterialCommunityIcons name="arrow-left" size={24} color={SEMANTIC_COLORS.textPrimary} />
    </Pressable>
  );
}

const HEADER_HEIGHT = 52;
const SIDE_MIN_WIDTH = 56;

const styles = StyleSheet.create({
  container: {
    backgroundColor: SEMANTIC_COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SEMANTIC_COLORS.border,
  },
  row: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  side: {
    minWidth: SIDE_MIN_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: SEMANTIC_COLORS.textPrimary,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
