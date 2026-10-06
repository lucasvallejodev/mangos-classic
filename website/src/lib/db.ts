import mysql from "mysql2/promise";
import { env } from "./env";

const globalForDb = globalThis as unknown as { __pool?: mysql.Pool };

// One pool for all three databases; queries qualify table names with C/W/R below.
export const pool =
  globalForDb.__pool ??
  (globalForDb.__pool = mysql.createPool({
    ...env.db,
    connectionLimit: 5,
    charset: "utf8mb4",
    supportBigNumbers: true,
    // int columns come back as numbers; bigint timestamps fit in a double
    bigNumberStrings: false,
    decimalNumbers: true,
  }));

const id = (name: string) => "`" + name.replace(/`/g, "") + "`";
export const C = id(env.charDb);
export const W = id(env.worldDb);
export const R = id(env.realmDb);

export type Row = Record<string, unknown>;
export type Querier = Pick<mysql.Pool, "query">;

export async function q<T = Row>(sql: string, params: unknown[] = [], conn: Querier = pool): Promise<T[]> {
  const [rows] = await conn.query(sql, params);
  return rows as T[];
}
