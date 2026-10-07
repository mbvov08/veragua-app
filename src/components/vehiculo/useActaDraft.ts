"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Borrador local de una acta en progreso — sobrevive a una recarga o a que se caiga la
// señal mientras el conductor/staff va llenando el formulario en el celular. Usa
// IndexedDB (no localStorage) porque hay que guardar los Blobs de las fotos y firmas ya
// comprimidas, no solo texto. El borrador se borra recién cuando el server action de
// guardar tiene éxito, así nunca queda una VehiculoSalida a medias en la base de datos.

const DB_NAME = "veragua-vehiculo-drafts";
const STORE = "drafts";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** `key` identifica el borrador (ej. "entrega" o "devolucion-<salidaId>"). `initial` es
 * el valor con el que arranca el formulario si no hay borrador guardado. */
export function useActaDraft<T>(key: string, initial: T) {
  const [draft, setDraft] = useState<T>(initial);
  const [borradorDisponible, setBorradorDisponible] = useState(false);
  const [listo, setListo] = useState(false);
  const initialRef = useRef(initial);

  useEffect(() => {
    let cancelado = false;
    idbGet<T>(key)
      .then((saved) => {
        if (cancelado) return;
        if (saved !== undefined) setBorradorDisponible(true);
        setListo(true);
      })
      .catch(() => setListo(true));
    return () => {
      cancelado = true;
    };
  }, [key]);

  const guardar = useCallback(
    (value: T) => {
      setDraft(value);
      idbSet(key, value).catch(() => {});
    },
    [key]
  );

  const retomarBorrador = useCallback(async () => {
    const saved = await idbGet<T>(key);
    if (saved !== undefined) setDraft(saved);
    setBorradorDisponible(false);
  }, [key]);

  const descartarBorrador = useCallback(() => {
    idbDelete(key).catch(() => {});
    setBorradorDisponible(false);
    setDraft(initialRef.current);
  }, [key]);

  const limpiarTrasGuardar = useCallback(() => {
    idbDelete(key).catch(() => {});
  }, [key]);

  return { draft, guardar, listo, borradorDisponible, retomarBorrador, descartarBorrador, limpiarTrasGuardar };
}
