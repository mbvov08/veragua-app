import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@veragua.co";
  if (!publicKey || !privateKey) {
    throw new Error("Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en las variables de entorno.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

// Envía una notificación push a un usuario en todos sus dispositivos suscritos.
// No lanza si algo falla (una notificación perdida no debe romper la acción que la dispara).
export async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  try {
    ensureConfigured();
  } catch {
    return; // VAPID no configurado todavía: se omite silenciosamente.
  }

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  const json = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Suscripción caducada/inválida: se elimina.
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    })
  );
}
