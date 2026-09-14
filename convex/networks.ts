import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("networks").collect();
  },
});

export const get = query({
  args: { id: v.id("networks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("networks")),
    name: v.string(),
    xml: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.id !== undefined) {
      const existing = await ctx.db.get(args.id);
      if (existing) {
        await ctx.db.patch(args.id, {
          name: args.name,
          xml: args.xml,
          updatedAt: now,
        });
        return args.id;
      }
    }
    return await ctx.db.insert("networks", {
      name: args.name,
      xml: args.xml,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("networks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});
