# Odwan

A mobile photo and video gallery with backups to your own cloud server. Browse device media, organize cloud albums, and track which originals have been backed up.

Built with Expo SDK 57, React Native, and Expo Router. Android is the primary target; device-gallery features also have iOS implementations, while web supports cloud browsing with platform fallbacks.

**Backend:** [odwan-cloud-backend](https://github.com/heisdezz/odwan-cloud-backend) · **API integration guide:** [BACKEND.MD](BACKEND.MD)

## Features

- **Device gallery:** a persistent SQLite media index, device albums, photo/video filters, and incremental library updates after the initial scan.
- **Cloud library:** authenticated media browsing, albums, search and sorting for albums, and server-generated thumbnails.
- **Grid controls:** pinch between 2–6 columns, a focused-tile zoom preview, saved grid density, and date navigation.
- **Selection:** hold and drag to select ranges, scroll near the edges, then upload local items or manage cloud items through a floating toolbar.
- **Media viewer:** swipe between items, zoom photos, seek videos, change playback speed, favorite items locally, and share originals.
- **Uploads:** a persistent sequential queue, destination album selection or creation, progress reporting, retry controls, and separate upload history.
- **Trash:** restore cloud items within 30 days or permanently delete them when the connected backend supports recoverable trash.
- **Appearance:** system, light, and dark modes; dynamic Material colors on supported Android devices.
- **First-launch welcome:** start with the device gallery or connect a server. Reopen the guide through Settings → Getting started.

## Get started

Install [Bun](https://bun.sh), then install the locked dependencies:

```sh
bun install --frozen-lockfile
```

Install a development APK from GitHub Actions and start Metro:

```sh
bunx expo start --dev-client
```

Open the installed app and connect it to the development server. The phone and computer need to be able to reach each other over the network.

A development build is needed to exercise the full native feature set. Expo Go can preview parts of the interface, but Android gallery access and several custom native modules require the installed APK. Adding or changing native dependencies requires a new native build.

For web development:

```sh
bun run web
```

### Connect your backend

1. Deploy or run [odwan-cloud-backend](https://github.com/heisdezz/odwan-cloud-backend).
2. In Settings, enter its base URL and select **Test connection**. The app checks `GET /api/test/connection` for an `ok` response.
3. Log in with a PocketBase **superuser** account. Authentication currently uses `_superusers`.
4. To upload, enter the server's separate upload token in the destination sheet. The current upload contract uses `POST /api/test/s3/upload` and requires the backend's test routes to be enabled.

Use HTTPS for a deployed server. For LAN testing, bind the backend to a reachable interface such as `0.0.0.0:8090` and enter `http://<computer-LAN-IP>:8090`. `localhost` on a phone refers to the phone itself. The Android configuration permits cleartext HTTP for local testing.

Server URLs and preferences persist across launches. Login tokens and upload tokens are saved per normalized server URL in encrypted MMKV on supported native builds; SecureStore holds the encryption key. Passwords are never persisted. Saved login sessions are validated in the background, and logging out removes the selected server's saved session.

## Using the gallery and backups

Open **Device** to grant media access and start the initial library scan. Later launches read the saved index while checking for updates. Refocusing the app with full permission does not start another full scan; use Refresh when a complete reconciliation is needed.

Open a device album or the main device gallery, hold an item, and select the media to upload. Choose an existing cloud album, Unsorted, the device album's name, or a new name. Album matching ignores case and reuses an existing destination when possible.

Uploads run one at a time. The queue reports preparation, bytes sent, backend confirmation, and album assignment separately. Reaching 100% sent means the request body has been transferred; the backend may still be saving the file. A failed album assignment retries without uploading the original again.

Settings provides **Current uploads**, **Uploaded**, and **Trash**. Upload history is separate from the active queue. Backup status is tied to the server, account, device asset, and modification time, so an edited original is not treated as already backed up.

### Background behavior

A rebuilt Android app uses a foreground data-sync service with a persistent upload notification. Start uploads while the app is visible and allow notification permission when requested. The notification opens Current uploads and shows progress for the active transfer.

Without that native service, uploads run while the app is active. Pending work survives relaunches and resumes after restoring the same account. Force-stop, process termination, battery restrictions, and Android's foreground-service time limits can interrupt a transfer; interrupted jobs retain their object key for retry.

The device-library scan is idle-paced native I/O coordinated by the app, rather than a service that runs after termination.

## Performance and storage

FlashList virtualizes the grid while the device library's complete metadata index stays in SQLite. Thumbnail work is limited to the visible window and a small buffer. New work pauses during scrolling and pinching; queued work for offscreen items can be skipped.

Supported Android builds generate local previews through the app's `OdwanMedia` native module on I/O workers. Other supported runtimes use Expo fallbacks. Cloud previews come from the backend through PocketBase file URLs or the backend thumbnail endpoint; cloud originals are not downloaded to generate previews.

JPEG previews persist across launches. Settings offers cache budgets of **64, 128, 256, or 512 MB**, defaulting to **128 MB**, with automatic eviction that protects active and recently used previews. Clearing this cache preserves originals, backup records, and upload history. The displayed cache size excludes shared exports and other OS-managed caches.

MMKV stores preferences, while SQLite stores the gallery index, album snapshots, backup state, upload queue, and history. Expo Go and older native builds use the available storage fallbacks. Web uses localStorage for preferences and sessionStorage for login tokens.

## Android builds

GitHub Actions builds APKs directly with Expo prebuild and Gradle. **EAS credentials, `EXPO_TOKEN`, and `EXPO_PROJECT_ID` are not required.**

| Branch | Workflow | Output | Artifact retention |
| --- | --- | --- | --- |
| `dev` | [Android debug APK](.github/workflows/debug-apk.yml) | Development-client APK; needs Metro | 7 days |
| `main` | [Android release APK](.github/workflows/release-apk.yml) | Standalone optimized APK | 14 days |

Both workflows also support manual runs. Download the APK from the workflow run's **Artifacts** section.

Builds target **arm64-v8a only** and use cached Bun downloads, enhanced Gradle caching, and the Gradle build cache. Release builds enable R8/ProGuard, resource shrinking, PNG crunching, bundle compression, and compressed native library packaging. The release workflow checks signing, ARM64 architecture, non-debuggable mode, and R8 mapping output.

Release APKs use an automatically generated debug signing key retained in a dedicated Actions cache. They are intended for direct testing. If that cache is lost, a new key may require uninstalling the previous APK. Store distribution requires a persistent production signing key.

The application ID is `com.heisdezz.odwan`. Native `android/` and `ios/` projects are generated; configure native behavior in [app.json](app.json), config plugins, and local modules.

## Development

```sh
bun run lint
bun run typecheck
bun test
```

Optional PocketBase type generation uses local configuration from [.env.example](.env.example):

```sh
bun run typegen
```

Keep credentials out of committed files. The test suite uses mocks, temporary databases, and storage stubs rather than live uploads or deletion operations.

### Project layout

| Path | Purpose |
| --- | --- |
| `src/app/` | Expo Router screens and layouts |
| `src/components/` | Gallery, albums, viewer, upload sheets, and shared controls |
| `src/hooks/` | Queries and platform-aware hooks |
| `src/providers/` | Theme, session, media viewer, gallery sync, and upload lifecycle |
| `src/stores/` | Zustand state and persisted preferences |
| `src/db/` | SQLite schema and local persistence |
| `src/lib/`, `src/helpers/` | Platform adapters, API clients, and shared logic |
| `modules/`, `plugins/` | Local native modules and Expo config plugins |
| `tests/` | Regression tests |

Use **twrnc** for app-owned layout and styling, and `useTheme()` for semantic colors. Shared `Button`, `Input`, `Switch`, and `Checkbox` controls live in `@/components/ui`: Android uses Expo UI Material controls, with React Native fallbacks for iOS and web. Production bottom sheets use `@swmansion/react-native-bottom-sheet` with a modal fallback when the native module is unavailable.

The main stack includes TanStack Query for server state, Zustand for app state, FlashList for recycling, Reanimated and Gesture Handler for interactions, `expo-image` and `expo-video` for media, and sonner-native for feedback.
