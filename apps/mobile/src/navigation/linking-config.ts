import type { LinkingOptions } from '@react-navigation/native';

/**
 * React Navigation linking config — declarative deep-link / universal-link
 * routing for the staff app. Centralizing route mappings here lets us share
 * one dispatch path between OS-level link taps (iMessage, Mail, Chrome) and
 * notification handlers, instead of maintaining a parallel imperative tree.
 *
 * Domain `app.gustri.com` must serve the well-known association files at:
 *   - https://app.gustri.com/.well-known/apple-app-site-association
 *   - https://app.gustri.com/.well-known/assetlinks.json
 *
 * The custom `gustri://` scheme remains a fallback for environments that
 * don't honor universal links (e.g. some local dev tools).
 */
// React Navigation's RootParamList is augmented elsewhere; the screen-config
// types collide with our nested stack shape, so we cast at the boundary.
export const linkingConfig: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: ['https://app.gustri.com', 'gustri://'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'auth/login',
        },
      },
      Main: {
        screens: {
          OrdersTab: {
            screens: {
              OrdersList: 'orders',
              OrderDetail: 'orders/:orderId',
            },
          },
          TablesTab: {
            screens: {
              TablesList: 'tables',
              TableDetail: 'tables/:tableId',
            },
          },
        },
      },
    },
    // biome-ignore lint/suspicious/noExplicitAny: nested stack shape doesn't fit RootParamList
  } as any,
};
