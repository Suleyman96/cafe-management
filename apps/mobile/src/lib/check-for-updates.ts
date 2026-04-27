import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';

export async function checkForOtaUpdate(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) return false;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return false;
    await Updates.fetchUpdateAsync();
    return true;
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'ota-update' } });
    return false;
  }
}
