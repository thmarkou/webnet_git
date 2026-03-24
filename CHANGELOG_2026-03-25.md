# Changelog — 25 Μαρτίου 2026

Σύνοψη αλλαγών: **social-first αναζήτηση** (φίλοι + κριτικές), φίλτρα με **IDs καταλόγου** (`professionId` / `cityId`), κατάταξη βαθμολογίας/απόστασης, νέα οθόνη αναζήτησης & κάρτα αποτελεσμάτων, διαχείριση επαγγελματιών από Admin, διορθώσεις TypeScript / `useFirestoreCatalog`.

---

## 1. Αναζήτηση επαγγελματιών — social-first (`SearchProfessionalsScreen`)

- **Φίλοι:** χρήση του πεδίου **`users/{uid}.friends`** (array UID φίλων).
- **Κριτικές:** queries στη συλλογή **`reviews`** με **`where('userId', 'in', …)`** (chunks ≤ 10 για όριο Firestore)· αν φίλος έχει αξιολογήσει επαγγελματία (π.χ. ≥1★), ο επαγγελματίας **ανεβαίνει στην κορυφή** της λίστας.
- **Κατάταξη:** (1) με κριτική φίλου, (2) **υψηλότερη μέση βαθμολογία** (και δευτερεύοντα tie-break), (3) **εγγύτητα** (Haversine: συντεταγμένες επαγγελματία ή κέντρο πόλης από catalog).
- **UI:** κάρτα αποτελεσμάτων με ετικέτα τύπου **«Χρησιμοποιήθηκε από φίλο σου · [Όνομα]»** (`ProfessionalSearchResultCard` + `friendUsedByLabel`).
- **Tenant:** φόρτωση επαγγελματιών μέσω **`usersProsQuery` / `withTenantScope`** όπου εφαρμόζεται.

---

## 2. Συνέπεια καταλόγου — IDs αντί για μόνο κείμενο

- **`src/utils/catalogSearchIds.ts`:** κανονικοποίηση κλειδιών, **`proMatchesProfessionFilter`**, **`proMatchesCityFilter`**, fallback σε παλιά πεδία κειμένου (`profession`, `city`) όταν λείπουν IDs.
- **`src/constants/data.ts`:** `CityOption` με προαιρετικό **`firestoreId`** για σύνδεση με έγγραφα `cities/{id}`.
- **`src/api/types.ts`:** προαιρετικά **`professionId`**, **`cityId`** (και σχετικά πεδία χρήστη/επαγγελματία όπου ενημερώθηκαν).
- **`useFirestoreCatalog`:** επιστρέφει **`professionCatalog: { id, name }[]`** πέρα από `professions` (ονόματα)· πόλεις με **`firestoreId`** από Firestore.
- **Εγγραφή επαγγελματία / Admin προσθήκη:** επιλογή πόλης & επαγγέλματος με **doc id** από Firestore catalog.

---

## 3. Βοηθητικά & πλοήγηση

- **`src/utils/cityCatalogCoords.ts`:** συντεταγμένες για ranking / χάρτη από catalog & προφίλ.
- **`SearchStack`:** root οθόνη **`SearchProfessionalsScreen`** (αντί παλιάς λίστας αναζήτησης στο ίδιο stack, ανάλογα με προηγούμενη δομή).
- **`MainNavigator`**, **`SearchScreen` / φίλτρα:** ευθυγράμμιση με νέα ροή αναζήτησης όπου τροποποιήθηκε.
- **`AdminManageProfessionalsScreen`**, **`navigateToAdminManageProfessionals`:** διαχείριση λίστας επαγγελματιών από Admin dashboard / ρυθμίσεις.
- **`scripts/backfill-user-tenantid.js`:** βοηθητικό script (backfill `tenantId` σε χρήστες — για συντήρηση δεδομένων).

---

## 4. Λοιπές τροποποιήσεις (ενδεικτικά)

- **`AuthContext`**, **`importedProfessional`**, **`servicePricing`**, **`searchFilters`**, **`resetFirestoreToCrystal`**, **`userDocument`**, **`package.json`:** υποστήριξη νέων πεδίων, τιμολόγησης σε κάρτες, crystal reset, κ.λπ. όπου άλλαξαν στο branch.
- **Lucide `Map` → `MapIcon`** στο `SearchProfessionalsScreen` ώστε να μη σκιάζει το **`Map`** της JavaScript (runtime bug με `new Map()`).
- **`ProfCatalogRow`** στο `AdminAddProfessionalScreen`· τύποι **`CatalogProfession`** σε callbacks — **`tsc --noEmit` καθαρό**.

---

## Αρχεία (ενδεικτικά)

| Περιοχή | Αρχεία |
|--------|--------|
| Νέα | `SearchProfessionalsScreen.tsx`, `ProfessionalSearchResultCard.tsx`, `catalogSearchIds.ts`, `cityCatalogCoords.ts`, `AdminManageProfessionalsScreen.tsx`, `navigateToAdminManageProfessionals.ts`, `scripts/backfill-user-tenantid.js` |
| Τροποποιήσεις | `useFirestoreCatalog.ts`, `SearchStack.tsx`, `MainNavigator.tsx`, `RegisterProfessionalScreen.tsx`, `AdminAddProfessionalScreen.tsx`, `AuthContext.tsx`, `types.ts`, `data.ts`, … |

---

_Τελευταία ενημέρωση: 25 Μαρτίου 2026._
