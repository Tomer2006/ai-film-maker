import {
  mutationGeneric,
  queryGeneric,
  type FunctionReference,
} from "convex/server";
import { v } from "convex/values";

type MutationRef = FunctionReference<"mutation">;

const updateJobProgressRef =
  "movies:updateJobProgress" as unknown as MutationRef;
const completeJobRef = "movies:completeJob" as unknown as MutationRef;

export const createMovie = mutationGeneric({
  args: {
    userId: v.string(),
    title: v.string(),
    concept: v.string(),
    plotOverview: v.string(),
    script: v.string(),
    visualStyle: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("movies", {
      ...args,
      createdAt: now,
    });
  },
});

export const startJob = mutationGeneric({
  args: {
    movieId: v.id("movies"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const jobId = await ctx.db.insert("jobs", {
      movieId: args.movieId,
      userId: args.userId,
      status: "queued",
      progress: 0,
      message: "Job queued",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, updateJobProgressRef, {
      jobId,
      status: "generating",
      progress: 10,
      message: "Preparing story breakdown",
    });
    await ctx.scheduler.runAfter(1500, updateJobProgressRef, {
      jobId,
      status: "generating",
      progress: 35,
      message: "Generating shots and scene visuals",
    });
    await ctx.scheduler.runAfter(3500, updateJobProgressRef, {
      jobId,
      status: "generating",
      progress: 65,
      message: "Generating narration, dialogue, and soundtrack",
    });
    await ctx.scheduler.runAfter(5500, updateJobProgressRef, {
      jobId,
      status: "generating",
      progress: 90,
      message: "Final audio/video render",
    });
    await ctx.scheduler.runAfter(7000, completeJobRef, {
      jobId,
      finalVideoUrl:
        "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    });

    return jobId;
  },
});

export const createMovieAndStartJob = mutationGeneric({
  args: {
    userId: v.string(),
    title: v.string(),
    concept: v.string(),
    plotOverview: v.string(),
    script: v.string(),
    visualStyle: v.string(),
  },
  handler: async (ctx, args) => {
    const movieId = await ctx.runMutation(
      "movies:createMovie" as unknown as MutationRef,
      {
        userId: args.userId,
        title: args.title,
        concept: args.concept,
        plotOverview: args.plotOverview,
        script: args.script,
        visualStyle: args.visualStyle,
      },
    );

    return await ctx.runMutation("movies:startJob" as unknown as MutationRef, {
      movieId,
      userId: args.userId,
    });
  },
});

export const updateJobProgress = mutationGeneric({
  args: {
    jobId: v.id("jobs"),
    status: v.union(v.literal("queued"), v.literal("generating")),
    progress: v.number(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.jobId);
    if (!existing) {
      return null;
    }

    await ctx.db.patch(args.jobId, {
      status: args.status,
      progress: args.progress,
      message: args.message,
      error: undefined,
      updatedAt: Date.now(),
    });

    return args.jobId;
  },
});

export const completeJob = mutationGeneric({
  args: {
    jobId: v.id("jobs"),
    finalVideoUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.jobId);
    if (!existing) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: "completed",
      progress: 100,
      message: "Movie ready",
      finalVideoUrl: args.finalVideoUrl,
      error: undefined,
      updatedAt: now,
      completedAt: now,
    });

    return args.jobId;
  },
});

export const failJob = mutationGeneric({
  args: {
    jobId: v.id("jobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.jobId);
    if (!existing) {
      return null;
    }

    await ctx.db.patch(args.jobId, {
      status: "failed",
      message: "Generation failed",
      error: args.error,
      updatedAt: Date.now(),
    });

    return args.jobId;
  },
});

export const getJob = queryGeneric({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }

    const movie = await ctx.db.get(job.movieId);
    return {
      ...job,
      movieTitle: movie?.title ?? "Untitled movie",
    };
  },
});

export const listJobsByUser = queryGeneric({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .collect();

    jobs.sort((a, b) => b.createdAt - a.createdAt);

    const movieIds = [...new Set(jobs.map((job) => job.movieId))];
    const movies = await Promise.all(movieIds.map((movieId) => ctx.db.get(movieId)));
    const moviesById = new Map(
      movies.filter((movie) => movie).map((movie) => [movie!._id, movie!]),
    );

    return jobs.map((job) => ({
      ...job,
      movieTitle: moviesById.get(job.movieId)?.title ?? "Untitled movie",
    }));
  },
});
