import { sql } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const invoicesTable = sqliteTable("invoices_table", {
  id: int().primaryKey({ autoIncrement: true }),
  created_at: int({
    mode: 'timestamp_ms',
  }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: int({
    mode: 'timestamp_ms',
  }).notNull().default(sql`CURRENT_TIMESTAMP`),
  expires_at: int({
    mode: 'timestamp_ms',
  }).notNull(),
  network: text().notNull(),
  mnemonic: text().notNull(),
  offers_json: text().notNull(),
  webhook_url: text().notNull(),
  sweep_address: text().notNull(),
  spark_address: text().notNull(),
  sending_address: text(),
  lightning_invoice: text().notNull(),
  paid: int({
    mode: 'boolean',
  }).notNull().default(false),
});