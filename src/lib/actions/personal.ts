"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { workDateFor } from "@/lib/date";

export async function clockIn() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const now = new Date();
  const workDate = workDateFor(now);

  const existing = await prisma.timeEntry.findUnique({
    where: { userId_workDate: { userId: session.user.id, workDate } },
  });
  if (existing) throw new Error("Ya registraste tu entrada de hoy.");

  await prisma.timeEntry.create({
    data: { userId: session.user.id, workDate, clockIn: now },
  });

  revalidatePath("/");
  revalidatePath("/personal");
}

export async function clockOut() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const now = new Date();
  const workDate = workDateFor(now);

  const existing = await prisma.timeEntry.findUnique({
    where: { userId_workDate: { userId: session.user.id, workDate } },
  });
  if (!existing) throw new Error("Primero debes registrar tu entrada.");
  if (existing.clockOut) throw new Error("Ya registraste tu salida de hoy.");

  await prisma.timeEntry.update({
    where: { id: existing.id },
    data: { clockOut: now },
  });

  revalidatePath("/");
  revalidatePath("/personal");
}
