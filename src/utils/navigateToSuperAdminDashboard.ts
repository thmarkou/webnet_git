import { Alert } from 'react-native';

type NavLike = {
  getState?: () => { routeNames?: string[] } | undefined;
  navigate: (name: string) => void;
  getParent?: () => NavLike | undefined;
};

export function navigateToSuperAdminDashboard(navigation: unknown): void {
  let p = navigation as NavLike | undefined;
  for (let i = 0; i < 8 && p; i++) {
    const state = p.getState?.();
    if (state?.routeNames?.includes('SuperAdminDashboard')) {
      p.navigate('SuperAdminDashboard');
      return;
    }
    p = p.getParent?.();
  }
  Alert.alert(
    'Πλοήγηση',
    'Δεν βρέθηκε η οθόνη Super Admin στον navigator. Κάνε Reload στην εφαρμογή.'
  );
}
