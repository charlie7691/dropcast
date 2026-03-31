import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { jwtAuth } from "../middleware/jwt.js";
import { getStorage } from "../services/storage.js";
import { log } from "../services/logger.js";
import type { FeedConfig, FeedCache } from "../services/rss-generator.js";

const feeds = new Hono();

feeds.use("*", jwtAuth);

feeds.get("/", async (c) => {
  const storage = getStorage();
  const keys = await storage.list("feeds");
  const feedList: FeedConfig[] = [];

  for (const key of keys) {
    const feed = await storage.readJson<FeedConfig>(key);
    if (feed) feedList.push(feed);
  }

  return c.json({ feeds: feedList });
});

feeds.post("/", async (c) => {
  const body = await c.req.json<Omit<FeedConfig, "id" | "createdAt" | "updatedAt">>();
  const storage = getStorage();

  const feed: FeedConfig = {
    ...body,
    id: randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await storage.writeJson(`feeds/${feed.id}.json`, feed);
  await log("feed_created", `Created feed "${feed.title}" (${feed.id})`);

  return c.json(feed, 201);
});

feeds.get("/:id", async (c) => {
  const id = c.req.param("id");
  const storage = getStorage();

  const feed = await storage.readJson<FeedConfig>(`feeds/${id}.json`);
  if (!feed) return c.json({ error: "Feed not found" }, 404);

  const cache = await storage.readJson<FeedCache>(`cache/${id}-meta.json`);

  return c.json({
    ...feed,
    episodeCount: cache?.episodes?.length || 0,
    lastRefreshed: cache?.lastRefreshed || null,
    episodes: cache?.episodes || [],
  });
});

feeds.put("/:id", async (c) => {
  const id = c.req.param("id");
  const storage = getStorage();

  const existing = await storage.readJson<FeedConfig>(`feeds/${id}.json`);
  if (!existing) return c.json({ error: "Feed not found" }, 404);

  const body = await c.req.json<Partial<FeedConfig>>();
  const updated: FeedConfig = {
    ...existing,
    ...body,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await storage.writeJson(`feeds/${id}.json`, updated);
  await log("feed_updated", `Updated feed "${updated.title}" (${id})`);

  return c.json(updated);
});

feeds.post("/:id/refresh", async (c) => {
  const id = c.req.param("id");
  const storage = getStorage();

  const feed = await storage.readJson<FeedConfig>(`feeds/${id}.json`);
  if (!feed) return c.json({ error: "Feed not found" }, 404);

  // Clear cache timestamp to force refresh on next RSS access
  const cache = await storage.readJson<FeedCache>(`cache/${id}-meta.json`);
  if (cache) {
    cache.lastRefreshed = "";
    await storage.writeJson(`cache/${id}-meta.json`, cache);
  }

  await log("feed_force_refresh", `Force refresh queued for "${feed.title}" (${id})`);
  return c.json({ refreshQueued: true });
});

feeds.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const storage = getStorage();

  const feed = await storage.readJson<FeedConfig>(`feeds/${id}.json`);
  if (!feed) return c.json({ error: "Feed not found" }, 404);

  await storage.delete(`feeds/${id}.json`);
  await storage.delete(`cache/${id}.xml`);
  await storage.delete(`cache/${id}-meta.json`);
  await log("feed_deleted", `Deleted feed "${feed.title}" (${id})`);

  return c.json({ deleted: true });
});

export default feeds;
