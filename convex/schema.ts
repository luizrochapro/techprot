import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  networks: defineTable({
    name: v.string(),
    xml: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
});
