"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Solo la administradora puede gestionar usuarios.");
  }
  return session;
}

export async function createUser(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "EMPLEADA");

  if (!name || !username || !password) throw new Error("Completa nombre, usuario y contraseña.");
  if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  if (!["ADMIN", "EMPLEADA", "GALPON"].includes(role)) throw new Error("Rol inválido.");

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) throw new Error("Ya existe un usuario con ese nombre de usuario.");

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { name, username, passwordHash, role } });

  revalidatePath("/usuarios");
  revalidatePath("/nomina/ajustes");
}

export async function toggleUserActive(userId: string, activo: boolean) {
  await requireAdmin();
  await prisma.user.update({ where: { id: userId }, data: { activo } });
  revalidatePath("/usuarios");
}

export async function resetUserPassword(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!userId || password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  revalidatePath("/usuarios");
}
