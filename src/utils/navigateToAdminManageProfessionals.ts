import { Alert } from 'react-native';

type NavLike = {
  getState?: () => { routeNames?: string[] } | undefined;
  navigate: (name: string) => void;
  getParent?: () => NavLike | undefined;
};

/** Stack του MainNavigator που περιέχει την οθόνη λίστας επαγγελματιών (Super Admin). */
export function navigateToAdminManageProfessionals(navigation: unknown): void {
  let p = navigation as NavLike | undefined;
  for (let i = 0; i < 8 && p; i++) {
    const state = p.getState?.();
    if (state?.routeNames?.includes('AdminManageProfessionals')) {
      p.navigate('AdminManageProfessionals');
      return;
    }
    p = p.getParent?.();
  }
  Alert.alert(
    'Πλοήγηση',
    'Δεν βρέθηκε η οθόνη διαχείρισης επαγγελματιών. Κάνε reload στην εφαρμογή ή άνοιξε Ρυθμίσεις → Super Admin.'
  );
}
