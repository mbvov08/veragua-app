"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silencioso: si falla (ej. navegador viejo), la app sigue funcionando normal, solo sin instalación/push.
      });
    }
  }, []);

  return null;
}
