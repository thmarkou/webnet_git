type NavLike = {
  getParent?: () => NavLike | undefined;
  navigate: (name: string) => void;
};

/** Από tab screen (π.χ. Ρυθμίσεις) → parent stack → AdminPanel */
export function navigateToAdminPanel(navigation: unknown): void {
  const n = navigation as NavLike;
  const tabNav = n.getParent?.();
  const stackNav = tabNav?.getParent?.() ?? tabNav ?? n;
  stackNav.navigate('AdminDashboard');
}
