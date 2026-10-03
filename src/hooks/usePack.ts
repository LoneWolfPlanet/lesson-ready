import { useEffect, useRef, useState } from "react";
import { packsApi } from "../api/client";
import { asApiError, type ApiError } from "../api/http";
import type { Pack } from "../api/types";
import { config } from "../config";

/** True while the browser reports a connection. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/**
 * Safety net: stop polling a pack that is still "working" long after it should have
 * finished, so an unexpected status can never cause endless requests.
 */
const MAX_WAIT_MINUTES = Math.max(20, config.expectedMinutes * 10);

export function isStale(createdAt: string): boolean {
  return (Date.now() - Date.parse(createdAt)) / 60000 > MAX_WAIT_MINUTES;
}

interface PackState {
  pack: Pack | null;
  fromCache: boolean;
  error: ApiError | null;
  /** True when polling stopped because the pack took far longer than expected. */
  stalled: boolean;
  reload(): void;
  /** Shows a pack the caller already has, e.g. the API's reply after an edit. */
  replace(pack: Pack): void;
}

/**
 * Loads a pack and keeps polling while it is still being written.
 * Pauses while the tab is hidden, and retries on its own after a lost connection.
 */
export function usePack(id: string | undefined): PackState {
  const [pack, setPack] = useState<Pack | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [stalled, setStalled] = useState(false);
  const [tick, setTick] = useState(0);
  const online = useOnline();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let alive = true;

    async function load() {
      window.clearTimeout(timer.current);
      try {
        const res = await packsApi.get(id!);
        if (!alive) return;
        setPack(res.pack);
        setFromCache(res.fromCache);
        setError(null);
        const tooLong = res.pack.status === "working" && isStale(res.pack.createdAt);
        setStalled(tooLong);
        // Poll only while the pack is still being written (or we're showing an offline copy).
        if ((res.pack.status === "working" && !tooLong) || res.fromCache) schedule();
      } catch (e) {
        if (!alive) return;
        const err = asApiError(e);
        setError(err);
        if (err.kind === "offline" || err.kind === "server" || err.kind === "busy") schedule(true);
      }
    }

    function schedule(slow = false) {
      const ms = config.pollSeconds * 1000 * (slow ? 3 : 1);
      timer.current = window.setTimeout(() => {
        if (document.visibilityState === "visible") load();
        else schedule(slow);
      }, ms);
    }

    load();
    return () => {
      alive = false;
      window.clearTimeout(timer.current);
    };
    // `online` reloads immediately when the connection comes back.
  }, [id, tick, online]);

  return {
    pack,
    fromCache,
    error,
    stalled,
    reload: () => setTick((n) => n + 1),
    replace: (next: Pack) => {
      setPack(next);
      setFromCache(false);
    },
  };
}
