import axios from "axios";
import * as cheerio from "cheerio";
import { createHash } from "crypto";
import Parser from "rss-parser";

const USER_AGENT =
  "Mozilla/5.0 (compatible; GTMPlatformBot/1.0; +https://gtm-platform.com)";
const REQUEST_TIMEOUT = 15_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CrawlResult {
  url: string;
  title: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Single page
// ---------------------------------------------------------------------------
export async function crawlSinglePage(url: string): Promise<CrawlResult> {
  const { data: html } = await axios.get<string>(url, {
    headers: { "User-Agent": USER_AGENT },
    timeout: REQUEST_TIMEOUT,
    maxRedirects: 5,
  });

  const $ = cheerio.load(html);

  // Remove non-content elements
  $("script, style, nav, footer, header, noscript, iframe, svg").remove();

  // Try to extract main content area first, fall back to body
  const main =
    $("article").text() ||
    $("main").text() ||
    $('[role="main"]').text() ||
    $("body").text();

  const title = $("title").text().trim() || new URL(url).hostname;
  const text = main.replace(/\s+/g, " ").trim();

  return { url, title, text };
}

// ---------------------------------------------------------------------------
// Site crawl (BFS, same-domain, up to maxPages)
// ---------------------------------------------------------------------------
export async function crawlSite(
  startUrl: string,
  maxPages = 20
): Promise<CrawlResult[]> {
  const origin = new URL(startUrl).origin;
  const visited = new Set<string>();
  const queue: string[] = [startUrl];
  const results: CrawlResult[] = [];

  while (queue.length > 0 && results.length < maxPages) {
    const url = queue.shift()!;
    const normalized = normalizeUrl(url);
    if (visited.has(normalized)) continue;
    visited.add(normalized);

    try {
      const { data: html } = await axios.get<string>(url, {
        headers: { "User-Agent": USER_AGENT },
        timeout: REQUEST_TIMEOUT,
        maxRedirects: 5,
      });

      const $ = cheerio.load(html);

      // Collect same-origin links for BFS
      $("a[href]").each((_, el) => {
        try {
          const href = new URL($(el).attr("href")!, url).href;
          if (href.startsWith(origin) && !visited.has(normalizeUrl(href))) {
            queue.push(href);
          }
        } catch {
          // ignore invalid URLs
        }
      });

      $("script, style, nav, footer, header, noscript, iframe, svg").remove();
      const main =
        $("article").text() ||
        $("main").text() ||
        $('[role="main"]').text() ||
        $("body").text();
      const title = $("title").text().trim() || new URL(url).hostname;
      const text = main.replace(/\s+/g, " ").trim();

      if (text.length > 50) {
        results.push({ url, title, text });
      }
    } catch (err) {
      console.warn(`Failed to crawl ${url}:`, (err as Error).message);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Sitemap crawl
// ---------------------------------------------------------------------------
export async function crawlSitemap(
  sitemapUrl: string
): Promise<CrawlResult[]> {
  const { data: xml } = await axios.get<string>(sitemapUrl, {
    headers: { "User-Agent": USER_AGENT },
    timeout: REQUEST_TIMEOUT,
  });

  const $ = cheerio.load(xml, { xmlMode: true });
  const urls: string[] = [];
  $("url > loc").each((_, el) => {
    urls.push($(el).text().trim());
  });

  // Crawl up to 50 pages from sitemap
  const results: CrawlResult[] = [];
  for (const url of urls.slice(0, 50)) {
    try {
      const result = await crawlSinglePage(url);
      if (result.text.length > 50) {
        results.push(result);
      }
    } catch (err) {
      console.warn(`Failed to crawl sitemap URL ${url}:`, (err as Error).message);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// RSS feed
// ---------------------------------------------------------------------------
export async function crawlRss(feedUrl: string): Promise<CrawlResult[]> {
  const parser = new Parser();
  const feed = await parser.parseURL(feedUrl);

  const results: CrawlResult[] = [];
  // Process up to 20 most recent items
  for (const item of (feed.items || []).slice(0, 20)) {
    const url = item.link;
    if (!url) continue;

    try {
      const result = await crawlSinglePage(url);
      results.push(result);
    } catch (err) {
      // Fall back to RSS content if page can't be crawled
      const text = item.contentSnippet || item.content || item.summary || "";
      if (text.length > 50) {
        results.push({
          url,
          title: item.title || url,
          text: text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(),
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Content hash for change detection
// ---------------------------------------------------------------------------
export function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.href.replace(/\/+$/, "");
  } catch {
    return url;
  }
}
