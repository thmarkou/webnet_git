# Changelog — 23 Μαρτίου 2026

Multi-tenant, Super Admin, πρώτο setup Firestore, crystal reset, rules — και **ανοιχτό σφάλμα** permissions.

---

## 1. Τι υλοποιήθηκε

- **`system_config/globals`**: `superAdminEmails` + **`superAdminUids`** (JWT στο mobile συχνά χωρίς `email`· το `uid` στα rules).
- **Πρώτο setup** (`FirstTimeDatabaseSetupScreen` / `completeFirstTimeDatabaseSetup`): globals, tenant `tenant_default`, superadmin, **`setDoc` με `merge`** στο `users/{uid}`.
- **`reassignAllCitiesAndProfessionsToTenant`**: μετά το setup, όλα τα `cities` / `professions` παίρνουν `tenantId: tenant_default` (όχι ορφανά `tenantId` μετά crystal που κρατάει καταλόγους).
- **Crystal reset (Settings, Super Admin)**: σβήνει `reviews`, `importedProfessionals`, `tenants`, `users`, `system_config` — **όχι** `cities` / `professions` (για εγγραφή νέου χρήστη με dropdowns).
- **AuthContext**: αποτυχία `getDoc(users)` ή tenant-admin query να **μην μηδενίζει** `systemGlobals`.
- **`firestore.rules`**: `isSuperAdmin()` = uid στη λίστα **ή** email στο token **ή** `users/{uid}.email` ∈ `superAdminEmails`· tenants με **`adminUid`**· διαγραφή `system_config` για Super Admin.
- **Εγγραφή**: `email` normalized (lowercase) στο `users`.
- **Self-update `users`**: κλείδωμα αλλαγής `email` (ίδιο `resource` / `request`) για ασφάλεια.
- **SuperAdminDashboard**: `buildGlobalsSuperAdminPayload`, tenant με **`adminUid`** όταν υπάρχει χρήστης με το admin email.

**Κύρια αρχεία:** `firestore.rules`, `src/context/AuthContext.tsx`, `src/api/systemConfig.ts`, `src/api/resetFirestoreToCrystal.ts`, `src/api/reassignCatalogToTenant.ts`, `src/screens/SettingsScreen.tsx`, `src/screens/SuperAdminDashboard.tsx`, `src/screens/FirstTimeDatabaseSetupScreen.tsx`.

---

## 2. Ανοιχτό πρόβλημα: `Missing or insufficient permissions`

- Στο **Super Admin**, π.χ. **Δημιουργία tenant**: alert **`Missing or insufficient permissions`** (άρνηση Firestore rules).
- Το UI μπορεί να δείχνει Super Admin, το write απορρίπτεται.

**Έλεγχοι:** deploy `firestore.rules` · `globals` με `superAdminEmails` + `superAdminUids` · `users/{uid}.email` ταιριάζει · ίδιο Firebase project στο app και Console.

**Ιδέες για συνέχεια:** Rules Playground / Cloud Function (Admin SDK) / callable για ευαίσθητες πράξεις.

---

## 3. Crystal reset — σημείωση

Μετά το crystal μένει το **Authentication**· καθαρίζει κυρίως **Firestore**. Ο οδηγός πρώτης ρύθμισης όταν λείπει `globals`.

---

*Git commit που είχε αναφορά σε ξεχωριστό doc: πλέον η πηγή αλήθειας για αυτή τη μέρα είναι μόνο αυτό το CHANGELOG.*
