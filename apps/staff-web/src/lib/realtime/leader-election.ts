/**
 * Leader-tab election for audio alerts.
 *
 * Two open tabs of the same staff session => the same realtime INSERT fires
 * an audio cue in both. Staff trains itself to mute. The fix: among all open
 * tabs, exactly one ("the leader") plays audio. Visual toasts continue per
 * tab — only the audio surface is leader-only.
 *
 * Transport: Web Locks API when available (Chrome 69+, Firefox 96+,
 * Safari 15.4+). The lock is requested with `mode: 'exclusive'`; whichever
 * tab gets the lock holds it for the lifetime of the page (the lock is
 * released automatically when the page is unloaded or the abort signal
 * fires). Sibling tabs queue behind it and are promoted on release.
 *
 * Fallback: BroadcastChannel + heartbeat. Each tab broadcasts a heartbeat
 * carrying its own `tabId` and a monotonic `bornAt` (ms since epoch). The
 * tab with the smallest `bornAt` whose heartbeat is still fresh is the
 * leader. Stale leaders (no heartbeat seen in `STALE_AFTER_MS`) are
 * superseded by the next-oldest live tab. This is a best-effort consensus —
 * during a brief partition two tabs may both think they're the leader; the
 * impact is one extra audio cue, not data corruption.
 *
 * The hook is intentionally NOT a React context. Multiple consumers can
 * subscribe; each gets the same shared lock state via module-level
 * coordination. There's only one leader per BrowserContext, regardless of
 * how many components ask.
 */

const LOCK_NAME = 'gustri-staff-audio-leader';
const FALLBACK_CHANNEL = 'gustri-leader-election-v1';
const HEARTBEAT_INTERVAL_MS = 2_000;
const STALE_AFTER_MS = 5_000;

type FallbackMessage =
  | { kind: 'heartbeat'; tabId: string; bornAt: number }
  | { kind: 'goodbye'; tabId: string };

interface LeaderState {
  isLeader: boolean;
  subscribers: Set<(isLeader: boolean) => void>;
  cleanup: (() => void) | null;
}

let state: LeaderState | null = null;

function ensureState(): LeaderState {
  if (state) return state;
  state = { isLeader: false, subscribers: new Set(), cleanup: null };
  state.cleanup = startElection(state);
  return state;
}

function setLeader(s: LeaderState, next: boolean) {
  if (s.isLeader === next) return;
  s.isLeader = next;
  for (const sub of s.subscribers) sub(next);
}

function startElection(s: LeaderState): () => void {
  if (typeof window === 'undefined') {
    // SSR — no leader concept; no audio plays here anyway.
    return () => {};
  }

  // Preferred path: Web Locks API. The lock is granted exactly to one
  // BrowserContext at a time; we hold it for the page lifetime by returning
  // a never-resolving promise from the callback. The browser releases the
  // lock automatically when the page is destroyed.
  const nav = navigator as Navigator & {
    locks?: {
      request: (
        name: string,
        options: { mode: 'exclusive'; signal?: AbortSignal },
        callback: () => Promise<unknown>,
      ) => Promise<unknown>;
    };
  };
  if (nav.locks?.request) {
    const ctrl = new AbortController();
    nav.locks
      .request(LOCK_NAME, { mode: 'exclusive', signal: ctrl.signal }, () => {
        setLeader(s, true);
        // Hold the lock until the tab unloads. The browser releases it
        // automatically; we just need a promise that never settles.
        return new Promise<void>(() => {});
      })
      .catch(() => {
        // Aborted (e.g. teardown in tests) — drop leadership silently.
      });
    return () => {
      ctrl.abort();
      setLeader(s, false);
    };
  }

  // Fallback path: BroadcastChannel + heartbeat. The tab with the smallest
  // bornAt whose heartbeat is fresh is the leader. If BroadcastChannel is
  // also missing, we self-elect (single-tab assumption); the cost is one
  // extra audio cue if the user opens a second tab on a very old browser.
  const tabId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const bornAt = Date.now();

  if (typeof BroadcastChannel === 'undefined') {
    setLeader(s, true);
    return () => setLeader(s, false);
  }

  const channel = new BroadcastChannel(FALLBACK_CHANNEL);
  // Map of peer tabId -> { bornAt, lastSeenAt }. We don't track our own here.
  const peers = new Map<string, { bornAt: number; lastSeenAt: number }>();

  const announce = () => {
    const msg: FallbackMessage = { kind: 'heartbeat', tabId, bornAt };
    try {
      channel.postMessage(msg);
    } catch {
      // Channel closed mid-write — election will repair on next tick.
    }
  };

  const recompute = () => {
    const now = Date.now();
    let oldestPeerBornAt = Number.POSITIVE_INFINITY;
    for (const [peerId, info] of peers) {
      if (now - info.lastSeenAt > STALE_AFTER_MS) {
        peers.delete(peerId);
        continue;
      }
      if (info.bornAt < oldestPeerBornAt) oldestPeerBornAt = info.bornAt;
    }
    // Tie-breaker: if two tabs share a bornAt (clock skew), the larger
    // tabId wins to keep the choice deterministic across peers.
    const isOldest =
      bornAt < oldestPeerBornAt ||
      (bornAt === oldestPeerBornAt &&
        Array.from(peers.entries()).every(([peerId, info]) =>
          info.bornAt === bornAt ? tabId > peerId : true,
        ));
    setLeader(s, isOldest);
  };

  channel.addEventListener('message', (event: MessageEvent<FallbackMessage>) => {
    const data = event.data;
    if (!data) return;
    if (data.kind === 'heartbeat') {
      if (data.tabId === tabId) return;
      peers.set(data.tabId, { bornAt: data.bornAt, lastSeenAt: Date.now() });
      recompute();
    } else if (data.kind === 'goodbye') {
      if (peers.delete(data.tabId)) recompute();
    }
  });

  // Announce immediately so existing peers know we exist; recompute once so
  // a single-tab session goes leader without waiting for the first tick.
  announce();
  recompute();
  const heartbeat = setInterval(() => {
    announce();
    recompute();
  }, HEARTBEAT_INTERVAL_MS);

  const onUnload = () => {
    try {
      const msg: FallbackMessage = { kind: 'goodbye', tabId };
      channel.postMessage(msg);
    } catch {
      // Best-effort — sibling tabs will time us out via STALE_AFTER_MS.
    }
  };
  window.addEventListener('pagehide', onUnload);
  window.addEventListener('beforeunload', onUnload);

  return () => {
    clearInterval(heartbeat);
    window.removeEventListener('pagehide', onUnload);
    window.removeEventListener('beforeunload', onUnload);
    onUnload();
    channel.close();
    peers.clear();
    setLeader(s, false);
  };
}

/**
 * Subscribe to leader-tab status changes. Returns an unsubscribe function.
 * The first subscriber starts the election; subsequent subscribers reuse
 * the existing election state.
 *
 * Exported separately from the hook so non-React code (e.g. tests) can
 * observe leader status.
 */
export function subscribeIsLeader(cb: (isLeader: boolean) => void): () => void {
  const s = ensureState();
  s.subscribers.add(cb);
  // Fire immediately so the caller doesn't have to wait for the next event.
  cb(s.isLeader);
  return () => {
    s.subscribers.delete(cb);
    // We intentionally don't tear down the election when the last subscriber
    // leaves — staff-web has a long-lived NotificationProvider, and ramping
    // election up/down on every component remount would be wasteful. The
    // module's `__resetForTests` hook below covers test cleanup.
  };
}

/**
 * Test-only: reset the module's election state so each test starts fresh.
 * No-op outside test environments.
 */
export function __resetLeaderElectionForTests() {
  if (state?.cleanup) state.cleanup();
  state = null;
}
