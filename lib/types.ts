// Tipos de las tablas de Supabase (ver supabase/migrations/0001_tablas.sql).

export const ACCOUNT_TYPES = ["debito", "credito", "efectivo", "ahorro"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  debito: "Débito",
  credito: "Crédito",
  efectivo: "Efectivo",
  ahorro: "Ahorro",
};

export type Account = {
  id: string;
  nombre: string;
  tipo: AccountType;
  dia_corte: number | null;
  dia_limite_pago: number | null;
  saldo_actual: number;
  ultimos4: string | null;
};

export type Category = {
  id: string;
  nombre: string;
  presupuesto_mensual: number;
  color_neutro: string;
};

export type TransactionType = "gasto" | "ingreso";

export type Transaction = {
  id: string;
  account_id: string | null;
  fecha: string; // YYYY-MM-DD
  descripcion_original: string;
  comercio: string | null;
  monto: number;
  tipo: TransactionType;
  category_id: string | null;
  requiere_revision: boolean;
  es_recurrente: boolean;
  hash_unico: string;
  import_id: string | null;
};

export type TransactionWithRefs = Transaction & {
  categories: Pick<Category, "nombre" | "color_neutro"> | null;
  accounts: Pick<Account, "nombre"> | null;
};

/** Resultado estándar de las acciones de servidor de los formularios. */
export type ActionState = {
  ok: boolean;
  error?: string;
  /** El movimiento ya existía (misma fecha, monto y descripción). */
  duplicate?: boolean;
};

export const INITIAL_ACTION_STATE: ActionState = { ok: false };

/** Tonos neutros disponibles para identificar categorías. */
export const NEUTRAL_COLORS = [
  "#171717",
  "#404040",
  "#525252",
  "#737373",
  "#8a8a8a",
  "#a3a3a3",
  "#bdbdbd",
  "#d4d4d4",
] as const;
