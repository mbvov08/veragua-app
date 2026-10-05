/**
 * Igual que Promise.all(items.map(fn)), pero sin disparar más de `limit` llamadas a la
 * vez. Evita agotar el pool de conexiones de Prisma (17 por defecto) cuando se procesan
 * muchos productos en paralelo — cada uno dispara varias queries propias.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
