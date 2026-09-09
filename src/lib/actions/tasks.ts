"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";

export async function createTask(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Solo la administradora puede crear tareas.");
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const asignadoAId = String(formData.get("asignadoAId") ?? "");
  const fechaTentativaStr = String(formData.get("fechaTentativa") ?? "");
  const fechaLimiteStr = String(formData.get("fechaLimite") ?? "");
  const esProyecto = formData.get("esProyecto") === "on";
  const proyectoId = String(formData.get("proyectoId") ?? "").trim() || null;

  if (!titulo || !asignadoAId) throw new Error("Completa el título y la persona asignada.");

  await prisma.task.create({
    data: {
      titulo,
      descripcion: descripcion || null,
      asignadoAId,
      creadoPorId: session.user.id,
      fechaTentativa: fechaTentativaStr ? dateOnlyToUTC(fechaTentativaStr) : null,
      fechaLimite: fechaLimiteStr ? dateOnlyToUTC(fechaLimiteStr) : null,
      esProyecto,
      proyectoId,
    },
  });

  revalidatePath("/tareas");
  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function updateTask(taskId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Solo la administradora puede editar tareas.");
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const asignadoAId = String(formData.get("asignadoAId") ?? "");
  const fechaTentativaStr = String(formData.get("fechaTentativa") ?? "");
  const fechaLimiteStr = String(formData.get("fechaLimite") ?? "");
  const esProyecto = formData.get("esProyecto") === "on";
  const proyectoId = String(formData.get("proyectoId") ?? "").trim() || null;

  if (!titulo || !asignadoAId) throw new Error("Completa el título y la persona asignada.");
  if (proyectoId === taskId) throw new Error("Una tarea no puede ser fase de sí misma.");

  await prisma.task.update({
    where: { id: taskId },
    data: {
      titulo,
      descripcion: descripcion || null,
      asignadoAId,
      fechaTentativa: fechaTentativaStr ? dateOnlyToUTC(fechaTentativaStr) : null,
      fechaLimite: fechaLimiteStr ? dateOnlyToUTC(fechaLimiteStr) : null,
      esProyecto,
      proyectoId,
    },
  });

  revalidatePath("/tareas");
  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function updateTaskStatus(taskId: string, estado: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  await prisma.task.update({ where: { id: taskId }, data: { estado } });

  revalidatePath("/tareas");
  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function deleteTask(taskId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Solo la administradora puede eliminar tareas.");
  }
  await prisma.task.deleteMany({ where: { proyectoId: taskId } });
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath("/tareas");
  revalidatePath("/calendario");
}
