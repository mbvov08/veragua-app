# Veragua — Operaciones internas

App interna para Veragua: control de personal, nómina, pedidos, tareas, recordatorios y calendario compartido.

Construida con Next.js (App Router), Prisma + PostgreSQL, y NextAuth (Credentials).

## Desarrollo local

1. Copia `.env.example` a `.env` y completa `DATABASE_URL` (Postgres) y `AUTH_SECRET`.
2. Instala dependencias y prepara la base de datos:

   ```bash
   npm install
   npx prisma db push
   npm run seed
   ```

3. Levanta el servidor:

   ```bash
   npm run dev
   ```

`npm run seed` crea las dos cuentas de la app (administradora y empleada) y valores de referencia de nómina. Si ya existen, no los duplica.

## Desplegar a producción (Supabase + Vercel)

Ver la guía completa en el mensaje de entrega / chat. Resumen:

1. Crear un proyecto en [Supabase](https://supabase.com) y copiar el "Connection string" (modo *Transaction pooler*, puerto 6543).
2. Subir este código a un repositorio de GitHub.
3. Importar el repositorio en [Vercel](https://vercel.com), configurar las variables de entorno `DATABASE_URL` y `AUTH_SECRET`, y desplegar.
4. Ejecutar una sola vez `npx prisma db push` y `npm run seed` apuntando a la base de datos de producción.

## Notas importantes

- Los valores de SMLMV y auxilio de transporte usados en Nómina son de referencia y deben actualizarse cada año en **Nómina → Ajustes**.
- Los pedidos y recordatorios recurrentes se generan automáticamente cada vez que alguien abre la app (no requiere tareas programadas externas).
