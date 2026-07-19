'use client';
// src/components/_internal/NexenInspector.tsx
// Maintained by the CodeBenders IDE. Overwritten by the "Patch inspector"
// action when the wire protocol bumps. Do not edit by hand.
import { useEffect } from 'react';

type ElementInfo = {
  locatorId: string;
  componentName: string;
  bbox: { x: number; y: number; width: number; height: number };
  classList: string[];
  computedStyle: Record<string, string>;
  innerText: string;
  tag: string;
};

const PROBE_STYLE_KEYS = [
  'color', 'backgroundColor', 'borderColor', 'borderRadius',
  'padding', 'margin', 'fontSize', 'fontWeight', 'fontFamily',
  'lineHeight', 'display', 'flexDirection', 'justifyContent',
  'alignItems',
] as const;

function getFiber(el: Element): any | null {
  for (const k of Object.keys(el)) {
    if (k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')) {
      return (el as any)[k];
    }
  }
  return null;
}

function pickSourceFrom(fiber: any): string {
  if (!fiber) return '';
  const candidates = [
    fiber._debugSource,
    fiber._source,
    fiber.__source,
    fiber.memoizedProps && fiber.memoizedProps.__source,
    fiber.pendingProps && fiber.pendingProps.__source,
    fiber.alternate && fiber.alternate._debugSource,
  ];
  for (const src of candidates) {
    if (src && typeof src.fileName === 'string') {
      const line = src.lineNumber ?? 1;
      const col = src.columnNumber ?? 0;
      return `${src.fileName}:${line}:${col}`;
    }
  }
  return '';
}

// Coerce React's varied source-stack carriers into a single newline-joined
// string of frames we can regex. React 18.3+/19 sets `_debugStack` and
// `_debugTask` to Error-like objects (`new Error()`) so the actual frames
// live on `.stack`. Some Task implementations are functions returning a
// string. Some are plain objects with a `frames` array.
function stackToString(stack: unknown): string {
  if (!stack) return '';
  if (typeof stack === 'string') return stack;
  if (typeof stack === 'function') {
    try { return stackToString((stack as () => unknown)()); } catch { return ''; }
  }
  if (typeof stack === 'object') {
    const obj = stack as any;
    if (typeof obj.stack === 'string') return obj.stack;
    if (typeof obj.stack === 'function') {
      try { return stackToString(obj.stack()); } catch { /* fall through */ }
    }
    if (Array.isArray(obj.frames)) {
      try {
        return obj.frames
          .map((f: any) => `    at ${f.functionName || ''} (${f.fileName || f.url || ''}:${f.lineNumber}:${f.columnNumber})`)
          .join('\n');
      } catch { /* fall through */ }
    }
    if (Array.isArray(obj)) {
      try { return obj.join('\n'); } catch { return ''; }
    }
  }
  return '';
}

// React 18.3 / 19 ship an "owner stack" — Error-like objects whose
// `.stack` looks like:
//   "Error\n    at AdminDashboardPage (webpack-internal:///(...)/src/app/admin/page.tsx:42:5)\n..."
// Parse out the first frame whose path is user code (not node_modules,
// not React internals). The fileName may be prefixed with
// `webpack-internal:///` or similar; strip the URL scheme so the backend
// sees a normal absolute / repo-relative path.
// A path is "user source" only if it lives under a typical project
// source root AND ends in a source extension. Reject anything that
// looks like compiled output (turbopack chunks, webpack bundles,
// Next.js's .next dir, react-dom internals). We're permissive about
// the SCHEME (webpack-internal://, file://, plain abs path) but
// strict about the PATH SHAPE.
function _looksLikeUserSource(path: string): boolean {
  if (!path) return false;
  // Compiled output / framework internals — always reject.
  if (/node_modules/.test(path)) return false;
  if (/\/_next\//.test(path)) return false;          // Next.js build output
  if (/\/\.next\//.test(path)) return false;
  if (/\/static\/chunks\//.test(path)) return false;
  if (/turbopack-/.test(path)) return false;       // turbopack chunk basenames
  if (/\/next\/dist\//.test(path)) return false;
  if (/\/react(?:-dom)?\//.test(path)) return false;
  // Must end in a source extension. Reject .js — almost always compiled
  // output in modern Next/Vite projects, and the false-negative rate on
  // legit user .js files is acceptably low (most users write .tsx/.jsx).
  if (!/\.(?:tsx|jsx|ts)$/.test(path)) return false;
  return true;
}

function parseSourceFromOwnerStack(stack: unknown): string {
  const s = stackToString(stack);
  if (!s) return '';
  // Match "at <Component> (<path>:<line>:<col>)". We capture the path,
  // run it through _looksLikeUserSource(), and skip any match that's
  // a compiled chunk URL (turbopack /_next/static/chunks/*, webpack
  // bundles, etc). On turbopack-built apps the fiber stack often points
  // ONLY at compiled chunks, in which case we return empty and the
  // caller falls back to the nexen-anchor scheme.
  const re = /\(?((?:webpack-internal:\/{2,3}[^()]*?)?[\/][^():\s]+?\.(?:tsx|jsx|ts|js)):(\d+):(\d+)\)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    let path = m[1];
    // Strip URL scheme and webpack group prefix BEFORE checking shape.
    path = path
      .replace(/^webpack-internal:\/{2,3}/, '')
      .replace(/^turbopack:\/{2,3}\[project\]\/?/, '')
      .replace(/^\([^)]*\)\/+/, '')
      .replace(/^(?:\/+\.{1,2}\/+)+/, '')
      .replace(/^\.{1,2}\/+/, '');
    path = path.replace(/\/\.\//g, '/');
    if (!_looksLikeUserSource(path)) continue;
    return `${path}:${m[2]}:${m[3]}`;
  }
  return '';
}

function readSourceLocator(el: Element): string {
  let fiber: any = getFiber(el);
  let depth = 0;
  const diag: any[] = [];
  while (fiber && depth < 60) {
    const hit = pickSourceFrom(fiber);
    if (hit) return hit;
    // _debugStack / _debugTask are the React 18.3+ replacements for
    // _debugSource. Try both at the fiber AND its owner.
    const stackHit = parseSourceFromOwnerStack(fiber._debugStack)
      || parseSourceFromOwnerStack(fiber._debugTask);
    if (stackHit) return stackHit;
    let owner = fiber._debugOwner;
    let ownerDepth = 0;
    while (owner && ownerDepth < 10) {
      const ownerHit = pickSourceFrom(owner);
      if (ownerHit) return ownerHit;
      const ownerStackHit = parseSourceFromOwnerStack(owner._debugStack)
        || parseSourceFromOwnerStack(owner._debugTask);
      if (ownerStackHit) return ownerStackHit;
      owner = owner._debugOwner;
      ownerDepth++;
    }
    // First few fibers: snapshot the actual key list + the values of
    // any source-related fields. Lets us see in the console what's
    // ACTUALLY populated so we know which field to read.
    if (depth < 5) {
      const allKeys = Object.keys(fiber);
      const sourceyKeys = allKeys.filter(k =>
        k.startsWith('_') || /source|debug|loc|line|file/i.test(k)
      );
      const sourceyValues: Record<string, any> = {};
      for (const k of sourceyKeys) {
        const v = fiber[k];
        if (v == null) {
          sourceyValues[k] = v;
        } else if (typeof v === 'object') {
          // Print a flat summary so it's readable in the console without
          // having to expand. Slice strings so we don't dump 10kB stacks.
          try {
            const flat: Record<string, any> = {};
            for (const ik of Object.keys(v).slice(0, 8)) {
              const iv = (v as any)[ik];
              flat[ik] = typeof iv === 'string' ? iv.slice(0, 120)
                : typeof iv === 'object' ? '[obj]' : iv;
            }
            sourceyValues[k] = flat;
          } catch {
            sourceyValues[k] = '[unreadable]';
          }
        } else if (typeof v === 'string') {
          sourceyValues[k] = v.slice(0, 200);
        } else if (typeof v === 'function') {
          // Maybe the value is a lazy getter; try calling it.
          try {
            const r = v();
            sourceyValues[k] = typeof r === 'string' ? r.slice(0, 200) : r;
          } catch {
            sourceyValues[k] = '[fn]';
          }
        } else {
          sourceyValues[k] = v;
        }
      }
      diag.push({
        depth,
        typeName: typeof fiber.type === 'function' ? (fiber.type.name || 'anon-fn') : String(fiber.type),
        sourceyKeys: sourceyKeys.join(','),
        sourceyValues,
      });
    }
    fiber = fiber.return;
    depth++;
  }
  if (diag.length > 0) {
    console.warn('[NexenInspector] fiber walk found NO source. Full diagnostic:');
    for (const d of diag) {
      console.warn(`  d=${d.depth} type=${d.typeName} keys=${d.sourceyKeys}`, d.sourceyValues);
    }
  }
  return '';
}

function findComponentRoot(el: Element | null): HTMLElement | null {
  let cur: Element | null = el;
  while (cur && cur !== document.body) {
    if (cur instanceof HTMLElement && cur.dataset.nexenComponent) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

// Find the nearest `data-nexen-component` anchor walking UP from `el`.
// We rely on these wrappers being on every generated page (the generator
// stamps them on top-level routes + major sections), so this is a stable
// way to identify "the component the user clicked inside" without needing
// per-JSX-element source data.
function findNexenComponentAnchor(el: Element | null): { name: string; node: HTMLElement } | null {
  let cur: Element | null = el;
  while (cur && cur !== document.body) {
    if (cur instanceof HTMLElement && cur.dataset.nexenComponent) {
      return { name: cur.dataset.nexenComponent, node: cur };
    }
    cur = cur.parentElement;
  }
  return null;
}

// Build the locator the backend understands. Two-shape locator:
//   "nexen:<ComponentName>@<file.tsx>"
//     → backend greps for data-nexen-component="<ComponentName>" in the
//       file, applies the rewrite at that JSX opening tag. Robust against
//       bundle-coord vs source-coord drift in React 19 / Next 15.
//   "<file>:<line>:<col>"
//     → legacy file:line:col, used when we have reliable source coords
//       (older React / Babel + LocatorJS apps).
//
// We prefer the nexen-anchor form when a data-nexen-component ancestor
// exists, falling back to file:line:col only if there's no anchor (rare).
function buildLocator(el: HTMLElement): string {
  const anchor = findNexenComponentAnchor(el);
  const sourceCoord = readSourceLocator(el);
  if (anchor) {
    // Pull the file part out of the source coord. Only use it if it
    // looks like a real user-source path — on turbopack builds the
    // fiber stack sometimes points at compiled chunk URLs like
    // `/_next/static/chunks/turbopack-XXX.js`, which the backend would
    // (correctly) reject as "locator file escapes output_dir".
    const file = sourceCoord.replace(/:(\d+):(\d+)$/, '');
    if (file && _looksLikeUserSource(file)) {
      return `nexen:${anchor.name}@${file}`;
    }
    // No reliable file — send the anchor without one. Backend resolves
    // by greping the workspace for `data-nexen-component="Name"`.
    return `nexen:${anchor.name}`;
  }
  return sourceCoord;
}

function describe(el: HTMLElement): ElementInfo {
  const rect = el.getBoundingClientRect();
  const computed = window.getComputedStyle(el);
  const computedStyle: Record<string, string> = {};
  for (const k of PROBE_STYLE_KEYS) computedStyle[k] = computed.getPropertyValue(k);
  return {
    locatorId: buildLocator(el),
    componentName: el.dataset.nexenComponent ?? '',
    bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    classList: Array.from(el.classList),
    computedStyle,
    innerText: (el.innerText ?? '').slice(0, 80),
    tag: el.tagName.toLowerCase(),
  };
}

// One-off style block: inserts the CSS keyframes used by the selected-
// outline marching-ants animation and the pending pulse. Idempotent —
// the inspector mounts at most once per page, but a re-mount would still
// be safe because we keyed it by id.
function ensureStyles() {
  if (document.getElementById('nexen-inspector-style')) return;
  const style = document.createElement('style');
  style.id = 'nexen-inspector-style';
  style.textContent = [
    '@keyframes nexen-marching-ants {',
    '  to { background-position: 24px 0, -24px 100%, 0 -24px, 100% 24px; }',
    '}',
    '@keyframes nexen-pulse {',
    '  0%, 100% { opacity: 1; transform: scale(1); }',
    '  50% { opacity: 0.55; transform: scale(1.18); }',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}

function makeHoverOutline(): HTMLDivElement {
  const div = document.createElement('div');
  div.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:2147483646',
    'border:2px solid #2563eb', 'border-radius:4px',
    // Slight tint so the user sees the hovered region as a "highlight",
    // not just an outlined empty box. Low alpha keeps the underlying
    // content readable.
    'background:rgba(37, 99, 235, 0.08)',
    'transition:left 80ms ease, top 80ms ease, width 80ms ease, height 80ms ease',
    'display:none', 'box-sizing:border-box',
  ].join(';');
  document.body.appendChild(div);
  return div;
}

function makeSelectedOutline(): HTMLDivElement {
  const div = document.createElement('div');
  // Marching-ants effect via background-image gradients on each side.
  // 4 linear-gradients form the border; `background-position` is
  // animated to give the dashes a perpetual "scrolling" motion. Pure
  // CSS, no JS tick.
  div.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:2147483647',
    'border-radius:4px',
    'background:rgba(16, 185, 129, 0.06)',
    `background-image:
       linear-gradient(90deg, #10b981 50%, transparent 50%),
       linear-gradient(90deg, #10b981 50%, transparent 50%),
       linear-gradient(0deg, #10b981 50%, transparent 50%),
       linear-gradient(0deg, #10b981 50%, transparent 50%)`,
    'background-repeat:repeat-x, repeat-x, repeat-y, repeat-y',
    'background-size:12px 2px, 12px 2px, 2px 12px, 2px 12px',
    'background-position:0 0, 0 100%, 0 0, 100% 0',
    'animation:nexen-marching-ants 600ms linear infinite',
    'display:none', 'box-sizing:border-box',
  ].join(';');
  document.body.appendChild(div);
  return div;
}

// Pulsing dot pinned to the selected outline's top-right while an edit
// is in flight. Tells the user "your last click is still saving, hold
// on" without blocking the iframe.
function makePendingBadge(): HTMLDivElement {
  const div = document.createElement('div');
  div.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:2147483647',
    'width:10px', 'height:10px', 'border-radius:50%',
    'background:#f59e0b', 'box-shadow:0 0 0 2px rgba(245, 158, 11, 0.35)',
    'animation:nexen-pulse 900ms ease-in-out infinite',
    'display:none',
  ].join(';');
  document.body.appendChild(div);
  return div;
}

export const NEXEN_INSPECTOR_VERSION = 14;

export function NexenInspector(): null {
  useEffect(() => {
    // Activate under EITHER MOCK_MODE (legacy mock-data preview) or the
    // IDE-only NEXEN_INSPECT flag (always set by the IDE-managed dev
    // server). The second flag unblocks hover/click for real-data
    // previews where the user still wants to inspect elements.
    const mockOn = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
    const inspectOn = process.env.NEXT_PUBLIC_NEXEN_INSPECT === 'true';
    if (!mockOn && !inspectOn) return;
    try {
      (document.documentElement as HTMLElement).dataset.nexenInspectorVersion = String(NEXEN_INSPECTOR_VERSION);
    } catch {}
    ensureStyles();
    const hoverOutline = makeHoverOutline();
    const selectedOutline = makeSelectedOutline();
    const pendingBadge = makePendingBadge();
    let selectedEl: HTMLElement | null = null;
    let editModeEnabled = false;
    let fineGrained = false;
    // When the parent fires `nexen:edit-pending`, we block further clicks
    // until `nexen:edit-done` arrives. Prevents racing requests from
    // queueing identical-locator edits before the first one persists.
    let editPending = false;

    function paint(outline: HTMLDivElement, el: HTMLElement | null) {
      if (!el) { outline.style.display = 'none'; return; }
      const r = el.getBoundingClientRect();
      outline.style.display = 'block';
      outline.style.left = `${r.left}px`;
      outline.style.top = `${r.top}px`;
      outline.style.width = `${r.width}px`;
      outline.style.height = `${r.height}px`;
    }

    function paintPendingBadge() {
      if (!editPending || !selectedEl) {
        pendingBadge.style.display = 'none';
        return;
      }
      const r = selectedEl.getBoundingClientRect();
      pendingBadge.style.display = 'block';
      pendingBadge.style.left = `${r.right - 16}px`;
      pendingBadge.style.top = `${r.top + 6}px`;
    }

    function resolveTarget(el: Element | null): HTMLElement | null {
      if (!el) return null;
      if (el === hoverOutline || el === selectedOutline || el === pendingBadge) return null;
      if (fineGrained) {
        return el instanceof HTMLElement ? el : null;
      }
      // Component mode: snap to nearest data-nexen-component. If the app
      // doesn't tag any element (rare — pages are usually tagged), fall
      // back to the raw element so hover still shows SOMETHING and the
      // user can see the inspector is alive.
      return findComponentRoot(el) ?? (el instanceof HTMLElement ? el : null);
    }

    function onMove(e: MouseEvent) {
      if (!editModeEnabled) return;
      paint(hoverOutline, resolveTarget(e.target as Element | null));
    }
    function onClick(e: MouseEvent) {
      if (!editModeEnabled) return;
      if (editPending) {
        // Last edit still in flight — swallow the click so the user
        // can't fire a second request mid-save.
        e.preventDefault();
        e.stopPropagation();
        console.warn('[NexenInspector] click ignored — previous edit still pending');
        return;
      }
      const raw = e.target as Element | null;
      const target = resolveTarget(raw);
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      selectedEl = target;
      paint(selectedOutline, target);
      paintPendingBadge();
      const info = describe(target);
      console.log('[NexenInspector] click', {
        fineGrained,
        rawTag: raw ? (raw as HTMLElement).tagName : null,
        resolvedTag: target.tagName,
        resolvedLocatorId: info.locatorId || '(empty)',
        resolvedComponent: info.componentName || '(empty)',
      });
      if (!info.locatorId) {
        console.warn(
          '[NexenInspector] no React fiber _debugSource for this element. ' +
          'The dev server is probably running with JSX source-locations disabled. ' +
          'For Next.js, dev mode emits __source by default; verify the app is in dev (not prod) build.',
        );
      }
      window.parent.postMessage(
        { type: 'nexen:element-selected', payload: info },
        '*',
      );
    }
    function onScrollOrResize() {
      paint(selectedOutline, selectedEl);
      paintPendingBadge();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        selectedEl = null;
        paint(selectedOutline, null);
        paintPendingBadge();
        window.parent.postMessage({ type: 'nexen:element-deselected' }, '*');
      }
    }
    function onParentMessage(e: MessageEvent) {
      const data = e.data as { type?: string; style?: Record<string, string>; enabled?: boolean };
      if (data?.type === 'nexen:set-edit-mode') {
        editModeEnabled = !!data.enabled;
        if (!editModeEnabled) {
          paint(hoverOutline, null);
          paint(selectedOutline, null);
          selectedEl = null;
          editPending = false;
          paintPendingBadge();
        }
        return;
      }
      if (data?.type === 'nexen:set-fine-grained') {
        fineGrained = !!data.enabled;
        paint(hoverOutline, null);
        paint(selectedOutline, null);
        selectedEl = null;
        editPending = false;
        paintPendingBadge();
        return;
      }
      if (data?.type === 'nexen:edit-pending') {
        editPending = true;
        paintPendingBadge();
        return;
      }
      if (data?.type === 'nexen:edit-done') {
        editPending = false;
        paintPendingBadge();
        return;
      }
      if (data?.type === 'nexen:request-version') {
        window.parent.postMessage(
          { type: 'nexen:inspector-version', version: NEXEN_INSPECTOR_VERSION },
          '*',
        );
        return;
      }
      if (data?.type === 'nexen:element-deselected') {
        selectedEl = null;
        paint(selectedOutline, null);
        editPending = false;
        paintPendingBadge();
        return;
      }
      if (data?.type === 'nexen:apply-style-preview' && selectedEl && data.style) {
        for (const [k, v] of Object.entries(data.style)) {
          selectedEl.style.setProperty(k, v);
        }
      }
      if (data?.type === 'nexen:clear-style-preview' && selectedEl) {
        selectedEl.removeAttribute('style');
      }
    }

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('keydown', onKey);
    window.addEventListener('message', onParentMessage);
    try {
      window.parent.postMessage(
        { type: 'nexen:inspector-ready', version: NEXEN_INSPECTOR_VERSION },
        '*',
      );
    } catch {}
    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('message', onParentMessage);
      hoverOutline.remove();
      selectedOutline.remove();
      pendingBadge.remove();
    };
  }, []);
  return null;
}

export default NexenInspector;
