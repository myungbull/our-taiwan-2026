import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', { key: text('key').primaryKey(), value: text('value').notNull(), revision: integer('revision').notNull().default(1) });

export const ideas = sqliteTable('ideas', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  url: text('url').notNull().default(''),
  note: text('note').notNull().default(''),
  place: text('place').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  preferredDate: text('preferred_date'),
  suggestions: text('suggestions').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('ideas_updated_at_idx').on(table.updatedAt)]);

export const ideaVotes = sqliteTable('idea_votes', {
  ideaId: text('idea_id').notNull().references(() => ideas.id, { onDelete: 'cascade' }),
  slotId: text('slot_id').notNull(),
  userId: text('user_id').notNull(),
  response: text('response', { enum: ['yes', 'no'] }).notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.ideaId, table.slotId, table.userId] }),
  index('idea_votes_idea_slot_idx').on(table.ideaId, table.slotId),
]);

export const photos = sqliteTable('photos', {
  id: text('id').primaryKey(),
  tripDate: text('trip_date').notNull(),
  place: text('place').notNull().default(''),
  caption: text('caption').notNull().default(''),
  uploaderId: text('uploader_id').notNull(),
  uploaderLabel: text('uploader_label').notNull(),
  uploadedAt: text('uploaded_at').notNull(),
  objectKey: text('object_key').notNull().unique(),
  contentType: text('content_type').notNull().default('image/webp'),
  byteSize: integer('byte_size').notNull(),
}, (table) => [index('photos_trip_date_idx').on(table.tripDate, table.uploadedAt)]);
