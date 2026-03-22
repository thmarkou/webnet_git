# Logo & εικονίδιο iPhone — τι ισχύει

## 1. Γιατί «δεν αλλάζει τίποτα»

### Α) Expo Go vs δική σου εφαρμογή

Αν ανοίγεις το project με την εφαρμογή **Expo Go** (το πορτοκαλί εικονίδιο από App Store):

- Στην **αρχική οθόνη του iPhone** θα βλέπεις **ΠΑΝΤΑ το εικονίδιο του Expo Go**, όχι το Webnet.
- Αυτό **δεν αλλάζει** με κανένα `icon.png` — έτσι λειτουργεί το Expo Go.

Για να δεις **το δικό σου εικονίδιο** στο iPhone:

```bash
cd /path/to/webnet_app   # root με package.json
npx expo run:ios
```

ή άνοιξε το **`ios/*.xcworkspace`** στο Xcode και κάνε Run (η εφαρμογή με bundle id `com.webnet.app`).

### Β) Νέο αρχείο λογότυπου

Το νέο σχέδιο πρέπει να μπει **στο project**:

1. Αντίγραψε το logo ως **`assets/webnet.jpeg`** (τετράγωνο, ιδανικά 1024×1024).
2. Τρέξε (macOS):

   ```bash
   npm run sync-brand-assets
   ```

   Αυτό ενημερώνει: `icon.png` (και οθόνη login), splash, favicon, Android foreground.

3. **Καθάρισε cache Metro** (αλλιώς μπορεί να φαίνεται παλιά εικόνα μέσα στην εφαρμογή):

   ```bash
   npx expo start --clear
   ```

4. **Για εικονίδιο στο Springboard (σπίτι iPhone):** το Xcode **δεν** διαβάζει το `assets/icon.png` απευθείας — χρησιμοποιεί αντίγραφο μέσα στο `ios/.../AppIcon.appiconset/`. Αν άλλαξες μόνο το `icon.png` και το login είναι σωστό αλλά το εικονίδιο παραμένει παλιό:

   ```bash
   npm run sync-ios-app-icon
   ```

   Μετά Xcode: **Product → Clean Build Folder**, σβήσε την εφαρμογή από το iPhone, **Run** ξανά.

   **Εναλλακτικά** (αν αλλάζεις πολλά native): `npx expo prebuild --platform ios --clean`, μετά `cd ios && pod install`, και ξανά build — ξαναγράφει όλο το φάκελο `ios/`.

---

## 2. Αρχεία

| Αρχείο | Χρήση |
|--------|--------|
| `assets/webnet.jpeg` | Προαιρετική πηγή για το script `sync-brand-assets` (Mac) |
| `assets/icon.png` | **Ένα αρχείο:** login/εγγραφή μέσα στην εφαρμογή + εικονίδιο iOS/Android (μετά από prebuild + build) |

Χωρίς **`webnet.jpeg`** το `npm run sync-brand-assets` **δεν τρέχει** — αντικατέστησε χειροκίνητα το **`assets/icon.png`** (και αν θες τα `splash-icon.png` / `android-icon-foreground.png` με το ίδιο artwork).
