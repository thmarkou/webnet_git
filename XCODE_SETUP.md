# Xcode Setup for iPhone 14 Pro Max

## Open the Project

1. Open **`ios/webnetapp.xcworkspace`** in Xcode (not the `.xcodeproj`).
   ```bash
   open ios/webnetapp.xcworkspace
   ```

2. Connect your iPhone 14 Pro Max via USB.

3. Select your device from the scheme dropdown (top toolbar).

4. Configure signing:
   - Select the **webnetapp** project in the navigator.
   - Select the **webnetapp** target.
   - Open **Signing & Capabilities**.
   - Enable **Automatically manage signing**.
   - Choose your **Team** (Apple Developer account).

5. Build and run: **⌘R** or Product → Run.

## Bundle Identifier

- **Bundle ID:** `com.webnet.app`
- Set in `app.json` and in the generated iOS project.

## Notes

- iPhone 14 Pro Max runs iOS 16+ and is fully supported.
- For physical device testing, you need an Apple Developer account (free or paid).
- Metro bundler must be running: `npx expo start` in a separate terminal before building from Xcode, or use **⌘R** which typically starts it automatically.
