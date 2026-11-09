# better.

[Open better.](https://andrinhongler1-pixel.github.io/better/)

The existing Expo / React Native mobile web app, published from `docs/`. App source is in `mobile/`; personal journal data stays in the browser/device and is not committed here.

SLEEP includes an explicit persistent sleep/wake cycle, morning summary, seven-session average, weekly chart, history, goal and manual corrections. Existing trading, daily imports, quitting timers, nutrition and the automatic web updater remain available.

Source updates run `.github/workflows/build-better.yml`, which checks TypeScript and tests before producing the static assets. A reviewed release commit triggers the existing GitHub Pages branch deployment. See `mobile/SLEEP.md` for limitations and the iPhone Safari/Home Screen test checklist.
