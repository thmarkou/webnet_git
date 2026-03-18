# Ενημέρωση κωδικών χρηστών (Firebase Auth)

## Βήματα

### 1. Λήψη Service Account Key

1. Πήγαινε στο [Firebase Console](https://console.firebase.google.com) → project **webnet-db**
2. **Project Settings** (γρανάζι) → **Service Accounts**
3. Κλικ **Generate new private key** → **Generate key**
4. Αποθήκευσε το αρχείο ως **`serviceAccountKey.json`** στο φάκελο `webnet_app` (δίπλα στο package.json)

### 2. Δημιουργία config

```bash
cp scripts/password-updates.config.example.json scripts/password-updates.config.json
```

Επεξεργάσου το `password-updates.config.json` με τα emails και τους νέους κωδικούς. (Το αρχείο είναι gitignored.)

### 3. Εκτέλεση script

```bash
npm run update-passwords
```

### 4. Ασφάλεια

- `serviceAccountKey.json` και `password-updates.config.json` είναι στο `.gitignore` — **δεν ανεβαίνουν στο GitHub**
- Μην μοιράζεσαι ποτέ αυτά τα αρχεία
