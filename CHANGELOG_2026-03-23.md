# Changelog — 23 Μαρτίου 2026

Συνέχεια από `CHANGELOG_2026-03-22.md`: multi-tenant, Super Admin, πρώτο setup Firestore, crystal reset, rules.

---

## 1. Τι υλοποιήθηκε

- **`system_config/globals`**: `superAdminEmails` + **`superAdminUids`** (JWT στο mobile συχνά χωρίς `email`· το `uid` στα rules).
- **Πρώτο setup** (`FirstTimeDatabaseSetupScreen` / `completeFirstTimeDatabaseSetup`): globals, tenant `tenant_default`, superadmin, **`setDoc` με `merge`** στο `users/{uid}`.
- **`reassignAllCitiesAndProfessionsToTenant`**: μετά το setup, όλα τα `cities` / `professions` παίρνουν `tenantId: tenant_default`.
- **Crystal reset (Settings, Super Admin)**: σβήνει `reviews`, `importedProfessionals`, `tenants`, `users`, `system_config` — **όχι** `cities` / `professions`.
- **AuthContext**: αποτυχία `getDoc(users)` ή tenant-admin query να **μην μηδενίζει** `systemGlobals`.
- **`firestore.rules`**: `isSuperAdmin()` = uid **ή** email στο token **ή** `users/{uid}.email` ∈ `superAdminEmails`· tenants με **`adminUid`**· διαγραφή `system_config` για Super Admin.
- **Εγγραφή**: `email` normalized (lowercase) στο `users`.
- **Self-update `users`**: κλείδωμα αλλαγής `email` για ασφάλεια.
- **SuperAdminDashboard**: `buildGlobalsSuperAdminPayload`, tenant με **`adminUid`** όταν υπάρχει χρήστης με το admin email.

**Κύρια αρχεία:** `firestore.rules`, `src/context/AuthContext.tsx`, `src/api/systemConfig.ts`, `src/api/resetFirestoreToCrystal.ts`, `src/api/reassignCatalogToTenant.ts`, `src/screens/SettingsScreen.tsx`, `src/screens/SuperAdminDashboard.tsx`, `src/screens/FirstTimeDatabaseSetupScreen.tsx`.

---

## 2. Ανοιχτό πρόβλημα: `Missing or insufficient permissions`

- Στο **Super Admin**, π.χ. **Δημιουργία tenant**: alert **`Missing or insufficient permissions`** (άρνηση Firestore rules).

**Έλεγχοι:** deploy `firestore.rules` · `globals` με `superAdminEmails` + `superAdminUids` · `users/{uid}.email` ταιριάζει · ίδιο Firebase project στο app και Console.

**Ιδέες:** Rules Playground / Cloud Function (Admin SDK) / callable για ευαίσθητες πράξεις.

---

## 3. Crystal reset — σημείωση

Μετά το crystal μένει το **Authentication**· καθαρίζει κυρίως **Firestore**. Ο οδηγός πρώτης ρύθμισης όταν λείπει `globals`.

---

## Αρχεία αναφοράς

| Αρχείο | Περιεχόμενο |
|--------|-------------|
| `CHANGELOG_2026-03-22.md` | Χάρτης, αναζήτηση, εγγραφή επαγγελματία (22/3) |
| `CHANGELOG_2025-03-18.md` | Παλαιότερη σύνοψη project |
| `README.md` | Εκκίνηση, scripts |

---

*Για push: `git add -A && git commit && git push` από το root του repo.*
