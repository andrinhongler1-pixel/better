# Sleep ritual

The SLEEP tab replaces the PROGRESS navigation slot. The original progress route and all unrelated data remain present. Sleep uses only `better:v1:sleep` (version 1): a revision, active session or null, completed sessions, and goal in minutes. Completed sessions contain ID, start/wake timestamps, elapsed duration, creation and modification timestamps. AWAKE/SLEEPING derive from the active session; there is no time-of-day scheduler.

Fresh launch/foreground: AWAKE shows dismissible SLEEP; SLEEPING shows WAKE UP. GO TO SLEEP persists a start only on explicit press; the immediately following screen is REST WELL. Closing the app records nothing. WAKE UP atomically completes the same ID, clears active state and shows the actual morning summary. START YOUR DAY opens TODAY with the existing subtle transition. Starting by mistake can be cancelled without creating a completed record.

All writes reread storage under a same-origin Web Lock on supported HTTPS browsers (Safari/iOS 15.4+), or a process queue on native. Storage events/pageshow/foreground refresh other tabs. Duplicate starts reuse the active ID; duplicate wakes return the existing completed ID. Revision guards reject stale start/edit/delete operations. Unsupported browser coordination fails closed for sleep while other app features remain accessible. Safari and a Home Screen installation may have separate storage; this feature is not cloud sync.

Durations subtract epoch timestamps, so midnight and DST are handled without wall-clock assumptions. Clock rollback is rejected; start correction or cancellation remains available. Corrections expose date/time and the per-end UTC offset to distinguish repeated DST hours. Future wake times and overlapping corrected sessions are rejected. No medical sleep inference is made.

Average uses the seven most recent completed sessions, including short ones; weekly chart sums completed durations by local wake date. Empty days are not zero-length fabricated sessions. Times display in the device's current time zone. Goal defaults to eight hours and is customizable from one minute through 24 hours.

## Verification

TypeScript and 42 repository/model/regression tests pass locally. Coverage includes explicit start/wake/reopen, dismiss/read without writes, after-midnight sleep, both DST transitions, exact 8H 24M duration, concurrent repository instances, duplicate buttons, stale writes, corrections, overlap/future guards, goal persistence, cancellation, deletion, corrupt timestamps/storage, failed saves and preservation of existing keys. No private records are part of the release.

The local browser automation tools currently fail before connection (`failed to write kernel assets`), so visual end-to-end checks have not been completed. No physical iPhone is connected. Before claiming real-device verification, check on Safari and the installed PWA: dismiss SLEEP; start from both entry points; close/reopen while sleeping; wake once; verify summary; enter TODAY; close/reopen while awake; verify SLEEP; correct session times; change goal; delete a disposable test session; verify history/average/chart; confirm existing trades/timers/nutrition are intact; repeat simultaneous start/wake from two tabs; inspect 320px width, safe areas and keyboard/date picker behavior.
