import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash("M1092851991", 10);
  const empleadaPasswordHash = await bcrypt.hash("Veragua2026*", 10);
  const galponPasswordHash = await bcrypt.hash("Laquinta2026", 10);

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
      name: "Daniela Osorio",
      passwordHash: empleadaPasswordHash,
      role: "EMPLEADA",
    },
  });

  const galpon = await prisma.user.upsert({
    where: { username: "omar2026" },
    update: { passwordHash: galponPasswordHash },
    create: {
      username: "omar2026",
      name: "Omar",
      passwordHash: galponPasswordHash,
      role: "GALPON",
    },
  });

  await prisma.employeeProfile.upsert({
    where: { userId: empleada.id },
    update: {},
    create: {
      userId: empleada.id,
      cedula: "1094955825",
      salarioBase: 1750905,
      fechaIngreso: new Date(Date.UTC(2026, 0, 1, 12)),
      auxTransporte: true,
      extraQuincenal: 50000,
      extraQuincenalLabel: "Domicilios",
    },
  });

  await prisma.payrollSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      // Valores oficiales 2026 confirmados.
      smlmv: 1750905,
      auxilioTransporte: 249095,
      porcentajeSalud: 0.04,
      porcentajePension: 0.04,
      horasSemanaLegal: 42,
      divisorHorasMensual: 220,
      topeAuxTransporteSmlmv: 2,
    },
  });

  await prisma.cajaSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", baseInicial: 0 },
  });

  // Receta Melcoch — Brownie de Milo Caja Plástica x6 (cantidad por mezcla).
  const ingredientesMelcoch: { nombre: string; unidad: string; cantidadPorMezcla: number }[] = [
    { nombre: "Harina", unidad: "g", cantidadPorMezcla: 315 },
    { nombre: "Milo", unidad: "g", cantidadPorMezcla: 230 },
    { nombre: "Azúcar", unidad: "g", cantidadPorMezcla: 520 },
    { nombre: "Huevos", unidad: "unidad", cantidadPorMezcla: 5 },
    { nombre: "Mantequilla", unidad: "g", cantidadPorMezcla: 155 },
    { nombre: "Sal", unidad: "g", cantidadPorMezcla: 9 },
    { nombre: "Polvo de hornear", unidad: "g", cantidadPorMezcla: 7 },
    { nombre: "Envase plástico", unidad: "unidad", cantidadPorMezcla: 6 },
  ];
  for (const ing of ingredientesMelcoch) {
    await prisma.melcochIngrediente.upsert({
      where: { nombre: ing.nombre },
      update: { unidad: ing.unidad, cantidadPorMezcla: ing.cantidadPorMezcla },
      create: ing,
    });
  }

  // Producción real del galpón (septiembre 2026) reportada por Omar.
  const produccionGalpon: { d: number; prod: number; rotos: number }[] = [
    { d: 1, prod: 201, rotos: 2 },
    { d: 2, prod: 214, rotos: 6 },
    { d: 3, prod: 188, rotos: 3 },
    { d: 4, prod: 198, rotos: 0 },
    { d: 5, prod: 205, rotos: 3 },
    { d: 6, prod: 208, rotos: 6 },
    { d: 7, prod: 197, rotos: 3 },
  ];
  for (const { d, prod, rotos } of produccionGalpon) {
    const fecha = new Date(Date.UTC(2026, 8, d, 12));
    await prisma.registroGalpon.upsert({
      where: { userId_fecha: { userId: galpon.id, fecha } },
      update: { huevosProducidos: prod, huevosRotos: rotos },
      create: { userId: galpon.id, fecha, huevosProducidos: prod, huevosRotos: rotos },
    });
  }

  // Recordatorio recurrente: montar pedido de lácteos de Sanorigen, miércoles.
  const sanorigenExiste = await prisma.reminderRule.findFirst({
    where: { titulo: "Montar pedido de lácteos de Sanorigen" },
  });
  if (!sanorigenExiste) {
    await prisma.reminderRule.create({
      data: { titulo: "Montar pedido de lácteos de Sanorigen", diaSemana: 3, creadoPorId: admin.id },
    });
  }

  // Pedido fijo recurrente: Mayra Alejandra Ramírez, 1 cubeta de huevos, viernes.
  let reglaMayra = await prisma.recurringOrderRule.findFirst({
    where: { cliente: "Mayra Alejandra Ramírez" },
  });
  if (!reglaMayra) {
    reglaMayra = await prisma.recurringOrderRule.create({
      data: {
        cliente: "Mayra Alejandra Ramírez",
        direccion: "Cr 19 #10N-60A, Las Ramblas",
        telefono: null,
        zona: "LOCAL",
        diaSemana: 5,
        notas: "1 cubeta de huevos",
        creadoPorId: admin.id,
      },
    });
  }
  const proximoViernesMayra = new Date(Date.UTC(2026, 8, 11, 12));
  await prisma.order.upsert({
    where: {
      recurringRuleId_fechaEntrega: { recurringRuleId: reglaMayra.id, fechaEntrega: proximoViernesMayra },
    },
    update: {},
    create: {
      cliente: reglaMayra.cliente,
      direccion: reglaMayra.direccion,
      telefono: reglaMayra.telefono,
      zona: reglaMayra.zona,
      fechaEntrega: proximoViernesMayra,
      notas: reglaMayra.notas,
      recurringRuleId: reglaMayra.id,
      creadoPorId: admin.id,
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
