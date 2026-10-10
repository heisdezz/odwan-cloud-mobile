# UI and performance improvements

The implementation below is complete. Performance gains and gesture feel still need to be measured on a device. The app already uses FlashList, Reanimated, Expo Image, MMKV and SQLite; the next priorities are consistent controls and reducing unnecessary work.

## First batch

- [x] Give Photos and Gallery consistent compact headers and backup indicators.
- [x] Replace the bottom tab bar with a single floating action bar during selection.
- [x] Add drag-to-select with edge scrolling.
- [x] Remove JavaScript shared-value reads from the grid scroll callback.

## UI improvements

### Compact, consistent headers

Cloud, Device and Albums now use compact headers. Cloud and Device share the compact backup indicator so more media remains visible.

### One selection toolbar

During selection, the tab bar is replaced by one floating toolbar containing Done, the selected count, Select all, and the relevant Upload, Move or Delete actions. Keep its layout consistent across device media, local albums and server media. Icon actions should retain accessible labels and adequate touch targets.

### Faster selection

Long-press an item, then drag across other items to select a range. Starting from a selected item deselects the range; reversing the drag restores items outside it. Edge scrolling runs on the UI thread. Date navigation includes day and month selection. Server date selection explicitly applies to loaded media. Local albums now use per-cell selection subscriptions rather than updating the whole recycler on each selection change.

### Lightweight filter menu

All, Videos and Photos now appear in a small menu anchored to the filter button, without a dimmed screen. The current choice remains visible on the button.

### Clear navigation names

Tab labels now match their screens: Cloud, Device, Albums and Settings.

### Less intrusive timeline

The date label and scrubber become prominent during scrolling, then fade when idle. Date navigation remains available through a labeled button.

## Performance improvements

### Avoid JavaScript reads of scroll shared values

`GridZoom` now passes the visible index from its UI-thread reaction to `publishWindow`. The scroll callback no longer reads `scroll.value` on JavaScript. Row-boundary updates and per-cell visibility subscriptions are preserved.

Reanimated warns that JavaScript-thread shared-value reads can block while synchronizing with the UI thread: [Reanimated performance guidance](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/).

### Consolidate overlay dependencies

Removed the old sheet comparison and its Gorhom provider. Removed unused Buoy, Gorhom, Actions Sheet, react-native-zoom-grid and Jotai dependencies. The production upload sheet continues using Software Mansion's implementation with its existing fallback.

This can reduce dependency overhead and, where native modules are removed, the native footprint. It does not automatically improve scrolling FPS.

### Bound thumbnail storage

Settings now offers saved cache limits of 64, 128, 256 or 512 MB, defaulting to 128 MB. Automatic eviction removes the least recently used previews while protecting active generation, visible images and recently accessed files. Inspection and deletion yield in batches and wait during gallery interactions. Evicted previews regenerate on demand; inactive thumbnail queries do not retain deleted file paths.

### Measure before tuning

Profile filter changes, pinch release and uploads separately on a device using a release build produced by CI. Check React renders, JS/UI frame timing and memory to distinguish rendering work from image decoding or background activity. Change recycler settings only when measurements show a benefit.

## Added packages

| Package | Purpose | Priority |
| --- | --- | --- |
| [`expo-haptics`](https://docs.expo.dev/versions/v57.0.0/sdk/haptics/) | Subtle feedback when entering selection, committing grid density or completing an action. | Installed and used for selection, filtering and grid density changes |
| [`react-native-keyboard-controller`](https://docs.expo.dev/versions/v57.0.0/sdk/keyboard-controller/) | Coordinate keyboard movement and keep album-name and login inputs visible. | Installed and used for login, Settings and upload forms |

Install any chosen package through `bunx expo install` to resolve SDK-compatible versions. These packages improve interaction quality; neither is a general grid performance fix.

## Verification and remaining device checks

- `bun run lint` and `bun run typecheck` passed.
- `bun test` passed: 155 tests and 648 assertions. Tests cover range reversal, deselection, incomplete rows, date boundaries and protected cache eviction, alongside the existing app tests.
- No local APK compilation is used.
- [ ] Verify gestures and keyboard movement on a connected device using the CI build.
- [ ] Record release frame timing, React render counts and memory for filter switches, pinch release and concurrent uploads before tuning recycler settings further.

No Android device was connected during implementation, so no FPS improvement is claimed.
