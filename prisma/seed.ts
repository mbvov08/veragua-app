import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash("M1092851991", 10);
  const empleadaPasswordHash = await bcrypt.hash("Veragua2026*", 10);

  const admin = await prisma.user.upsert({
    where: { username: "manuelaboterov08" },
    update: { passwordHash: adminPasswordHash },
    create: {
      username: "manuelaboterov08",
      name: "Manuela",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  const empleada = await prisma.user.upsert({
    where: { username: "danielao26" },
    update: { passwordHash: empleadaPasswordHash },
    create: {
      username: "danielao26",
      name: "Daniela",
      passwordHash: empleadaPasswordHash,
      role: "EMPLEADA",
    },
  });

  await prisma.employeeProfile.upsert({
    where: { userId: empleada.id },
    update: {},
    create: {
      userId: empleada.id,
      salarioBase: 0,
      fechaIngreso: new Date(),
      auxTransporte: true,
    },
  });

  await prisma.payrollSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      // Valores de referencia 2025 — DEBEN confirmarse/actualizarse en Ajustes de Nómina.
      smlmv: 1423500,
      auxilioTransporte: 200000,
      porcentajeSalud: 0.04,
      porcentajePension: 0.04,
      horasSemanaLegal: 42,
      topeAuxTransporteSmlmv: 2,
    },
  });

  console.log("Seed completo. Usuarios:", { admin: admin.username, empleada: empleada.username });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
