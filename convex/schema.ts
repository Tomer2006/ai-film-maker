import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const jobStatus = v.union(
  v.literal("queued"),
  v.literal("generating"),
  v.literal("completed"),
  v.literal("failed"),
);

export default defineSchema({
  movies: defineTable({
    userId: v.string(),
    title: v.string(),
    concept: v.string(),
    plotOverview: v.string(),
    script: v.string(),
    visualStyle: v.string(),
    createdAt: v.number(),
  }).index("by_userId_createdAt", ["userId", "createdAt"]),

  jobs: defineTable({
    movieId: v.id("movies"),
    userId: v.string(),
    status: jobStatus,
    progress: v.number(),
    message: v.string(),
    finalVideoUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_movieId", ["movieId"]),
});
