import "server-only";

const PAGE = 1000; // Supabase devuelve como máximo 1000 filas por consulta.

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Trae todas las filas de una consulta, página por página. */
export async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await page(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}
