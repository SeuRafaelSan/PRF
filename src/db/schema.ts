import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), 
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userStats = pgTable('user_stats', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  videoLessons: integer('video_lessons').default(0),
  simulations: integer('simulations').default(0),
  questions: integer('questions').default(0),
  performance: integer('performance').default(0),
  studyDays: integer('study_days').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ one }) => ({
  stats: one(userStats),
}));

export const userStatsRelations = relations(userStats, ({ one }) => ({
  user: one(users, {
    fields: [userStats.userId],
    references: [users.id],
  }),
}));
