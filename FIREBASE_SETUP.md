# Firebase Setup για webnet-db

Το project **webnet-db** υπάρχει. Ολοκλήρωσε τα παρακάτω βήματα στο Firebase Console.

---

## Βήμα 1: Ενεργοποίηση Authentication

1. Πήγαινε στο [Firebase Console](https://console.firebase.google.com) → project **webnet-db**
2. **Build** → **Authentication** → **Get started**
3. **Sign-in method** → **Email/Password** → Ενεργοποίηση → **Save**

---

## Βήμα 2: Δημιουργία Firestore Database

1. **Build** → **Firestore Database** → **Create database**
2. Επίλεξε **Start in test mode** (για ανάπτυξη) ή **Production mode** (για production)
3. Επίλεξε region (π.χ. **europe-west1**)
4. **Enable**

---

## Βήμα 3: Ενεργοποίηση Storage (προαιρετικό)

1. **Build** → **Storage** → **Get started**
2. Επίλεξε security rules (test ή production)
3. **Done**

---

## Βήμα 4: Λήψη Config και ενημέρωση κώδικα

1. **Project settings** (γρανάζι) → **General**
2. Κάτω στο **Your apps** → **Add app** → **Web** (εικονίδιο `</>`)
3. Όνομα app: `webnet_app` → **Register app**
4. Αντιγράψε τα πεδία και βάλ’ τα στο `src/api/firebaseConfig.ts`:

| Πεδίο στο Console | Αντικατάσταση στο firebaseConfig.ts |
|-------------------|-------------------------------------|
| `apiKey` | `apiKey: '...'` |
| `messagingSenderId` | `messagingSenderId: '...'` |
| `appId` | `appId: '...'` |

Τα `authDomain`, `projectId`, `storageBucket` είναι ήδη ρυθμισμένα για **webnet-db**.

---

## Έλεγχος

Μετά την ενημέρωση του `firebaseConfig.ts`, τρέξε:

```bash
npx expo start
```

Η εφαρμογή θα συνδέεται στο Firebase project **webnet-db**.
