import { json, decodeEntities, UA } from "../core/new-provider-utils.js";
import {
  get as cacheGet,
  set as cacheSet,
  SHOW_IDENTITY_TTL,
  WATCH_TTL,
} from "../core/smartcache.js";
import { getMedia } from "../core/anilist.js";
import { wreqFetch } from "../core/wreq.js";

const BASE = "https://donghuaworld.com";
const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": `${BASE}/`,
};

export async function smartFetch(url, options = {}) {
  const mergedHeaders = {
    ...H,
    ...(options.headers || {}),
  };
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await wreqFetch(url, {
        ...options,
        headers: mergedHeaders,
        browser: "chrome_149",
        os: "windows",
      });
      if (res && res.status !== 403) {
        return res;
      }
    } catch (err) {
      lastErr = err;
    }

    try {
      const res = await fetch(url, { ...options, headers: mergedHeaders });
      if (res && res.status !== 403) {
        return res;
      }
    } catch (err) {
      lastErr = err;
    }

    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr || new Error(`Failed to fetch ${url}`);
}

function stripTags(s) {
  return (s || "").replace(/<[^>]+>/g, "").trim();
}

/**
 * Parses episode ranges from AniList description
 * e.g. "Note: Episodes 86 to 260." => { start: 86, end: 260, offset: 85 }
 */
export function parseEpisodeRange(desc) {
  if (!desc) return null;
  const m = desc.match(/Episodes?\s*(\d+)\s*(?:to|-)\s*(\d+)/i);
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end < start) {
    return null;
  }
  return { start, end, offset: start - 1 };
}

/**
 * Pre-indexed canonical series mapping for instant, zero-delay resolution
 */
export const KNOWN_SERIES_MAP = {
  166219: `${BASE}/anime/swallowed-the-universe-warrior-of-galaxy/`, // Swallowed Star Season 4
  131580: `${BASE}/anime/swallowed-the-universe-warrior-of-galaxy/`, // Swallowed Star Season 1
  142750: `${BASE}/anime/swallowed-the-universe-warrior-of-galaxy/`, // Swallowed Star Season 2
  152864: `${BASE}/anime/swallowed-the-universe-warrior-of-galaxy/`, // Swallowed Star Season 3
  196613: `${BASE}/anime/battle-through-the-heavens-season-5/`, // BTTH Season 5 / Nian Fan 4
  168164: `${BASE}/anime/battle-through-the-heavens-season-5/`, // BTTH Nian Fan 3
  168163: `${BASE}/anime/battle-through-the-heavens-season-5/`, // BTTH Nian Fan 2
  131584: `${BASE}/anime/battle-through-the-heavens-season-4/`, // BTTH Season 4
  114123: `${BASE}/anime/battle-through-the-heavens-season-3/`, // BTTH Season 3
  107026: `${BASE}/anime/battle-through-the-heavens-season-2/`, // BTTH Season 2
  98314: `${BASE}/anime/battle-through-the-heavens-season-1/`, // BTTH Season 1
  152636: `${BASE}/anime/renegade-immortal-xian-ni/`, // Renegade Immortal
  131518: `${BASE}/anime/soul-land/`, // Soul Land 1
  156360: `${BASE}/anime/soul-land-2-unrivaled-tang-sect-season-6/`, // Soul Land 2
  132405: `${BASE}/anime/perfect-world/`, // Perfect World
  150073: `${BASE}/anime/a-will-eternal-season-3/`, // A Will Eternal Season 2/3
  120056: `${BASE}/anime/a-will-eternal/`, // A Will Eternal Season 1
  153070: `${BASE}/anime/shrouding-the-heavens/`, // Shrouding the Heavens
  160533: `${BASE}/anime/against-the-gods/`, // Against the Gods
  163262: `${BASE}/anime/martial-universe-season-4/`, // Martial Universe Season 4
  163273: `${BASE}/anime/the-great-ruler/`, // The Great Ruler
  143588: `${BASE}/anime/throne-of-seal/`, // Throne of Seal
  150336: `${BASE}/anime/jade-dynasty/`, // Jade Dynasty
  150337: `${BASE}/anime/stellar-transformation-season-5/`, // Stellar Transformation 5
  120055: `${BASE}/anime/a-record-of-a-mortals-journey-to-immortality/`, // RMJI 1
  142168: `${BASE}/anime/a-record-of-a-mortals-journey-to-immortality-season-2/`, // RMJI 2
  160534: `${BASE}/anime/a-record-of-a-mortals-journey-to-immortality-season-3/`, // RMJI 3
  115230: `${BASE}/anime/link-click/`, // Link Click 1
  141352: `${BASE}/anime/link-click-season-2/`, // Link Click 2
  101349: `${BASE}/anime/the-founder-of-diabolism/`, // Mo Dao Zu Shi 1
  108605: `${BASE}/anime/the-founder-of-diabolism-season-2/`, // Mo Dao Zu Shi 2
  116674: `${BASE}/anime/the-founder-of-diabolism-final-season/`, // Mo Dao Zu Shi 3
  112151: `${BASE}/anime/heaven-officials-blessing/`, // TGCF 1
  130545: `${BASE}/anime/heaven-officials-blessing-season-2/`, // TGCF 2
  142646: `${BASE}/anime/one-hundred-thousand-years-of-qi-refining/`, // 100,000 Years of Qi Refining
};

/**
 * Generates search queries for DonghuaWorld
 */
function generateSearchQueries(media) {
  const queries = new Set();
  const rawList = [
    media?.title?.english,
    media?.title?.romaji,
    ...(Array.isArray(media?.synonyms) ? media.synonyms : []),
  ].filter(Boolean);

  for (const t of rawList) {
    const isChinese = /[\u4e00-\u9fa5]/.test(t);
    if (isChinese) continue;

    const cleaned = t
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/\s*\[[^\]]*\]/g, "")
      .replace(/:\s*Season\s*\d+/gi, "")
      .replace(/\s*Season\s*\d+/gi, "")
      .replace(/:\s*Nian\s*Fan\s*\d+/gi, "")
      .replace(/\s*Nian\s*Fan\s*\d+/gi, "")
      .replace(/\s+S\d+/gi, "")
      .replace(/\s+\d+th$/i, "")
      .replace(/\s+\d+nd$/i, "")
      .replace(/\s+\d+rd$/i, "")
      .trim();

    if (cleaned.length >= 3) queries.add(cleaned);

    const baseCleaned = cleaned.replace(/\s+\d+$/, "").trim();
    if (baseCleaned.length >= 3) queries.add(baseCleaned);
  }

  return Array.from(queries);
}

/**
 * Searches DonghuaWorld for an anime title and returns the series URL
 */
export async function findSeriesUrl(anilistId, media) {
  const cacheKey = `dhw:series:${anilistId}`;
  const cached = cacheGet(cacheKey);
  if (cached && cached.data) return cached.data;

  // 1. Direct canonical map lookup
  const known = KNOWN_SERIES_MAP[Number(anilistId)];
  if (known) {
    cacheSet(cacheKey, known, SHOW_IDENTITY_TTL);
    return known;
  }

  const isMovie = media?.format === "MOVIE";
  const primaryTitle = media?.title?.english || media?.title?.romaji || "";
  const queries = generateSearchQueries(media);
  const range = parseEpisodeRange(media?.description);

  const allTitles = [
    primaryTitle,
    media?.title?.romaji,
    ...(Array.isArray(media?.synonyms) ? media.synonyms : []),
  ].filter(Boolean).join(" ");

  const seasonMatch = allTitles.match(/season\s*(\d+)/i) || allTitles.match(/(?:^|\s)(\d+)$/);
  const targetSeason = seasonMatch
    ? Number(seasonMatch[1])
    : (range && range.start >= 80 ? 4 : (range && range.start >= 50 ? 5 : null));

  for (const query of queries) {
    try {
      const searchUrl = `${BASE}/?s=${encodeURIComponent(query)}`;
      const res = await smartFetch(searchUrl);
      if (!res.ok) continue;
      const html = await res.text();

      const articles = Array.from(
        html.matchAll(/<article[^>]*>[\s\S]*?<a\s+href="(https:\/\/donghuaworld\.com\/anime\/[^"'/]+\/)"[^>]*>([\s\S]*?)<\/a>/gi)
      ).map((m) => ({
        link: m[1],
        title: stripTags(m[2]).replace(/\s+/g, " ").trim(),
      }));

      if (articles.length > 0) {
        let bestUrl = null;
        let bestScore = -999;

        for (const item of articles) {
          const lowerTitle = (item.title || "").toLowerCase();
          const lowerLink = item.link.toLowerCase();
          const pTitle = primaryTitle.toLowerCase();

          if (isMovie) {
            if (lowerTitle.includes("movie") || lowerLink.includes("movie")) {
              bestUrl = item.link;
              break;
            }
          } else {
            if (lowerTitle.includes("movie") || lowerLink.includes("movie")) continue;
          }

          if (!pTitle.includes("special") && (lowerTitle.includes("special") || lowerLink.includes("special"))) continue;

          let score = 10;
          const itemSeasonMatch = lowerTitle.match(/season\s*(\d+)/i) || lowerLink.match(/season-(\d+)/i);
          const itemSeason = itemSeasonMatch ? Number(itemSeasonMatch[1]) : (lowerTitle.includes("season 1") ? 1 : null);

          if (targetSeason !== null) {
            if (itemSeason === targetSeason) {
              score += 60;
            } else if (targetSeason >= 5 && itemSeason === 5) {
              score += 35;
            } else if (itemSeason !== null) {
              score -= 30;
            }
          } else if (range && range.start >= 50) {
            if (itemSeason === 5 || lowerLink.includes("season-5")) {
              score += 60;
            } else if (itemSeason === 1) {
              score -= 30;
            }
          } else {
            if (itemSeason === 1 || itemSeason === null) score += 15;
          }

          if (score > bestScore) {
            bestScore = score;
            bestUrl = item.link;
          }
        }

        if (!bestUrl && articles[0]?.link) bestUrl = articles[0].link;

        if (bestUrl) {
          cacheSet(cacheKey, bestUrl, SHOW_IDENTITY_TTL);
          return bestUrl;
        }
      }
    } catch (e) {
      console.warn(`[donghuaworld] Search query "${query}" failed:`, e.message);
    }
  }

  return null;
}

function episodeMeta(epNum, ctx) {
  const anizipEp = ctx?.anizip?.episodes?.[String(epNum)];
  return {
    title: anizipEp?.title?.en || anizipEp?.title?.["x-jat"] || null,
    airDate: anizipEp?.airdate || null,
    image: anizipEp?.image || ctx?.media?.coverImage?.extraLarge || null,
    duration: anizipEp?.runtime ? anizipEp.runtime * 60 : 1200,
    description: anizipEp?.summary || "",
  };
}

/**
 * Fetches episode list for an anime from DonghuaWorld
 */
export async function getEpisodes(anilistId, ctx = {}) {
  let media = ctx?.media;
  if (!media) {
    media = await getMedia(anilistId).catch(() => null);
  }

  const seriesUrl = await findSeriesUrl(anilistId, media);
  if (!seriesUrl) {
    throw new Error(`DonghuaWorld: Could not find series for AniList ID ${anilistId}`);
  }

  const res = await smartFetch(seriesUrl);
  if (!res.ok) {
    throw new Error(`DonghuaWorld: HTTP ${res.status} fetching series ${seriesUrl}`);
  }
  const html = await res.text();

  const startIdx = html.indexOf('class="eplister"');
  if (startIdx === -1) {
    throw new Error(`DonghuaWorld: eplister not found on ${seriesUrl}`);
  }
  const ulMatch = html.slice(startIdx).match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (!ulMatch) {
    throw new Error(`DonghuaWorld: No episode ul found inside eplister on ${seriesUrl}`);
  }

  const items = Array.from(
    ulMatch[1].matchAll(
      /<li[^>]*>[\s\S]*?<a\s+href="([^"]+)"[^>]*>[\s\S]*?<div\s+class="epl-num">([\s\S]*?)<\/div>[\s\S]*?(?:<div\s+class="epl-title">([\s\S]*?)<\/div>)?[\s\S]*?(?:<div\s+class="epl-date">([\s\S]*?)<\/div>)?[\s\S]*?<\/li>/gi
    )
  );

  if (!items.length) {
    throw new Error(`DonghuaWorld: No episodes parsed from ${seriesUrl}`);
  }

  const sub = [];

  for (const item of items) {
    const epUrl = item[1];
    const rawNum = stripTags(item[2] || "").trim();
    const rawTitle = stripTags(item[3] || "").trim();
    const rawDate = stripTags(item[4] || "").trim();

    if (!epUrl.includes("episode") && !epUrl.includes("-ep-")) continue;

    // Clean URL slug: remove resolution tags (-4k, -1080p, -720p) and suffixes before matching
    const cleanSlug = epUrl
      .replace(/https?:\/\/[^/]+\//, "")
      .replace(/\/$/, "")
      .replace(/-(?:4k|1080p|720p)/gi, "")
      .replace(/-multi-subtitles/gi, "")
      .replace(/-english-subbed/gi, "");

    let epNum = null;
    const epMatch = cleanSlug.match(/episode-(\d+)/i);
    if (epMatch) {
      epNum = Number(epMatch[1]);
    } else {
      const numMatch = rawNum.match(/^(\d+)/);
      if (numMatch) epNum = Number(numMatch[1]);
    }

    if (!epNum || !Number.isFinite(epNum) || epNum <= 0) continue;

    // Direct cache by exact episode number
    cacheSet(`dhw:ep:${anilistId}:${epNum}`, epUrl, SHOW_IDENTITY_TTL);

    const cleanTitle = rawTitle && !rawTitle.toLowerCase().includes("episode")
      ? `Episode ${epNum}: ${rawTitle}`
      : `Episode ${epNum}`;

    sub.push({
      id: `watch/donghuaworld/${anilistId}/sub/donghuaworld-${epNum}`,
      number: epNum,
      title: cleanTitle,
      duration: 1200,
      audio: "sub",
      filler: false,
      recap: false,
      uncensored: false,
      description: "",
      image: null,
      airDate: rawDate || null,
    });
  }

  // Deduplicate by episode number (keep newest / first parsed)
  const uniqueMap = new Map();
  for (const ep of sub) {
    if (!uniqueMap.has(ep.number)) {
      uniqueMap.set(ep.number, ep);
    }
  }

  const finalSub = Array.from(uniqueMap.values()).sort((a, b) => a.number - b.number);

  return {
    source: "donghuaworld",
    episodes: {
      sub: finalSub,
      dub: [],
    },
  };
}

/**
 * Handles watch stream extraction for DonghuaWorld
 */
export async function handleWatch(anilistId, audio, epNum) {
  let epUrl = cacheGet(`dhw:ep:${anilistId}:${epNum}`)?.data;

  // Fallback: fetch episodes to resolve epUrl if not in cache
  if (!epUrl) {
    await getEpisodes(anilistId).catch(() => null);
    epUrl = cacheGet(`dhw:ep:${anilistId}:${epNum}`)?.data;
  }

  if (!epUrl) {
    return json({ error: `DonghuaWorld: No URL found for episode ${epNum}` }, 404);
  }

  try {
    const res = await smartFetch(epUrl);
    if (!res.ok) {
      return json({ error: `DonghuaWorld: HTTP ${res.status} fetching episode page` }, res.status);
    }
    const html = await res.text();

    const streams = [];
    const subtitles = [];
    const downloads = [];

    // Extract all server items from <div class="server-item"><a data-hash="...">
    const serverMatches = Array.from(
      html.matchAll(/<div\s+class=["']server-item["']>[\s\S]*?<a[^>]*data-hash=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
    );

    let dmVideoId = null;

    for (const m of serverMatches) {
      const rawHash = m[1].trim();
      const label = stripTags(m[2] || "").trim();
      if (!rawHash) continue;

      let decoded = "";
      try {
        decoded = Buffer.from(rawHash, "base64").toString("utf-8");
      } catch {
        continue;
      }

      const srcMatch = decoded.match(/src=["']([^"']+)["']/i);
      const sUrl = srcMatch ? srcMatch[1] : (decoded.startsWith("http") ? decoded : null);
      if (!sUrl || sUrl.includes("about:blank") || sUrl.includes("t.co")) continue;

      const lowerLabel = label.toLowerCase();

      // If it's the Dark Server (playing.donghuaworld.in), fetch and extract direct Rumble 4K HLS / MP4
      if (sUrl.includes("playing.donghuaworld") || lowerLabel.includes("dark")) {
        try {
          const darkRes = await smartFetch(sUrl, {
            headers: {
              Referer: epUrl,
            },
          });
          if (darkRes.ok) {
            const darkHtml = await darkRes.text();
            // Match Rumble HLS .m3u8 playlist
            const m3u8Match = darkHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i) ||
              darkHtml.match(/"file"\s*:\s*"([^"]+\.m3u8[^"]*)"/i);

            if (m3u8Match) {
              const hlsUrl = (m3u8Match[1] || m3u8Match[0]).replace(/\\\//g, "/");
              streams.unshift({
                server: "Rumble 4K (HLS)",
                url: hlsUrl,
                type: "hls",
                quality: "4k",
                priority: 1,
                isActive: true,
              });
            }

            // Match direct MP4
            const mp4Match = darkHtml.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i) ||
              darkHtml.match(/"file"\s*:\s*"([^"]+\.mp4[^"]*)"/i);
            if (mp4Match) {
              const mp4Url = (mp4Match[1] || mp4Match[0]).replace(/\\\//g, "/");
              streams.push({
                server: "Direct 4K (MP4)",
                url: mp4Url,
                type: "mp4",
                quality: "4k",
                priority: 2,
                isActive: true,
              });
            }
          }
        } catch (e) {
          console.warn("[donghuaworld] Dark server stream fetch failed:", e.message);
        }

        // Also add the player embed as fallback
        streams.push({
          server: "Dark Player (Embed)",
          url: sUrl,
          type: "embed",
          quality: "4k",
          priority: 3,
          isActive: true,
        });
      } else if (sUrl.includes("dailymotion") || lowerLabel.includes("dm")) {
        streams.push({
          server: "Dailymotion (4K)",
          url: sUrl,
          type: "embed",
          quality: "4k",
          priority: 4,
          isActive: true,
        });
        const dmMatch = sUrl.match(/video=([a-zA-Z0-9]+)/i);
        if (dmMatch) dmVideoId = dmMatch[1];
      } else {
        streams.push({
          server: label || "Stream Player",
          url: sUrl,
          type: "embed",
          quality: "1080p",
          priority: 5,
          isActive: true,
        });
      }
    }

    // Direct iframe fallback on episode page if no server-items found
    if (!streams.length) {
      const directIframe = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (directIframe && !directIframe[1].includes("about:blank")) {
        const dUrl = directIframe[1];
        streams.push({
          server: "Main Player (4K)",
          url: dUrl,
          type: "embed",
          quality: "4k",
          priority: 1,
          isActive: true,
        });
        if (dUrl.includes("dailymotion")) {
          const dmMatch = dUrl.match(/video=([a-zA-Z0-9]+)/i);
          if (dmMatch) dmVideoId = dmMatch[1];
        }
      }
    }

    // Fetch official Dailymotion subtitles if available
    if (dmVideoId) {
      try {
        const dmMetaRes = await fetch(`https://www.dailymotion.com/player/metadata/video/${dmVideoId}`, {
          headers: { "User-Agent": UA },
        });
        if (dmMetaRes.ok) {
          const dmMeta = await dmMetaRes.json();
          if (dmMeta?.subtitles && typeof dmMeta.subtitles === "object") {
            for (const [lang, track] of Object.entries(dmMeta.subtitles)) {
              if (track?.urls?.[0]) {
                subtitles.push({
                  url: track.urls[0],
                  label: track.label || lang,
                  srclang: lang,
                  default: lang === "en",
                });
              }
            }
          }
        }
      } catch (dmErr) {
        console.warn("[donghuaworld] Dailymotion subtitles fetch failed:", dmErr.message);
      }
    }

    // Sort streams by priority (Rumble HLS 4K -> Direct MP4 4K -> Dark Player Embed -> Dailymotion 4K)
    streams.sort((a, b) => (a.priority || 99) - (b.priority || 99));

    const payload = {
      anilistId: Number(anilistId),
      episode: Number(epNum),
      audio: "sub",
      intro: { start: 0, end: 0 },
      outro: { start: 0, end: 0 },
      streams,
      subtitles,
      downloads,
      headers: { Referer: "https://donghuaworld.com/" },
    };

    return json(payload, 200, {
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    });
  } catch (err) {
    return json({ error: `DonghuaWorld: ${err.message}` }, 500);
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/watch\/donghuaworld\/(\d+)\/(sub|dub)\/donghuaworld-(\d+)\/?$/);
    if (!m) {
      return json({ error: "DonghuaWorld: Route not found" }, 404);
    }
    const [, anilistId, audio, epNum] = m;
    return handleWatch(anilistId, audio, epNum);
  },
};
