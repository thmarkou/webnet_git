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

## Docs

Βλ. `FIREBASE_SETUP.md`, `XCODE_SETUP.md`, `PASSWORD_UPDATE.md`, `CHANGELOG_2025-03-18.md`.
