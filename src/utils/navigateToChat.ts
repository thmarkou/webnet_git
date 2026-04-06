import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { Professional } from '../api/types';

/** Navigate χωρίς αυστηρό ParamList — το `Chat` είναι στο root stack. */
type StackNavigate = { navigate: (name: string, params?: Record<string, unknown>) => void };

/**
 * Βρίσκει navigator που έχει καταχωρημένο το `Chat` (MainNavigator) και καλεί navigate.
 */
export function navigateToChat(
  navigation: NavigationProp<ParamListBase>,
  professional: Professional,
  clientUserId?: string
): void {
  const params: Record<string, unknown> = { professional, ...(clientUserId ? { clientUserId } : {}) };
  let parent: NavigationProp<ParamListBase> | undefined = navigation;
  for (let i = 0; i < 8; i++) {
    if (!parent) break;
    const names = parent.getState?.()?.routeNames;
    if (names?.includes('Chat')) {
      (parent as StackNavigate).navigate('Chat', params);
      return;
    }
    parent = parent.getParent?.();
  }
  const fallback = navigation.getParent?.()?.getParent?.();
  if (fallback) {
    (fallback as StackNavigate).navigate('Chat', params);
  }
}
