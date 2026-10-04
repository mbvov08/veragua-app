"use client";

import { useEffect, useState } from "react";
import { savePushSubscription } from "@/lib/actions/push";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushNotificationOptIn() {
  const [status, setStatus] = useState<"idle" | "unsupported" | "granted" | "denied" | "loading">("idle");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "granted") setStatus("granted");
    else if (Notification.permission === "denied") setStatus("denied");
  }, []);

  async function activar() {
    setStatus("loading");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus(permission === "denied" ? "denied" : "idle");
      return;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      setStatus("idle");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    await savePushSubscription(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
    setStatus("granted");
  }

  if (status === "unsupported" || status === "granted") return null;

  return (
    <button
      onClick={activar}
      disabled={status === "loading"}
      className="chip-edit"
      title="Recibe notificaciones cuando te asignen una tarea"
    >
      {status === "denied" ? "Notificaciones bloqueadas" : status === "loading" ? "Activando..." : "Activar notificaciones"}
    </button>
  );
}
