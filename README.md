# Webnet App

Expo / React Native εφαρμογή (Firebase).

## Πού τρέχω τις εντολές

**Πάντα** από τον φάκελο που είναι το **root του repository** — εκεί που βρίσκονται `package.json`, `app.json`, `App.tsx`:

```bash
cd /path/to/webnet_git   # ή το clone σου
nvm use                  # προαιρετικά, βλ. .nvmrc
npm install
npx expo start
```

Μην τρέχεις `expo` από γονικό φάκελο χωρίς `expo` στο `package.json` — θα βλέπεις σφάλμα «expo is not installed».

## Scripts

| Εντολή | Σκοπός |
|--------|--------|
| `npm start` | Expo dev server |
| `npm run ios` / `android` | Native run |
| `npm run sync-brand-assets` | Από `assets/webnet.jpeg` → ενημέρωση icon/splash/favicon (macOS) |

## Logo & εικονίδιο iPhone

**Σημαντικό:** Με **Expo Go** το εικονίδιο στην αρχική οθόνη είναι πάντα του Expo — για δικό σου εικονίδιο χρειάζεται `npx expo run:ios` ή build από Xcode. Λεπτομέρειες: **`BRANDING.md`**.

## Docs

Βλ. `BRANDING.md`, `FIREBASE_SETUP.md`, `XCODE_SETUP.md`, `PASSWORD_UPDATE.md`, `SEED_FIRESTORE.md`.

**Changelog:** `CHANGELOG_2026-03-22.md` (τελευταία μεγάλη ενημέρωση, 22/3) · `CHANGELOG_2025-03-18.md` (αρχική σύνοψη).
