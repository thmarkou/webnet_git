# Changelog — 7 Απριλίου 2026

Σύνοψη αλλαγών: επικοινωνία & ειδοποιήσεις, Firestore rules, Super Admin Insights, iOS/Pods (expo-font).

---

## 1. Επικοινωνία & ειδοποιήσεις

- **Firestore:** συλλογή `chats` (chatId = `userId_professionalId`), υποσυλλογή `messages`· ειδοποιήσεις σε `users/{uid}/notifications`.
- **API:** `src/api/chats.ts`, `notifications.ts`, `appointmentRequests.ts`· ενημέρωση `friendRequests.ts` για ειδοποίηση νέου αιτήματος φιλίας.
- **Οθόνες:** `ChatScreen`, `NotificationsScreen` (φίλτρα Όλα / Μη αναγνωσμένα / Αναγνωσμένα), `CommunicationModal` (κλήση, email, συνομιλία).
- **Πλοήγηση:** `Chat` στο `MainNavigator`, `navigateToChat.ts`.
- **Ραντεβού:** αίτημα χρήστη → ειδοποίηση επαγγελματία· επιβεβαίωση/απόρριψη → ενημέρωση κατάστασης και ειδοποίηση χρήστη· `MyAppointmentsScreen` (pro), `ProfessionalDetailsScreen` / `AppointmentsScreen` (user, real-time λίστα).

---

## 2. Firestore security rules

- **`firestore.rules`:** αυστηροί κανόνες για `chats`, `chats/{id}/messages`, `users/{uid}/notifications`· αφαιρέθηκε το χαλαρό `match /{document=**}`· ρητές συλλογές για υπόλοιπα (signed-in).
- **`firestore.indexes.json`:** σύνθετο index `appointments` (`proId` + `status`) για pending ραντεβού επαγγελματία.

---

## 3. Super Admin — Global Statistics (Insights)

- **`src/api/superAdminAnalytics.ts`:** συγκεντρωτικά στατιστικά (χρήστες/pro, φιλίες, ραντεβού, κριτικές, 7 ημέρες, top επαγγέλματα/πόλεις, Pro συνδρομές placeholder).
- **`src/components/SuperAdminGlobalStatistics.tsx`:** UI με `MaterialCommunityIcons`, πλέγμα καρτών, κουμπί ανανέωσης.
- **`SuperAdminDashboard`:** tab **Insights** (μόνο για `role: superadmin` στο προφίλ Firestore).

---

## 4. Expo / iOS / npm

- **`expo-font`** ως άμεση εξάρτηση (SDK 55, συμβατότητα με `@expo/vector-icons`).
- **`scripts/ensure-expo-font-symlink.js` + `postinstall`:** symlink `expo/node_modules/expo-font` → `expo-font` ώστε να μην σπάει το CocoaPods path.
- **`npm run pod:install`:** `cd ios && pod install`.

---

## 5. Λοιπά

- **`User`:** προαιρετικό `createdAt` για analytics νέων εγγραφών.
- **`MainTabNavigator`:** tab ειδοποιήσεων (χρήστης & επαγγελματίας όπου εφαρμόζεται).
- Διορθώσεις TypeScript (`navigateToChat`, `ProfessionalDetailsScreen`).

---

## Αρχεία αναφοράς

| Αρχείο | Περιεχόμενο |
|--------|-------------|
| `CHANGELOG_2026-03-22.md` | Changelog 22 Μαρτίου 2026 |
| `CHANGELOG_2026-04-07.md` | **Αυτό το αρχείο** — 7 Απριλίου 2026 |

---

*Αρχεία `ios/Pods` / `Podfile.lock`: ανανεώνονται με `npm run pod:install` μετά από `npm install`.*

---

## 6. Script κλωνοποίησης χρήστη (μετά το 7/4)

- **`scripts/clone-user-from-email.js`** + **`npm run clone-user`**: αντιγραφή προφίλ Firestore από `theofanis.markou@gmail.com` → νέο Auth + `users/{uid}` (κενά friends/pending/favorites). Απαιτεί `serviceAccountKey.json`.
- **Σημείωση Firebase:** κωδικός ελάχιστο 6 χαρακτήρες — το `1234` δεν γίνεται δεκτό· χρησιμοποιήθηκε `123456` (ή `NEW_USER_PASSWORD=...`).
