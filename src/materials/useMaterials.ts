// Loads the teacher's materials, runs uploads, and polls while anything is still uploading or being read.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { materialsApi, type TokenGetter } from "./api";
import { uploadToBlob } from "./blobUpload";
import type { LocalUpload, Material, MaterialDetails } from "./types";


export function useMaterials(getToken: TokenGetter) {
  // Keep the latest token function without rebuilding the client (and re-fetching) on every render.
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const api = useMemo(() => materialsApi(() => tokenRef.current()), []);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [local, setLocal] = useState<Record<string, LocalUpload>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const controllers = useRef(new Map<string, AbortController>());

  const refresh = useCallback(async () => {
    try {
      setMaterials(await api.list());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your materials.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll only while there's real work: a file being read, or an upload running on this device.
  // "uploading" records with no upload here are left over from an interrupted upload.
  const busy = materials.some(
    (m) => m.status === "indexing" || (m.status === "uploading" && local[m.id]?.state === "sending"),
  );
  useEffect(() => {
    if (!busy) return;
    let delay = 5000;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      timer = setTimeout(async () => {
        if (document.visibilityState === "visible") await refresh();
        delay = Math.min(delay * 1.5, 60000); // 5s, 7.5s, 11s … up to 1 min
        tick();
      }, delay);
    };
    tick();
    return () => clearTimeout(timer);
  }, [busy, refresh]);
  // Cancel in-flight uploads if the screen unmounts.
  useEffect(() => {
    const map = controllers.current;
    return () => map.forEach((c) => c.abort());
  }, []);

  const send = useCallback(
    async (id: string, uploadUrl: string, file: File, details: MaterialDetails) => {
      const controller = new AbortController();
      controllers.current.set(id, controller);
      setLocal((s) => ({ ...s, [id]: { progress: 0, state: "sending", file, details } }));
      try {
        await uploadToBlob(uploadUrl, file, {
          contentType: file.type,
          metadata: {
            subject: details.subject,
            grade: String(details.grade),
            lesson_title: details.lessonTitle,
          },
          signal: controller.signal,
          onProgress: (progress) =>
            setLocal((s) => (s[id] ? { ...s, [id]: { ...s[id], progress } } : s)),
        });
        const updated = await api.complete(id);
        setMaterials((list) => list.map((m) => (m.id === id ? updated : m)));
        setLocal(({ [id]: _done, ...rest }) => rest);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const error = e instanceof Error ? e.message : "The upload didn't finish.";
        setLocal((s) => (s[id] ? { ...s, [id]: { ...s[id], state: "error", error } } : s));
      } finally {
        controllers.current.delete(id);
      }
    },
    [api],
  );

  /** Creates the record, then uploads. Throws (for the form to show) only if the API refuses. */
  const add = useCallback(
    async (file: File, details: MaterialDetails) => {
      const { material, uploadUrl } = await api.create({
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        ...details,
      });
      setMaterials((list) => [material, ...list]);
      void send(material.id, uploadUrl, file, details);
    },
    [api, send],
  );

  /** Retry asks for a fresh SAS, because the old one may have expired. */
  const retry = useCallback(
    async (id: string) => {
      const item = local[id];
      if (!item) return;
      try {
        await api.remove(id);
      } catch {
        /* the old record may already be gone */
      }
      setMaterials((list) => list.filter((m) => m.id !== id));
      setLocal(({ [id]: _old, ...rest }) => rest);
      await add(item.file, item.details);
    },
    [api, add, local],
  );

  const remove = useCallback(
    async (id: string) => {
      controllers.current.get(id)?.abort();
      await api.remove(id);
      setMaterials((list) => list.filter((m) => m.id !== id));
      setLocal(({ [id]: _gone, ...rest }) => rest);
    },
    [api],
  );

  return { materials, local, loading, loadError, refresh, add, retry, remove };
}
