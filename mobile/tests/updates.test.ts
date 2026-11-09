import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../scripts/web-updates.js', import.meta.url), 'utf8');
const current = 'a'.repeat(32); const next = 'b'.repeat(32);
function fixture() {
  let now = 10000; let editor = false; let hidden = false; let offline = false; let failBundle = false; let remote = next;
  const calls: string[] = []; const navigations: string[] = []; const events: Record<string, () => Promise<void>> = {};
  const session = new Map<string, string>();
  vm.runInNewContext(source, {
    URL, AbortController, setTimeout, clearTimeout, Date: { now: () => now },
    document: { currentScript: { src: 'https://example.test/better/better-updates.js' }, readyState: 'loading', get visibilityState() { return hidden ? 'hidden' : 'visible'; }, querySelector: (selector: string) => selector.startsWith('meta') ? { content: current } : editor ? {} : null, addEventListener: (event: string, fn: () => Promise<void>) => { events[event] = fn; } },
    window: { addEventListener: (event: string, fn: () => Promise<void>) => { events[event] = fn; } },
    navigator: { get onLine() { return !offline; } },
    sessionStorage: { getItem: (key: string) => session.get(key), setItem: (key: string, value: string) => session.set(key, value) },
    location: { replace: (url: string) => navigations.push(url) },
    fetch: async (url: string) => { calls.push(url); if (url.includes('version.json')) return { ok: true, json: async () => ({ version: remote, entry: `_expo/static/js/web/entry-${remote}.js` }) }; return { ok: !failBundle }; },
  });
  return { calls, navigations, session, event: async (name = 'load') => { now += 6000; await events[name]!(); }, editor: (value: boolean) => { editor = value; }, hidden: (value: boolean) => { hidden = value; }, offline: (value: boolean) => { offline = value; }, failBundle: () => { failBundle = true; }, current: () => { remote = current; } };
}
test('new build loads on opening and avoids reload loops without touching user data', async () => {
  const f = fixture(); await f.event();
  assert.equal(f.navigations[0], `https://example.test/better/?__better_build=${next}`);
  assert.equal(f.calls.length, 2); assert.equal(f.session.size, 1);
  await f.event('pageshow'); assert.equal(f.navigations.length, 1);
});
test('same version, offline, hidden and unavailable bundles do not reload', async () => {
  for (const mode of ['current', 'offline', 'hidden', 'failBundle'] as const) {
    const f = fixture(); if (mode === 'offline' || mode === 'hidden') f[mode](true); else f[mode]();
    await f.event(); assert.equal(f.navigations.length, 0);
  }
});
test('open editors defer the update until a later return to the app', async () => {
  const f = fixture(); f.editor(true); await f.event(); assert.equal(f.navigations.length, 0);
  f.editor(false); await f.event('visibilitychange'); assert.equal(f.navigations.length, 1);
});
