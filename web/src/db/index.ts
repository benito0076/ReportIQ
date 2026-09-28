import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definida");
  const client = postgres(url, {
    // Pooler de Supabase/Neon en modo transacción: sin consultas preparadas.
    prepare: false,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
  });
  return drizzle(client, { schema });
}

type Db = ReturnType<typeof createDb>;

// Reutiliza la conexión entre recargas en caliente durante el desarrollo.
const globalForDb = globalThis as unknown as { __db?: Db };

export const db: Db = globalForDb.__db ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

export type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Transaction;
