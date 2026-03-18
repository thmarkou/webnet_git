# Media & Location Dependencies

## Install commands

```bash
npx expo install expo-image-picker react-native-maps expo-location
```

Or with npm:

```bash
npm install expo-image-picker react-native-maps expo-location
```

## Permissions

- **iOS:** `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription` (in app.json)
- **Android:** `ACCESS_FINE_LOCATION`, `READ_MEDIA_IMAGES` (in app.json)

## Notes

- After adding these packages, run `npx expo prebuild` again if using a development build.
- `react-native-maps` uses Apple Maps on iOS by default (no API key needed).
- For Google Maps on Android, add `googleMapsApiKey` in app.json plugins if needed.

## Firebase Storage Rules

For profile image uploads, ensure Firebase Storage rules allow authenticated writes:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profiles/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
