# Changelog — 24 Μαρτίου 2026

Σύνοψη αλλαγών: Super Admin / Admin UX, πολυ-tenant catalog, εμφάνιση επαγγελμάτων, οθόνη προσθήκης επαγγελματία από διαχειριστή, Firestore rules.

---

## 1. Super Admin (`SuperAdminDashboard`)

- Αναδιπλούμενη κάρτα **«Τι να κάνω τώρα; (βήμα-βήμα)»**: tenant, merge catalog ανά καρτέλα, Admin Dashboard, ανάθεση χρηστών, διαχείριση Super Admins.
- Έμφαση όταν **δεν υπάρχουν tenants** (κίτρινη κάρτα + οδηγίες).
- Ενημέρωση κειμένου οδηγού: ξεχωριστό κουμπί merge για πόλεις και για επαγγέλματα.

---

## 2. Admin Dashboard (`AdminDashboardScreen`)

- **Merge catalog:** δύο ξεχωριστές ροές — μόνο **πόλεις** στην καρτέλα Cities, μόνο **επαγγέλματα** στην καρτέλα Professions (δεν ενημερώνει πλάθος το άλλο σύνολο κατά λάθος).
- Κάρτα **«Βοήθεια (πολύ απλά βήματα)»** στην κορυφή.
- Επαγγέλματα: αφαίρεση στήλης/πεδίου **εικονιδίου** στο UI· αποθήκευση εγγραφών ως `{ name, tenantId }` στο merge.
- Λίστες πόλεων/επαγγελμάτων, autocomplete, χάρτης πόλης, Excel import (υπάρχουσα λειτουργία) — συνεχίζουν να λειτουργούν στο ίδιο πλαίσιο.

---

## 3. Επαγγέλματα στο UI (χωρίς εικονίδια)

- Αφαίρεση **`ProfessionCatalogIcon`** και κάθε εμφάνισης εικονιδίων στις λίστες επαγγέλματος.
- **`catalog.json` / `data.ts`:** επαγγέλματα ως απλή λίστα strings.
- **`professionDisplay.ts`:** μετάφραση/ανθρωποαναγνώσιμες ετικέτες για κλειδιά τύπου `data.professions.plumber` (regex για διάφορα patterns)· **χωρίς** `iconKey` στο αποτέλεσμα.
- **`FormSelect`:** προαιρετικό **`getOptionLabel`** για εμφάνιση διαφορετική από την αποθηκευμένη τιμή.
- **`useFirestoreCatalog`:** επιστρέφει `cities`, `cityLabels`, `professions` (χωρίς `professionMeta`).
- **Εγγραφή χρήστη / επαγγελματία, αναζήτηση:** `getOptionLabel` από `professionDisplayForStored`· στις κάρτες αναζήτησης εμφανίζεται η ετικέτα επαγγέλματος.

---

## 4. Προσθήκη επαγγελματία από διαχειριστή

- Νέα οθόνη **`AdminAddProfessionalScreen`** (stack `AdminAddProfessional` στο **`MainNavigator`**).
- **Ρυθμίσεις:** κουμπί «Προσθήκη επαγγελματία (χωρίς νέο login)» για όσους έχουν `canAccessAdminDashboard`.
- Πεδία **ισοδύναμα** με την εγγραφή επαγγελματία: τύπος προφίλ, φωτό, διεύθυνση + χάρτης + geocode, όνομα/επώνυμο, email (προαιρετικό), τηλέφωνο, επιχείρηση, ΑΦΜ, ιστότοπος, βιο, υπηρεσία/τιμολόγηση, banner trial 30 ημερών.
- **Πόλη & επάγγελμα** μόνο από Firestore (`cities` / `professions`) με φίλτρο **`tenantId`**· **`SearchableSelect`** (combobox με αναζήτηση).
- **`AuthContext`:** `createProfessionalRecordAsAdmin` — `setDoc` σε νέο `users/{autoId}` με `role: 'pro'`, πλήρες `Professional`, **`tenantId`**, **χωρίς** `createUserWithEmailAndPassword` (η σύνδεση διαχειριστή δεν αλλάζει).
- Τύπος **`AdminProfessionalEntryInput`:** `Omit<ProfessionalRegistrationData, 'password'> & { tenantId: string }`.
- **`phoneValidation.ts`**, **`navigateToAdminAddProfessional.ts`**.

---

## 5. Firestore rules (`firestore.rules`)

- Ενημέρωση rules (bootstrap / signed-in writes). **Προσοχή:** οι κανόνες είναι χαλαροί για ανάπτυξη — σφίξτε πριν production.

---

## Αρχεία (ενδεικτικά)

| Περιοχή | Αρχεία |
|--------|--------|
| Νέα | `SearchableSelect.tsx`, `AdminAddProfessionalScreen.tsx`, `navigateToAdminAddProfessional.ts`, `phoneValidation.ts`, `professionDisplay.ts` |
| Διαγραφή | `ProfessionCatalogIcon.tsx` (αν υπήρχε στο repo) |
| Τροποποιήσεις | `AuthContext.tsx`, `AdminDashboardScreen.tsx`, `SuperAdminDashboard.tsx`, `MainNavigator.tsx`, `SettingsScreen.tsx`, `FormSelect.tsx`, `useFirestoreCatalog.ts`, `RegisterProfessionalScreen.tsx`, `RegisterUserScreen.tsx`, `SearchScreen.tsx`, `firestore.rules`, `catalog.json`, `data.ts` (όπου εφαρμόστηκαν) |

---

_Τελευταία ενημέρωση: 24 Μαρτίου 2026._
