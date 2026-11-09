/* Runs only in the installed/web app. Does not read or modify user storage. */
(() => {
  const version = document.querySelector('meta[name="better-build"]')?.content;
  const script = document.currentScript;
  if (!version || !script?.src) return;
  const root = new URL('./', script.src);
  let checking = false;
  let lastCheck = 0;
  let attempted = '';
  async function check() {
    if (document.visibilityState === 'hidden' || navigator.onLine === false || checking || Date.now() - lastCheck < 5000) return;
    checking = true;
    lastCheck = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const url = new URL('version.json', root);
      url.searchParams.set('check', String(Date.now()));
      const response = await fetch(url.href, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return;
      const next = await response.json();
      if (!/^[a-f0-9]{32}$/.test(next.version) || next.version === version || attempted === next.version) return;
      if (typeof next.entry !== 'string' || !/^_expo\/static\/js\/web\/entry-[a-f0-9]{32}\.js$/.test(next.entry)) return;
      // Never interrupt an open editor, import field or an action in progress.
      if (document.querySelector('input,textarea,[contenteditable="true"],[aria-disabled="true"],[aria-busy="true"]')) return;
      const bundle = await fetch(new URL(next.entry, root).href, { cache: 'force-cache', signal: controller.signal });
      if (!bundle.ok || document.visibilityState === 'hidden') return;
      if (document.querySelector('input,textarea,[contenteditable="true"],[aria-disabled="true"],[aria-busy="true"]')) return;
      attempted = next.version;
      try {
        if (sessionStorage.getItem('better:update-attempt') === next.version) return;
        sessionStorage.setItem('better:update-attempt', next.version);
      } catch { /* Updating also works when session storage is unavailable. */ }
      const destination = new URL(root.href);
      destination.searchParams.set('__better_build', next.version);
      location.replace(destination.href);
    } catch { /* Keep the current app usable offline or if a deployment is incomplete. */ }
    finally { clearTimeout(timeout); checking = false; }
  }
  document.addEventListener('visibilitychange', check);
  window.addEventListener('pageshow', check);
  window.addEventListener('online', check);
  if (document.readyState === 'complete') void check();
  else window.addEventListener('load', check, { once: true });
})();
