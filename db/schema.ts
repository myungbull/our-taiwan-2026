import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', { key: text('key').primaryKey(), value: text('value').notNull(), revision: integer('revision').notNull().default(1) });
