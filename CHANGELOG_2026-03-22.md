# Changelog — 22 Μαρτίου 2026

Σύνοψη των αλλαγών (χάρτης, αναζήτηση, εγγραφή επαγγελματία, καθαρισμός mock/seed, UI).

---

## 1. Mock data & seed

- **Διαγράφηκε** το `scripts/seed-firestore.js` — δεν υπάρχει πλέον `npm run seed-firestore`.
- **`SEED_FIRESTORE.md`**: εξηγεί ότι παλιά δεδομένα στο Firebase **μένουν** μέχρι να διαγραφούν από Console (Auth + Firestore).
- **Admin / Settings (dev):** αφαιρέθηκαν οδηγίες seed — αναφορά σε εγγραφή μέσω της εφαρμογής.

---

## 2. Αναζήτηση (`SearchScreen`)

- Φίλτρα σε **Modal** (εικονίδιο φίλτρου στο header): επάγγελμα, πόλη, ακτίνα (5–50 km / όλα), ταξινόμηση τιμής, βαθμολογία 4★+, διαθέσιμοι σήμερα.
- **Απόσταση:** Haversine μεταξύ GPS χρήστη και `latitude` / `longitude` του επαγγελματία από Firestore.
- **`Location.Accuracy.BestForNavigation`** για τρέχουσα θέση.
- Κάρτες: πλήρης διεύθυνση (`formatProfessionalAddress`), compact layout, μεγαλύτερη γραμματοσειρά απόστασης.
- **`src/utils/proSearch.ts`**, **`src/constants/searchFilters.ts`**, **`FormSelect`**.

---

## 3. Λεπτομέρειες επαγγελματία (`ProfessionalDetailsScreen`)

- Ανάγνωση **συντεταγμένων από Firestore** (`getDoc`) για ενημερωμένο pin.
- **MapView** με `initialRegion`, zoom (π.χ. `latitudeDelta` 0.005), **Marker** στις πραγματικές συντεταγμένες.
- Placeholder avatar με **Lucide** όταν δεν υπάρχει φωτογραφία.

---

## 4. Εγγραφή επαγγελματία (`RegisterProfessionalScreen`)

- **«Επαλήθευση διεύθυνσης»:** `Location.geocodeAsync` μετά από οδό, αριθμό, ΤΚ, πόλη — **όχι** αυτόματο debounce geocode.
- Μετά το geocode: μετακίνηση χάρτη + pin· **drag** pin / tap χάρτη — τα **τελικά** `latitude` / `longitude` στην υποβολή είναι αυτά του pin.
- **Τύπος προφίλ:** Άνδρας / Γυναίκα / Εταιρεία → αποθήκευση **`profileDisplayType`** στο Firestore + preview avatar (Lucide) χωρίς φωτό.
- Διάταξη φόρμας: τύπος προφίλ & φωτό → διεύθυνση & επαλήθευση → χάρτης → λογαριασμός → επιχείρηση → υπηρεσία.
- Υποχρεωτικά: μεταξύ άλλων αριθμός οδού, ΤΚ.

---

## 5. Auth & Firestore (`AuthContext` + `types`)

- **`ProfessionalRegistrationData`:** `profileDisplayType`, `profileImageBase64` ως `null` αν δεν υπάρχει φωτό.
- **`signUpProfessional`:** αποθήκευση πεδίων (ΑΦΜ, επάγγελμα, website, bio, διεύθυνση, περιοχή, ΤΚ, πόλη, χώρα, coords, `availableToday: false`, κ.λπ.).
- **`location` (string):** μορφή `"Πόλη, Χώρα"`.
- **`src/api/types.ts`:** `ProfileDisplayType`, `profileDisplayType?` στο `Professional`.

---

## 6. Avatars & εικόνες

- **`src/assets/avatars.tsx`:** `profileDisplayType` → εικονίδιο· χωρίς παλιά seed-heuristics (emails mock).
- **`src/utils/imageUtils.ts`:** `hasDisplayableProfileImage`, απόρριψη κενού/1×1 placeholder base64.

---

## 7. Στατικό catalog (όχι mock χρήστες)

- **`src/constants/catalog.json`:** πόλεις (κέντρο χάρτη) + λίστα επαγγελμάτων για φόρμες.
- **`src/constants/data.ts`:** `matchCityFromGeocode`, κ.λπ. — αφαιρέθηκε αχρησιμοποίητο `offsetFromCity`.

---

## 8. Expo / native

- **`app.json`:** plugin **`expo-location`** με μήνυμα αδειών (iOS/Android prebuild).

---

## Αρχεία αναφοράς

| Αρχείο | Περιεχόμενο |
|--------|-------------|
| `SEED_FIRESTORE.md` | Seed αφαιρέθηκε · καθαρισμός Firebase χειροκίνητα |
| `CHANGELOG_2025-03-18.md` | Παλαιότερη σύνοψη project |
| `CHANGELOG_2026-03-23.md` | Συνέχεια: multi-tenant, Super Admin, Firestore |
| `CHANGELOG_2026-03-25.md` | Social-first αναζήτηση, catalog IDs, Admin διαχείριση επαγγελματιών |
| `README.md` | Εκκίνηση, scripts, links docs |

---

*Για push στο GitHub: `git add -A && git commit && git push` από το root του repo.*
