/**
 * AuthContext - manages authentication state across the app
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  collection,
  query,
  where,
  limit,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../api';
import { finiteCoordsOrUndefined, normalizeUserProfileFromFirestore } from '../api/userDocument';
import {
  fetchSystemGlobals,
  isEmailInSuperAdminList,
  isUidInSuperAdminList,
  normalizeEmailForCompare,
  SYSTEM_CONFIG_COLLECTION,
  GLOBALS_DOC_ID,
  type SystemGlobalsFetched,
} from '../api/systemConfig';
import { reassignAllCitiesAndProfessionsToTenant } from '../api/reassignCatalogToTenant';
import type {
  User,
  Professional,
  Service,
  ServicePriceBasis,
  ProfileDisplayType,
} from '../api/types';
import { trialEndMs } from '../utils/subscription';

const TRIAL_MS = 30 * 24 * 60 * 60 * 1000;

/** Προεπιλεγμένο tenant (ίδιο με bootstrap / Admin) — χωρίς αυτό οι απλοί χρήστες δεν βλέπουν επαγγελματίες στην αναζήτηση. */
const DEFAULT_APP_TENANT_ID = 'tenant_default';

function tenantIdMissing(raw: Record<string, unknown>): boolean {
  const t = raw.tenantId;
  if (t == null) return true;
  if (typeof t !== 'string') return true;
  return t.trim() === '';
}

/**
 * Φόρτωση users/{uid}· αν λείπει tenantId, merge tenant_default (μία φορά) ώστε παλιοί λογαριασμοί να δουλεύουν χωρίς χειροκίνητο Firestore.
 */
async function loadUserProfileWithTenantBackfill(uid: string): Promise<User | Professional | null> {
  const docRef = doc(db, 'users', uid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  let raw = snap.data() as Record<string, unknown>;
  if (tenantIdMissing(raw)) {
    try {
      await setDoc(docRef, { tenantId: DEFAULT_APP_TENANT_ID }, { merge: true });
      const again = await getDoc(docRef);
      if (!again.exists()) return null;
      raw = again.data() as Record<string, unknown>;
    } catch {
      /* offline / rules — συνεχίζουμε με ό,τι είχαμε */
    }
  }
  return normalizeUserProfileFromFirestore(uid, raw);
}

export interface UserRegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  profession: string;
  location: string;
}

export interface ProfessionalRegistrationData extends UserRegistrationData {
  businessName: string;
  vat: string;
  profession: string;
  /** `professions/{id}` — ίδιο tenant με τον κατάλογο */
  professionId?: string;
  website: string;
  bio: string;
  address: string;
  addressNumber: string;
  area: string;
  zip: string;
  city: string;
  /** `cities/{id}` όταν η πόλη προέρχεται από Firestore */
  cityId?: string;
  country: string;
  profileDisplayType: ProfileDisplayType;
  profileImageBase64?: string | null;
  latitude?: number;
  longitude?: number;
  serviceName: string;
  serviceDesc: string;
  servicePriceBasis: ServicePriceBasis;
  serviceTimeEstimate: string;
  servicePrice: number;
}

/**
 * Εισαγωγή επαγγελματία από Admin — ίδια πεδία με την εγγραφή επαγγελματία (χωρίς κωδικό / Firebase Auth).
 */
export type AdminProfessionalEntryInput = Omit<ProfessionalRegistrationData, 'password'> & {
  tenantId: string;
};

interface AuthContextValue {
  user: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  /** Υπάρχει το έγγραφο `system_config/globals` στο Firestore. */
  globalsDocExists: boolean;
  /** Συνδεδεμένος χρήστης και η βάση δεν έχει ακόμα globals — εμφανίζεται μοναδικό setup wizard. */
  needsDatabaseSetup: boolean;
  /** Email ή uid στις λίστες `system_config/globals`. */
  isSuperAdmin: boolean;
  /** Email ταιριάζει με `adminEmail` κάποιου εγγράφου στη συλλογή `tenants`. */
  isTenantAdmin: boolean;
  /** `tenantId` από το έγγραφο `users/{uid}` — null αν λείπει. */
  tenantId: string | null;
  /** Πρόσβαση σε tenant-scoped δεδομένα: Super Admin ή χρήστης με μη κενό tenantId. */
  hasTenantDataAccess: boolean;
  /** Admin Dashboard: Super Admin ή Tenant Admin (μόνο από Firestore). */
  canAccessAdminDashboard: boolean;
  /** Πρώτη ρύθμιση: δημιουργία globals + default tenant + tenantId στον τρέχοντα χρήστη. */
  completeFirstTimeDatabaseSetup: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signUpUser: (data: UserRegistrationData) => Promise<void>;
  signUpProfessional: (data: ProfessionalRegistrationData) => Promise<void>;
  /**
   * Δημιουργεί `users/{autoId}` με role `pro` (επαγγελματίας στο σχήμα της εφαρμογής — όχι το string "professional").
   * Δεν καλεί createUserWithEmailAndPassword: η σύνδεση του διαχειριστή μένει ίδια.
   */
  createProfessionalRecordAsAdmin: (input: AdminProfessionalEntryInput) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  /** Ξαναφορτώνει super/tenant flags (μετά από αλλαγές tenants/globals). */
  refreshTenantAccess: () => Promise<void>;
  /** Μετά το seed catalog στο Admin — ξαναφορτώνει πόλεις/επαγγέλματα στα dropdowns. */
  refreshFirestoreCatalog: () => void;
  /** Εσωτερικό trigger για `useFirestoreCatalog`. */
  catalogRefreshNonce: number;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  /** `undefined` = ακόμα δεν ολοκληρώθηκε fetch· `null` = λείπει το globals· αλλιώς υπάρχει doc. */
  const [systemGlobals, setSystemGlobals] = useState<SystemGlobalsFetched | null | undefined>(
    undefined
  );
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);
  const [catalogRefreshNonce, setCatalogRefreshNonce] = useState(0);

  const refreshFirestoreCatalog = useCallback(() => {
    setCatalogRefreshNonce((n) => n + 1);
  }, []);

  const loadTenantAdminFlag = useCallback(async (emailNorm: string, authUid: string): Promise<boolean> => {
    const rowActive = (d: { data: () => Record<string, unknown> }) =>
      (d.data() as { active?: boolean }).active !== false;
    if (authUid) {
      try {
        const byUid = await getDocs(
          query(collection(db, 'tenants'), where('adminUid', '==', authUid), limit(8))
        );
        if (byUid.docs.some(rowActive)) return true;
      } catch {
        /* fallback adminEmail */
      }
    }
    if (!emailNorm) return false;
    try {
      const tSnap = await getDocs(
        query(collection(db, 'tenants'), where('adminEmail', '==', emailNorm), limit(8))
      );
      return tSnap.docs.some(rowActive);
    } catch {
      return false;
    }
  }, []);

  const refreshTenantAccess = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setSystemGlobals(undefined);
      setIsSuperAdmin(false);
      setIsTenantAdmin(false);
      return;
    }
    try {
      const g = await fetchSystemGlobals(db);
      setSystemGlobals(g);
      setIsSuperAdmin(
        g != null &&
          (isEmailInSuperAdminList(firebaseUser.email, g.superAdminEmails) ||
            isUidInSuperAdminList(firebaseUser.uid, g.superAdminUids))
      );
      try {
        const emailNorm = normalizeEmailForCompare(firebaseUser.email ?? '');
        const tenantAdm = await loadTenantAdminFlag(emailNorm, firebaseUser.uid);
        setIsTenantAdmin(tenantAdm);
      } catch {
        setIsTenantAdmin(false);
      }
    } catch {
      setIsSuperAdmin(false);
      setIsTenantAdmin(false);
    }
  }, [loadTenantAdminFlag]);

  const refreshUserProfile = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) {
      setUserProfile(null);
      return;
    }
    try {
      setUserProfile(await loadUserProfileWithTenantBackfill(u.uid));
    } catch {
      setUserProfile(null);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserProfile(null);
        setSystemGlobals(undefined);
        setIsSuperAdmin(false);
        setIsTenantAdmin(false);
        setLoading(false);
        return;
      }

      setSystemGlobals(undefined);

      const uid = firebaseUser.uid;
      const emailNorm = normalizeEmailForCompare(firebaseUser.email ?? '');

      const globalsFetched = await fetchSystemGlobals(db);
      setSystemGlobals(globalsFetched);

      const superA =
        globalsFetched != null &&
        (isEmailInSuperAdminList(firebaseUser.email ?? '', globalsFetched.superAdminEmails) ||
          isUidInSuperAdminList(firebaseUser.uid, globalsFetched.superAdminUids));

      // Προφίλ / tenant-admin query: αν αποτύχουν, να μην «σβήνουμε» το globals (αλλιώς εμφανίζεται
      // setup wizard ενώ το `system_config/globals` υπάρχει και το complete setup λέει «ήδη ρυθμιστεί»).
      let tenantAdm = false;
      let profile: User | Professional | null = null;
      try {
        const [p, tAdm] = await Promise.all([
          loadUserProfileWithTenantBackfill(uid),
          loadTenantAdminFlag(emailNorm, uid),
        ]);
        profile = p;
        tenantAdm = tAdm;
      } catch {
        setUserProfile(null);
        setIsTenantAdmin(false);
        setIsSuperAdmin(superA);
        setLoading(false);
        return;
      }

      setUserProfile(profile);
      setIsSuperAdmin(superA);
      setIsTenantAdmin(tenantAdm);
      setLoading(false);
    });
    return unsubscribe;
  }, [loadTenantAdminFlag]);

  /** Λήξη trial → accountStatus deactivated (στο Firestore). */
  useEffect(() => {
    if (!user || !userProfile || userProfile.role !== 'pro') return;
    const pro = userProfile as Professional;
    if (pro.accountStatus === 'deactivated' || pro.accountStatus === 'subscribed') return;
    const end = trialEndMs(pro);
    if (end == null || Date.now() <= end) return;

    let cancelled = false;
    (async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), { accountStatus: 'deactivated' });
        if (!cancelled) await refreshUserProfile();
      } catch {
        /* offline / rules */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, userProfile, refreshUserProfile]);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const signUpUser = async (data: UserRegistrationData) => {
    const { user: firebaseUser } = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );

    const userDoc: User = {
      uid: firebaseUser.uid,
      email: normalizeEmailForCompare(data.email),
      role: 'user',
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      profession: data.profession,
      location: data.location,
      tenantId: DEFAULT_APP_TENANT_ID,
      friends: [],
      favorites: [],
      pendingRequests: [],
      createdAt: Timestamp.now(),
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), userDoc);
    await refreshUserProfile();
    await refreshTenantAccess();
  };

  const signUpProfessional = async (data: ProfessionalRegistrationData) => {
    const { user: firebaseUser } = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );

    const coords = finiteCoordsOrUndefined(data.latitude, data.longitude);
    if (!coords) {
      throw new Error('Όρισε έγκυρες συντεταγμένες στον χάρτη πριν την εγγραφή.');
    }

    const estimate = data.serviceTimeEstimate.trim();
    const service: Service =
      data.serviceName.trim() || data.serviceDesc || data.servicePrice > 0 || estimate
        ? {
            name: data.serviceName.trim() || 'Υπηρεσία',
            desc: data.serviceDesc,
            price: data.servicePrice,
            priceBasis: data.servicePriceBasis,
            ...(estimate ? { timeEstimate: estimate } : {}),
          }
        : { name: '', desc: '', price: 0, priceBasis: 'fixed' };

    const trialEndDate = Timestamp.fromMillis(Date.now() + TRIAL_MS);

    const proDoc: Professional = {
      uid: firebaseUser.uid,
      email: normalizeEmailForCompare(data.email),
      role: 'pro',
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      profession: data.profession,
      ...(data.professionId ? { professionId: data.professionId } : {}),
      location: data.location,
      friends: [],
      favorites: [],
      pendingRequests: [],
      businessName: data.businessName,
      vat: data.vat,
      website: data.website ?? '',
      bio: data.bio ?? '',
      address: data.address,
      addressNumber: data.addressNumber ?? '',
      area: data.area ?? '',
      zip: data.zip ?? '',
      city: data.city,
      ...(data.cityId ? { cityId: data.cityId } : {}),
      country: data.country ?? 'Ελλάδα',
      profileDisplayType: data.profileDisplayType,
      profileImageBase64:
        data.profileImageBase64 != null && String(data.profileImageBase64).trim() !== ''
          ? data.profileImageBase64
          : null,
      latitude: coords.latitude,
      longitude: coords.longitude,
      services: service.name ? [service] : [],
      ratingAvg: 0,
      totalReviews: 0,
      availableToday: false,
      trialEndDate,
      accountStatus: 'trial',
      subscriptionPlan: null,
      tenantId: DEFAULT_APP_TENANT_ID,
      createdAt: Timestamp.now(),
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), proDoc);
    await refreshUserProfile();
    await refreshTenantAccess();
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const completeFirstTimeDatabaseSetup = useCallback(async () => {
    const fu = auth.currentUser;
    if (!fu?.email) {
      throw new Error('Δεν βρέθηκε συνδεδεμένος χρήστης.');
    }
    const existing = await getDoc(doc(db, SYSTEM_CONFIG_COLLECTION, GLOBALS_DOC_ID));
    if (existing.exists()) {
      throw new Error('Η βάση έχει ήδη ρυθμιστεί. Αν είσαι Super Admin, κάνε αποσύνδεση και ξανά σύνδεση.');
    }
    const emailNorm = normalizeEmailForCompare(fu.email);
    const globalsPayload = {
      superAdminEmails: [emailNorm],
      superAdminUids: [fu.uid],
    };

    try {
      // Βήμα 1 — μόνο globals (ώστε τα rules / token να «σταθεροποιηθούν» πριν τα υπόλοιπα)
      console.log('[bootstrap] step 1/4: setDoc system_config/globals');
      await setDoc(doc(db, SYSTEM_CONFIG_COLLECTION, GLOBALS_DOC_ID), globalsPayload);
      setSystemGlobals({ superAdminEmails: [emailNorm], superAdminUids: [fu.uid] });
      setIsSuperAdmin(true);
      console.log('[bootstrap] step 1 OK');
    } catch (e) {
      console.error('[bootstrap] FAILED step 1 system_config/globals', e);
      throw new Error(
        `[Βήμα 1: system_config/globals] ${e instanceof Error ? e.message : String(e)}`
      );
    }

    try {
      console.log('[bootstrap] step 2/4: setDoc tenants/tenant_default');
      await setDoc(doc(db, 'tenants', DEFAULT_APP_TENANT_ID), {
        tenantId: DEFAULT_APP_TENANT_ID,
        displayName: 'Default organization',
        adminEmail: emailNorm,
        adminUid: fu.uid,
        active: true,
        createdAt: Timestamp.now(),
      });
      console.log('[bootstrap] step 2 OK');
    } catch (e) {
      console.error('[bootstrap] FAILED step 2 tenants/tenant_default', e);
      throw new Error(
        `[Βήμα 2: tenants/tenant_default] ${e instanceof Error ? e.message : String(e)}`
      );
    }

    try {
      console.log('[bootstrap] step 3/4: reassign cities/professions tenantId');
      await reassignAllCitiesAndProfessionsToTenant(db, DEFAULT_APP_TENANT_ID);
      console.log('[bootstrap] step 3 OK');
    } catch (e) {
      console.error('[bootstrap] FAILED step 3 reassignCatalogToTenant', e);
      throw new Error(
        `[Βήμα 3: cities/professions tenantId] ${e instanceof Error ? e.message : String(e)}`
      );
    }

    try {
      console.log('[bootstrap] step 4/4: setDoc users/{uid} merge');
      await setDoc(
        doc(db, 'users', fu.uid),
        { tenantId: DEFAULT_APP_TENANT_ID, role: 'superadmin' },
        { merge: true }
      );
      console.log('[bootstrap] step 4 OK');
    } catch (e) {
      console.error('[bootstrap] FAILED step 4 users/{uid}', e);
      throw new Error(`[Βήμα 4: users] ${e instanceof Error ? e.message : String(e)}`);
    }

    setIsTenantAdmin(true);
    await refreshUserProfile();
    await refreshTenantAccess();
    refreshFirestoreCatalog();
  }, [refreshUserProfile, refreshTenantAccess, refreshFirestoreCatalog]);

  const tenantId =
    userProfile && typeof userProfile.tenantId === 'string' && userProfile.tenantId.trim() !== ''
      ? userProfile.tenantId.trim()
      : null;

  const hasTenantDataAccess = isSuperAdmin || tenantId != null;

  const canAccessAdminDashboard = isSuperAdmin || isTenantAdmin;

  const createProfessionalRecordAsAdmin = useCallback(
    async (input: AdminProfessionalEntryInput) => {
      if (!auth.currentUser) {
        throw new Error('Χρειάζεται σύνδεση.');
      }
      if (!isSuperAdmin && !isTenantAdmin) {
        throw new Error('Δεν έχεις δικαίωμα να προσθέτεις επαγγελματίες.');
      }
      if (!isSuperAdmin) {
        if (!tenantId || input.tenantId.trim() !== tenantId) {
          throw new Error('Μπορείς να προσθέτεις μόνο στον δικό σου tenant.');
        }
      }

      const coords = finiteCoordsOrUndefined(input.latitude, input.longitude);
      if (!coords) {
        throw new Error('Όρισέ έγκυρες συντεταγμένες στον χάρτη πριν την αποθήκευση.');
      }

      const estimate = input.serviceTimeEstimate.trim();
      const service: Service =
        input.serviceName.trim() || input.serviceDesc || input.servicePrice > 0 || estimate
          ? {
              name: input.serviceName.trim() || 'Υπηρεσία',
              desc: input.serviceDesc,
              price: input.servicePrice,
              priceBasis: input.servicePriceBasis,
              ...(estimate ? { timeEstimate: estimate } : {}),
            }
          : { name: '', desc: '', price: 0, priceBasis: 'fixed' };

      const trialEndDate = Timestamp.fromMillis(Date.now() + TRIAL_MS);
      const emailRaw = input.email.trim();
      const emailNorm = emailRaw ? normalizeEmailForCompare(emailRaw) : '';

      const newRef = doc(collection(db, 'users'));
      const uid = newRef.id;

      const proDoc: Professional = {
        uid,
        email: emailNorm,
        role: 'pro',
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone.trim(),
        profession: input.profession.trim(),
        ...(input.professionId ? { professionId: input.professionId } : {}),
        location: `${input.city.trim()}, ${input.country.trim() || 'Ελλάδα'}`,
        friends: [],
        favorites: [],
        pendingRequests: [],
        businessName: input.businessName.trim(),
        vat: input.vat.trim(),
        website: input.website ?? '',
        bio: input.bio ?? '',
        address: input.address.trim(),
        addressNumber: input.addressNumber ?? '',
        area: input.area ?? '',
        zip: input.zip.trim(),
        city: input.city.trim(),
        ...(input.cityId ? { cityId: input.cityId } : {}),
        country: input.country ?? 'Ελλάδα',
        profileDisplayType: input.profileDisplayType,
        profileImageBase64:
          input.profileImageBase64 != null && String(input.profileImageBase64).trim() !== ''
            ? input.profileImageBase64
            : null,
        latitude: coords.latitude,
        longitude: coords.longitude,
        services: service.name ? [service] : [],
        ratingAvg: 0,
        totalReviews: 0,
        availableToday: false,
        trialEndDate,
        accountStatus: 'trial',
        subscriptionPlan: null,
        tenantId: input.tenantId.trim(),
      };

      await setDoc(newRef, proDoc);
    },
    [isSuperAdmin, isTenantAdmin, tenantId]
  );

  const globalsDocExists = systemGlobals !== undefined && systemGlobals !== null;
  const needsDatabaseSetup = Boolean(user && !loading && systemGlobals === null);

  const value: AuthContextValue = {
    user,
    userProfile,
    loading,
    globalsDocExists,
    needsDatabaseSetup,
    isSuperAdmin,
    isTenantAdmin,
    tenantId,
    hasTenantDataAccess,
    canAccessAdminDashboard,
    completeFirstTimeDatabaseSetup,
    signIn,
    sendPasswordReset,
    signUpUser,
    signUpProfessional,
    createProfessionalRecordAsAdmin,
    signOut,
    refreshUserProfile,
    refreshTenantAccess,
    refreshFirestoreCatalog,
    catalogRefreshNonce,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
