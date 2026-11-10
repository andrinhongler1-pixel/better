# Foreground running tracker

Open TODAY → TRACK A RUN. START RUN requests browser location only after the explicit press. GPS must be fresh and report accuracy within 30m before a draft/timer is created. There is no Strava or external map connection. The route view is a locally drawn outline, not a street map. Browser geolocation requires HTTPS and location permission.

Active time, GPS distance and average pace are displayed. Pause/resume opens a new route segment; points across a pause are never connected or added to distance. Small drift and implausible jumps are filtered; distances remain approximate. The run records active time, not a medical/exercise estimate. FINISH & SAVE RUN saves a single durable record with the draft ID; repeated saves are idempotent. History opens saved route/metrics and supports confirmed deletion.

This version is explicitly foreground-only: keep RUNNING visible and the phone unlocked. Screen wake lock is requested where supported but may be released by iOS. Leaving the screen, hiding the app, losing usable GPS for 30 seconds or detecting a suspended heartbeat pauses recording. Resuming always requires an explicit press. It cannot reliably record locked-screen/background routes. No silent interpolation or automatic sleep/run starts occur.

Storage is isolated under `better:v1:running`, using existing AsyncStorage. No other feature key is modified. Web Locks serialize writes across same-origin windows. Draft owner leases prevent two windows recording the same run; stale windows can recover after 15 seconds. Persisted checkpoints are recovered after a crash/reload; elapsed time after the last known checkpoint is not fabricated. GPS points are capped at 12,000 per run, with a clear stop/save message rather than silently dropping points. Storage failures stop acquisition and retain the last successful checkpoint. Browser/PWA storage is device/context-local, not cloud sync.

No GPS coordinates, journal records or local QA state are included in the public release. The local-only `work/run-preview.py` injects synthetic GPS for QA and is excluded from publication. Tests use generic artificial coordinates near (0,0), not a person's route.

## Verification

TypeScript and all 48 tests passed locally, including six new running tests: geometry/pace, quality/freshness, drift/jump filtering, pause/resume segment separation, excluded pause time, durable/idempotent finish, ownership/stale recovery, failed writes/corruption, permission failure, stale GPS and cancellation before acquisition. Existing sleep, trading, import, nutrition, quitting and updater tests pass.

Browser QA with synthetic GPS at 390px: first usable fix starts recording; time/distance/pace/route update; pause freezes the timer; resume after a large simulated displacement does not add the gap; saved 51-second/~0.08km record survives reload and has two route paths; simulated denied permission creates no draft and leaves history intact. These are simulated desktop-browser checks, not a real iPhone running test. No physical iPhone is connected. Verify actual Safari/Home Screen location permission, outdoor fix quality, screen wake lock, device lock interruption and battery behavior on the user's device before claiming physical-device validation.
