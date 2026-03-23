# Firestore, Super Admin & πρώτο setup — σημειώσεις συνεδρίας (Μάρτιος 2026)

Αυτό το αρχείο συνοψίζει τις αλλαγές γύρω από multi-tenant, Super Admin, πρώτο setup της βάσης και το **ανοιχτό σφάλμα** που εμφανίζεται ακόμα στην εφαρμογή.

---

## Τι υλοποιήθηκε (λειτουργικά)

- **`system_config/globals`**: `superAdminEmails` + **`superAdminUids`** (το JWT στο mobile συχνά δεν περιέχει `email`· το `uid` είναι πιο αξιόπιστο στα rules).
- **Πρώτο setup** (`FirstTimeDatabaseSetupScreen` / `completeFirstTimeDatabaseSetup`): δημιουργία globals, default tenant `tenant_default`, σύνδεση χρήστη ως superadmin, **`setDoc` με `merge`** στο `users/{uid}` ώστε να δουλεύει και μετά από wipe χωρίς έγγραφο χρήστη.
- **Μετά το setup**: **`reassignAllCitiesAndProfessionsToTenant`** — όλα τα έγγραφα σε `cities` και `professions` παίρνουν `tenantId: tenant_default`, ώστε να μην μένουν ορφανά `tenantId` μετά από crystal reset που κρατάει τους καταλόγους.
- **Crystal reset (Settings, μόνο Super Admin)**: διαγραφή `reviews`, `importedProfessionals`, `tenants`, `users`, `system_config` — **δεν** διαγράφονται οι βοηθητικοί πίνακες **`cities`** και **`professions`** (για να μπορεί νέα εγγραφή με dropdowns).
- **AuthContext**: διόρθωση ώστε αποτυχία `getDoc(users)` ή query tenant-admin να **μην μηδενίζει** το `systemGlobals` (αποφυγή μπερδέματος «wizard πρώτου setup» ενώ υπάρχει ήδη globals).
- **Firestore rules**: `isSuperAdmin()` με uid **ή** email στο token **ή** **`users/{uid}.email` ∈ `superAdminEmails`**· tenants με **`adminUid`** για ανάγνωση χωρίς token email· διαγραφή **`system_config`** επιτρεπτή για Super Admin (για το crystal).
- **Εγγραφή**: αποθήκευση **`email` normalized (lowercase)** στο `users` για ταιριάσματα queries/rules.
- **SuperAdminDashboard**: ενημέρωση globals με **`superAdminUids`** μέσω `buildGlobalsSuperAdminPayload`, δημιουργία tenant με **`adminUid`** όταν υπάρχει χρήστης με αυτό το email.

Κύρια σχετικά αρχεία: `firestore.rules`, `src/context/AuthContext.tsx`, `src/api/systemConfig.ts`, `src/api/resetFirestoreToCrystal.ts`, `src/api/reassignCatalogToTenant.ts`, `src/screens/SettingsScreen.tsx`, `src/screens/SuperAdminDashboard.tsx`, `src/screens/FirstTimeDatabaseSetupScreen.tsx`.

---

## Ανοιχτό πρόβλημα (όπως στην εφαρμογή)

### Συμπτώματα

- Στην οθόνη **Super Admin**, ενέργειες όπως **«Δημιουργία tenant»** (ή άλλα writes που απαιτούν `isSuperAdmin()`) εμφανίζουν alert:

  **`Missing or insufficient permissions`**

- Το UI μπορεί να δείχνει το email στη λίστα Super Admin, αλλά το **Firestore rules** απορρίπτει το request.

### Τι σημαίνει

Το μήνυμα είναι **άρνηση από Firestore Security Rules** (όχι bug του React Native UI κατά ανάγκη). Για να περάσει το `isSuperAdmin()`, πρέπει να ισχύει ένα από τα εγκεκριμένα κριτήρια στο **deployed** `firestore.rules` και τα **πραγματικά δεδομένα** στο project να ταιριάζουν (λίστες emails, `superAdminUids`, πεδίο `email` στο `users/{uid}`).

### Έλεγχοι πριν συνεχίσει κάποιος την αποσφαλμάτωση

1. **`firebase deploy --only firestore:rules`** (ή Publish από Console) — χωρίς deploy, το project τρέχει **παλιούς** κανόνες.
2. Στο Firestore, έγγραφο **`system_config/globals`**: υπάρχουν **`superAdminEmails`** (lowercase όπως στο Auth/app) και **`superAdminUids`** με το **User UID** από Authentication;
3. Στο **`users/{uid}`** του ίδιου λογαριασμού: υπάρχει πεδίο **`email`** ίδιο (κανονικοποιημένο) με την καταχώριση στη λίστα Super Admin;
4. Ίδιο **Firebase project** στο `GoogleService-Info.plist` / `google-services.json` / `firebaseConfig` με αυτό που βλέπεις στο Console.

### Πιθανές επόμενες κατευθύνσεις (για μελλοντικό pass)

- Επιβεβαίωση με **Firestore Rules Playground** ή προσωρινό log σε **Cloud Function** (Admin SDK) ότι το `request.auth` και τα `get()` στα rules συμπεριφέρονται όπως αναμένεται.
- Αν το πρόβλημα είναι **μόνο** σε συσκευή/build: έλεγχος ότι το **ID token** και το **Firestore instance** δείχνουν στο ίδιο project.
- Προαιρετικά: **callable function** μόνο για Super Admin που εκτελεί ευαίσθητες πράξεις (αν τα client-only rules συνεχίσουν να είναι εύθραυστα).

---

## Σημείωση για crystal reset

Μετά το crystal, ο χρήστης μένει συνδεδεμένος στο **Authentication**· εκκαθαρίζεται κυρίως το **Firestore**. Ο οδηγός πρώτης ρύθμισης εμφανίζεται όταν λείπει το `globals`.

---

*Τελευταία ενημέρωση κειμένου: 23 Μαρτίου 2026.*
