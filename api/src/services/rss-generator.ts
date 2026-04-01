import { createHash } from "node:crypto";
import { getMimeType, type ProviderId } from "./provider.js";

export interface FeedConfig {
  id: string;
  title: string;
  description: string;
  author: string;
  email: string;
  language: string;
  category: string;
  explicit: boolean;
  imageUrl: string;
  provider: ProviderId;
  folderPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface Episode {
  id: string;
  filename: string;
  providerPath: string;
  sharedLink: string;
  size: number;
  mimeType: string;
  modifiedAt: string;
}

export interface FeedCache {
  feedId: string;
  lastRefreshed: string;
  episodes: Episode[];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc2822(date: string): string {
  return new Date(date).toUTCString();
}

function episodeTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
}

function episodeGuid(providerPath: string): string {
  return createHash("sha256").update(providerPath).digest("hex").slice(0, 16);
}

export function generateRssXml(
  feed: FeedConfig,
  episodes: Episode[],
  feedUrl: string
): string {
  const sorted = [...episodes].sort(
    (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
  );

  const items = sorted
    .map(
      (ep) => `    <item>
      <title>${escapeXml(episodeTitle(ep.filename))}</title>
      <enclosure url="${escapeXml(ep.sharedLink)}" length="${ep.size}" type="${ep.mimeType}" />
      <guid isPermaLink="false">${episodeGuid(ep.providerPath)}</guid>
      <pubDate>${toRfc2822(ep.modifiedAt)}</pubDate>
      <description>${escapeXml(episodeTitle(ep.filename))}</description>
      <itunes:explicit>${feed.explicit ? "true" : "false"}</itunes:explicit>
    </item>`
    )
    .join("\n");

  const title = feed.title || "Untitled Podcast";
  const description = feed.description || title;
  const author = feed.author || title;
  const language = feed.language || "en";

  const optionalTags = [
    feed.email ? `    <itunes:owner>\n      <itunes:name>${escapeXml(author)}</itunes:name>\n      <itunes:email>${escapeXml(feed.email)}</itunes:email>\n    </itunes:owner>` : "",
    feed.category ? `    <itunes:category text="${escapeXml(feed.category)}" />` : "",
    feed.imageUrl ? `    <itunes:image href="${escapeXml(feed.imageUrl)}" />` : "",
  ].filter(Boolean).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <description>${escapeXml(description)}</description>
    <language>${escapeXml(language)}</language>
    <link>${escapeXml(feedUrl)}</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <itunes:author>${escapeXml(author)}</itunes:author>
    <itunes:explicit>${feed.explicit ? "true" : "false"}</itunes:explicit>
${optionalTags}
${items}
  </channel>
</rss>`;
}

export function createEpisodeFromFile(
  file: { name: string; path: string; size: number; modified: string },
  sharedLink: string
): Episode {
  return {
    id: episodeGuid(file.path),
    filename: file.name,
    providerPath: file.path,
    sharedLink,
    size: file.size,
    mimeType: getMimeType(file.name),
    modifiedAt: file.modified,
  };
}

/** Normalize legacy feed configs that used `dropboxFolder` / no `provider` field */
export function normalizeFeedConfig(raw: Record<string, unknown>): FeedConfig {
  const feed = raw as FeedConfig;
  if (!feed.provider) {
    feed.provider = "dropbox";
  }
  if (!feed.folderPath && (raw as { dropboxFolder?: string }).dropboxFolder) {
    feed.folderPath = (raw as { dropboxFolder?: string }).dropboxFolder!;
  }
  return feed;
}
