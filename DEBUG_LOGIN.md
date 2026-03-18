# Debug Login (Development Only)

The Login screen shows two debug buttons **only when running in development mode** (`__DEV__ === true`).

## Test Accounts

| Button | Email | Role |
|--------|-------|------|
| Login as Test User | theofanis.markou@gmail.com | Simple User |
| Login as Test Pro | fanis.markou@resilienceguard.ch | Professional |

## Setup

1. Create these accounts in Firebase Authentication (or use existing ones).
2. Set the password to **`Test1234!`** for both accounts.
3. Ensure Firestore has user documents for each:
   - **Test User:** `users/{uid}` with `role: 'user'`
   - **Test Pro:** `users/{uid}` with `role: 'pro'` and professional fields

## Changing the Password

Edit `src/screens/Auth/LoginScreen.tsx` and update `DEBUG_TEST_PASSWORD`.

## Production

Debug buttons are **not shown** in production builds (`__DEV__` is false).
