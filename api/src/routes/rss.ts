import { Hono } from "hono";
import { getStorage } from "../services/storage.js";
import { getProvider } from "../services/provider.js";
import {
  generateRssXml,
  createEpisodeFromFile,
  normalizeFeedConfig,
  type FeedConfig,
  type FeedCache,
  type Episode,
} from "../services/rss-generator.js";
import { log } from "../services/logger.js";

const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const rss = new Hono();

rss.get("/:id", async (c) => {
  const id = c.req.param("id");
  const storage = getStorage();

  const raw = await storage.readJson<Record<string, unknown>>(`feeds/${id}.json`);
  if (!raw) {
    return c.text("Feed not found", 404);
  }
  const feed = normalizeFeedConfig(raw);

  const cache = await storage.readJson<FeedCache>(`cache/${id}-meta.json`);
  const now = Date.now();
  const lastRefreshed = cache?.lastRefreshed
    ? new Date(cache.lastRefreshed).getTime()
    : 0;

  const needsRefresh = now - lastRefreshed > REFRESH_INTERVAL_MS;

  if (needsRefresh) {
    try {
      const updatedCache = await refreshFeed(feed, cache);
      const feedUrl = new URL(`/rss/${id}`, c.req.url).toString();
      const xml = generateRssXml(feed, updatedCache.episodes, feedUrl);

      await storage.writeJson(`cache/${id}-meta.json`, updatedCache);
      await storage.writeText(`cache/${id}.xml`, xml);

      c.header("Content-Type", "application/rss+xml; charset=utf-8");
      return c.body(xml);
    } catch (err) {
      const staleXml = await storage.readText(`cache/${id}.xml`);
      if (staleXml) {
        await log(
          "rss_refresh_error",
          `Feed "${feed.title}" refresh failed, serving stale cache: ${err instanceof Error ? err.message : "Unknown error"}`
        );
        c.header("Content-Type", "application/rss+xml; charset=utf-8");
        return c.body(staleXml);
      }
      return c.text("Feed refresh failed and no cache available", 500);
    }
  }

  const cachedXml = await storage.readText(`cache/${id}.xml`);
  if (cachedXml) {
    c.header("Content-Type", "application/rss+xml; charset=utf-8");
    return c.body(cachedXml);
  }

  try {
    const updatedCache = await refreshFeed(feed, null);
    const feedUrl = new URL(`/rss/${id}`, c.req.url).toString();
    const xml = generateRssXml(feed, updatedCache.episodes, feedUrl);

    await storage.writeJson(`cache/${id}-meta.json`, updatedCache);
    await storage.writeText(`cache/${id}.xml`, xml);

    c.header("Content-Type", "application/rss+xml; charset=utf-8");
    return c.body(xml);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return c.text(`Feed generation failed: ${msg}`, 500);
  }
});

async function refreshFeed(
  feed: FeedConfig,
  existingCache: FeedCache | null
): Promise<FeedCache> {
  const provider = await getProvider(feed.provider);
  const files = await provider.listFiles(feed.folderPath);

  // Build a map of existing episodes by path for link reuse
  const existingByPath = new Map<string, Episode>();
  if (existingCache?.episodes) {
    for (const ep of existingCache.episodes) {
      existingByPath.set(ep.providerPath, ep);
    }
  }

  const episodes: Episode[] = [];
  let newCount = 0;

  for (const file of files) {
    const existing = existingByPath.get(file.path);
    if (existing) {
      episodes.push(existing);
    } else {
      const link = await provider.getDownloadLink(file.path);
      episodes.push(createEpisodeFromFile(file, link));
      newCount++;
    }
  }

  await log(
    "rss_refreshed",
    `Feed "${feed.title}" (${feed.provider}): ${episodes.length} episodes (${newCount} new)`
  );

  return {
    feedId: feed.id,
    lastRefreshed: new Date().toISOString(),
    episodes,
  };
}

export default rss;
