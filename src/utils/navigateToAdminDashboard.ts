import { Alert } from 'react-native';

type NavLike = {
  getState?: () => { routeNames?: string[] } | undefined;
  navigate: (name: string) => void;
  getParent?: () => NavLike | undefined;
};

/**
 * Βρίσκει stack που έχει καταχωρημένο το AdminDashboard και καλεί navigate.
 * (Από tab screen συνήθως χρειάζονται 2 επίπεδα parent.)
 */
export function navigateToAdminDashboard(navigation: unknown): void {
  let p = navigation as NavLike | undefined;
  for (let i = 0; i < 8 && p; i++) {
    const state = p.getState?.();
    if (state?.routeNames?.includes('AdminDashboard')) {
      p.navigate('AdminDashboard');
      return;
    }
    p = p.getParent?.();
  }
  Alert.alert(
    'Πλοήγηση Admin',
    'Δεν βρέθηκε η οθόνη Admin στο navigator. Κλείσε εντελώς την εφαρμογή, τρέξε από το φάκελο webnet_app: npx expo start --clear και κάνε Reload.'
  );
}
