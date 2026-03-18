# Changelog — 18 Μαρτίου 2025

Σύνοψη όλων των αλλαγών που έγιναν σήμερα στο webnet_app.

---

## 1. Δομή Project & Firebase

- **Φάκελοι:** `src/api`, `src/components`, `src/navigation`, `src/screens`, `src/context`, `src/hooks`
- **Firebase Config:** `src/api/firebaseConfig.ts` — Auth, Firestore, Storage
- **Schema Firestore:** Users, Professionals, Appointments, Reviews (`src/api/types.ts`)
- **Dependencies:** firebase, react-navigation, nativewind, lucide-react-native, tailwindcss

---

## 2. Εγγραφή Χρηστών & Επαγγελματιών

### Simple User
- Πεδία: Όνομα, Επώνυμο, Email, Τηλέφωνο (υποχρεωτικά), Επάγγελμα, Τοποθεσία, Κωδικός

### Professional
- Όλα τα πεδία: Όνομα, Επώνυμο, Email, Τηλέφωνο, Επωνυμία επιχείρησης, ΑΦΜ (9 ψηφία), Επάγγελμα, Ιστότοπος, Βιογραφικό, Διεύθυνση, Αριθμός, Περιοχή, ΤΚ, Πόλη, Χώρα
- Υπηρεσία: Όνομα, Περιγραφή, Διάρκεια, Τιμή
- Υποχρεωτικά: ΑΦΜ, Επωνυμία επιχείρησης, Διεύθυνση

---

## 3. Φωτογραφία Προφίλ (Base64)

- **expo-image-picker** για επιλογή φωτογραφίας
- **expo-image-manipulator** για resize 200×200 px και compression (0.6)
- Αποθήκευση στο πεδίο `profileImageBase64` στο Firestore (χωρίς Firebase Storage)
- Υποστήριξη και για `profileImage` (URL) για συμβατότητα

---

## 4. Χάρτης & Τοποθεσία

- **RegisterProfessionalScreen:** MapView με `react-native-maps`
- **Draggable pin** — σύρσιμο για αλλαγή θέσης
- Κουμπί **«Τρέχουσα τοποθεσία»** με `expo-location`
- Tap στον χάρτη για τοποθέτηση pin
- Αποθήκευση `latitude` και `longitude` στο Firestore

---

## 5. Navigation

- **MainTabNavigator** με διαφορετικά tabs ανά role:
  - **User:** Αναζήτηση, Φίλοι, Ραντεβού, Ρυθμίσεις
  - **Professional:** Το Προφίλ μου, Τα Ραντεβού μου, Πελάτες, Ρυθμίσεις
- **SearchStack:** SearchScreen → ProfessionalDetailsScreen

---

## 6. SearchScreen

- Λίστα επαγγελματιών από Firestore
- Φίλτρα: Επάγγελμα, Πόλη
- **Απόσταση** με Haversine (π.χ. "1.5 km away", "500 m away")
- Εμφάνιση φωτογραφίας προφίλ (Base64 ή URL)
- Tap → ProfessionalDetailsScreen

---

## 7. ProfessionalDetailsScreen

- Προφίλ με φωτογραφία, bio, υπηρεσίες
- **Στατικός χάρτης** με τη θέση του επαγγελματία
- Κουμπί «Άνοιγμα στο Χάρτη» (Google Maps)
- **Contact Modal:** Κάλεσμα, Email, Chat (placeholder)

---

## 8. Forgot Password

- Κουμπί «Ξέχασες τον κωδικό;» στην οθόνα σύνδεσης
- Modal για εισαγωγή email
- `sendPasswordResetEmail` από Firebase Auth

---

## 9. Remember Email (αυτόματη συμπλήρωση)

- Αποθήκευση του τελευταίου email μετά από επιτυχημένο login (AsyncStorage)
- Προσυμπλήρωση του πεδίου email κάθε φορά που ανοίγει η οθόνα σύνδεσης
- Αρχείο: `src/utils/lastEmail.ts` — `getLastEmail()`, `setLastEmail()`
- Dependency: `@react-native-async-storage/async-storage`

---

## 10. Project Setup

- **.nvmrc** — Node v20.19.4
- **.cursorrules** — local dependencies, webnet_app structure
- **clean-install** script — διαγραφή node_modules και επανεγκατάσταση
- **app.json** — Bundle ID `com.webnet.app`, iOS permissions
- **XCODE_SETUP.md** — οδηγίες για Xcode και iPhone 14 Pro Max

---

## 11. Βοηθητικά Αρχεία

| Αρχείο | Σκοπός |
|--------|--------|
| `src/utils/haversine.ts` | Υπολογισμός απόστασης (km) |
| `src/utils/imageUtils.ts` | `getProfileImageUri()` για Base64/URL |
| `src/utils/lastEmail.ts` | Αποθήκευση/φόρτωση τελευταίου email για login |
| `DEPENDENCIES_MEDIA.md` | expo-image-picker, react-native-maps, expo-location |
| `PASSWORD_UPDATE.md` | Οδηγίες ενημέρωσης κωδικών με Firebase Admin |

---

## 12. Firebase Project

- **Project:** webnet-db (webnet-db-4c78f)
- **Collections:** users (με role 'user' ή 'pro')
- **Storage:** προαιρετικό (χρησιμοποιούμε Base64 για φωτογραφίες)
