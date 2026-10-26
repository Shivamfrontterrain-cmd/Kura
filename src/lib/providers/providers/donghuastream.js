import { json, decodeEntities, UA } from "../core/new-provider-utils.js";
import {
  get as cacheGet,
  set as cacheSet,
  isFresh,
  SHOW_IDENTITY_TTL,
  WATCH_TTL,
} from "../core/smartcache.js";
import { getMedia } from "../core/anilist.js";

const BASE = "https://donghuastream.org";
const H = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Referer": `${BASE}/`,
};

function stripTags(s) {
  return (s || "").replace(/<[^>]+>/g, "").trim();
}

/**
 * Parses episode ranges from AniList description
 * e.g. "Note: Episodes 158 to 219." => { start: 158, end: 219, offset: 157 }
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
 * Generates search queries for DonghuaStream
 */
function generateSearchQueries(media) {
  const queries = new Set();
  const rawList = [
    media?.title?.english,
    media?.title?.romaji,
    ...(Array.isArray(media?.synonyms) ? media.synonyms : []),
  ].filter(Boolean);

  for (const t of rawList) {
    // Avoid non-latin searches as WordPress matches latin titles directly
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
 * Searches DonghuaStream for an anime title and returns the series URL
 */
export async function findSeriesUrl(anilistId, media) {
  const cacheKey = `ds:series:${anilistId}`;
  const cached = cacheGet(cacheKey);
  if (cached && cached.data) return cached.data;

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
  const targetSeason = seasonMatch ? Number(seasonMatch[1]) : null;

  for (const query of queries) {
    try {
      const searchUrl = `${BASE}/?s=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, { headers: H });
      if (!res.ok) continue;
      const html = await res.text();

      const articles = Array.from(
        html.matchAll(/<article[^>]*>[\s\S]*?<a\s+href="(https:\/\/donghuastream\.org\/anime\/[^"'/]+\/)"[^>]*title="([^"]*)"/gi)
      ).map((m) => ({ link: m[1], title: m[2] }));

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

          // Penalize specials / origin prequels unless searched
          if (!pTitle.includes("origin") && (lowerTitle.includes("origin") || lowerLink.includes("origin"))) continue;
          if (!pTitle.includes("special") && (lowerTitle.includes("special") || lowerLink.includes("special"))) continue;

          let score = 10;
          const itemSeasonMatch = lowerTitle.match(/season\s*(\d+)/i) || lowerLink.match(/season-(\d+)/i);
          const itemSeason = itemSeasonMatch ? Number(itemSeasonMatch[1]) : (lowerTitle.includes("season 1") ? 1 : null);

          if (range && range.start >= 50) {
            // Multi-year continuous broadcast (e.g. BTTH Season 5)
            if (itemSeason === 5 || lowerLink.includes("season-5")) {
              score += 60;
            } else if (itemSeason === 1 || itemSeason === null) {
              score -= 30;
            }
          } else if (targetSeason !== null) {
            if (itemSeason === targetSeason) {
              score += 50;
            } else if (targetSeason >= 5 && itemSeason === 5) {
              score += 35;
            } else if (itemSeason !== null) {
              score -= 20;
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
      console.warn(`[donghuastream] Search query "${query}" failed:`, e.message);
    }
  }

  return null;
}

function episodeMeta(epNum, ctx) {
  const anizipEp = ctx?.anizip?.episodes?.[String(epNum)];
  return {
    title: anizipEp?.title?.en || anizipEp?.title?.["x-jat"] || null,
    airDate: anizipEp?.airdate || null,
    image: anizipEp?.image || null,
    description: anizipEp?.summary || anizipEp?.overview || null,
    duration: typeof anizipEp?.runtime === "number" ? anizipEp.runtime * 60 : null,
  };
}

/**
 * Fetches episode list for an anime from DonghuaStream
 */
export async function getEpisodes(anilistId, ctx = {}) {
  let media = ctx.media;
  if (!media) {
    media = await getMedia(anilistId).catch(() => null);
  }

  const seriesUrl = await findSeriesUrl(anilistId, media);
  if (!seriesUrl) {
    throw new Error(`DonghuaStream: Could not find series for AniList ID ${anilistId}`);
  }

  const res = await fetch(seriesUrl, { headers: H });
  if (!res.ok) {
    throw new Error(`DonghuaStream: HTTP ${res.status} fetching series ${seriesUrl}`);
  }
  const html = await res.text();

  // Extract episode items from series page
  const epMatches = Array.from(
    html.matchAll(/<a\s+href="([^"]+)"[^>]*>[\s\S]*?<div class="epl-num">([\s\S]*?)<\/div>[\s\S]*?(?:<div class="epl-title">([\s\S]*?)<\/div>)?[\s\S]*?(?:<div class="epl-date">([\s\S]*?)<\/div>)?[\s\S]*?<\/a>/gi)
  );

  if (!epMatches.length) {
    throw new Error(`DonghuaStream: No episodes parsed from ${seriesUrl}`);
  }

  const range = parseEpisodeRange(media?.description);
  const sub = [];

  for (const match of epMatches) {
    const [, epUrl, rawNum, rawTitle, rawDate] = match;

    // Skip preview / promo announcements
    if (!epUrl.includes("episode") && !epUrl.includes("-ep-")) continue;

    const numMatch = rawNum.match(/(\d+)/);
    if (!numMatch) continue;
    const epNum = Number(numMatch[1]);
    if (!Number.isFinite(epNum) || epNum <= 0) continue;

    const meta = episodeMeta(epNum, ctx);
    const cleanTitle = stripTags(rawTitle || "").trim() || meta.title || `Episode ${epNum}`;
    const cleanDate = stripTags(rawDate || "").trim() || meta.airDate;

    if (range) {
      if (epNum >= range.start && epNum <= range.end) {
        const relEpNum = epNum - range.offset;
        // Cache both relative (e.g. 7) and absolute (e.g. 164)
        cacheSet(`ds:ep:${anilistId}:${relEpNum}`, epUrl, SHOW_IDENTITY_TTL);
        cacheSet(`ds:ep:${anilistId}:${epNum}`, epUrl, SHOW_IDENTITY_TTL);

        sub.push({
          id: `watch/donghuastream/${anilistId}/sub/donghuastream-${relEpNum}`,
          number: relEpNum,
          title: cleanTitle.includes(String(epNum)) ? cleanTitle : `Episode ${relEpNum} [Ep ${epNum}]`,
          duration: meta.duration || 1200,
          audio: "sub",
          filler: false,
          recap: false,
          uncensored: false,
          description: meta.description || "",
          image: meta.image,
          airDate: cleanDate,
        });
      }
    } else {
      cacheSet(`ds:ep:${anilistId}:${epNum}`, epUrl, SHOW_IDENTITY_TTL);
      sub.push({
        id: `watch/donghuastream/${anilistId}/sub/donghuastream-${epNum}`,
        number: epNum,
        title: cleanTitle,
        duration: meta.duration || 1200,
        audio: "sub",
        filler: false,
        recap: false,
        uncensored: false,
        description: meta.description || "",
        image: meta.image,
        airDate: cleanDate,
      });
    }
  }

  // Fallback: if range matched 0 episodes, push all available episodes
  if (range && sub.length === 0) {
    for (const match of epMatches) {
      const [, epUrl, rawNum, rawTitle, rawDate] = match;
      if (!epUrl.includes("episode") && !epUrl.includes("-ep-")) continue;

      const numMatch = rawNum.match(/(\d+)/);
      if (!numMatch) continue;
      const epNum = Number(numMatch[1]);
      if (!Number.isFinite(epNum) || epNum <= 0) continue;

      const meta = episodeMeta(epNum, ctx);
      const cleanTitle = stripTags(rawTitle || "").trim() || meta.title || `Episode ${epNum}`;
      const cleanDate = stripTags(rawDate || "").trim() || meta.airDate;

      cacheSet(`ds:ep:${anilistId}:${epNum}`, epUrl, SHOW_IDENTITY_TTL);
      sub.push({
        id: `watch/donghuastream/${anilistId}/sub/donghuastream-${epNum}`,
        number: epNum,
        title: cleanTitle,
        duration: meta.duration || 1200,
        audio: "sub",
        filler: false,
        recap: false,
        uncensored: false,
        description: meta.description || "",
        image: meta.image,
        airDate: cleanDate,
      });
    }
  }

  // Ensure ascending order (Ep 1, Ep 2, Ep 3 ...)
  sub.sort((a, b) => a.number - b.number);

  return {
    source: "donghuastream",
    episodes: {
      sub,
      dub: [],
    },
  };
}

/**
 * Decodes base64-encoded iframe HTML from mirror select options
 */
function decodeBase64Iframe(val) {
  try {
    const raw = Buffer.from(val, "base64").toString("utf8");
    const m = raw.match(/src=["']([^"']+)["']/i);
    return m ? (m[1].startsWith("//") ? `https:${m[1]}` : m[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Handles watch stream extraction for DonghuaStream
 */
export async function handleWatch(anilistId, audio, epNum) {
  let epUrl = cacheGet(`ds:ep:${anilistId}:${epNum}`)?.data;

  // Fallback: fetch episodes to resolve epUrl if not in cache
  if (!epUrl) {
    const media = await getMedia(anilistId).catch(() => null);
    await getEpisodes(anilistId, { media }).catch(() => null);
    epUrl = cacheGet(`ds:ep:${anilistId}:${epNum}`)?.data;

    if (!epUrl && media) {
      const range = parseEpisodeRange(media.description);
      if (range) {
        const num = Number(epNum);
        if (num <= (range.end - range.offset)) {
          epUrl = cacheGet(`ds:ep:${anilistId}:${num + range.offset}`)?.data;
        } else if (num >= range.start && num <= range.end) {
          epUrl = cacheGet(`ds:ep:${anilistId}:${num - range.offset}`)?.data;
        }
      }
    }
  }

  if (!epUrl) {
    return json({ error: `DonghuaStream: No URL found for episode ${epNum}` }, 404);
  }

  try {
    const res = await fetch(epUrl, { headers: H });
    if (!res.ok) {
      return json({ error: `DonghuaStream: HTTP ${res.status} fetching episode page` }, res.status);
    }
    const html = await res.text();

    const streams = [];
    const subtitles = [];
    const downloads = [];

    // Parse all mirror options in <select class="mirror">
    const selectMatch = html.match(/<select[^>]*class=["'][^"']*mirror[^"']*["'][^>]*>([\s\S]*?)<\/select>/i);
    const options = selectMatch
      ? Array.from(selectMatch[1].matchAll(/<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi))
      : [];

    let dmVideoId = null;

    for (const opt of options) {
      const val = opt[1].trim();
      const label = opt[2].replace(/\s+/g, " ").trim();
      if (!val || label.toLowerCase().includes("select video")) continue;

      let iframeSrc = decodeBase64Iframe(val);
      if (!iframeSrc && val.startsWith("http")) iframeSrc = val;
      if (!iframeSrc || iframeSrc.includes("t.co") || iframeSrc.includes("blogspot")) continue;

      const lower = label.toLowerCase();
      let srvName = label;
      let priority = 5;

      if (lower.includes("all sub") || iframeSrc.includes("streamplay")) {
        srvName = "StreamPlay (4K)";
        priority = 1;
      } else if (lower.includes("dailymotion") || iframeSrc.includes("dailymotion.com")) {
        srvName = "Dailymotion (4K)";
        priority = 2;
        const dmMatch = iframeSrc.match(/video=([a-zA-Z0-9]+)/i);
        if (dmMatch) dmVideoId = dmMatch[1];
      } else if (lower.includes("rumble") || iframeSrc.includes("rumble.com")) {
        srvName = "Rumble (4K)";
        priority = 3;
      } else if (lower.includes("ok ru") || lower.includes("ok.ru") || iframeSrc.includes("ok.ru")) {
        srvName = "OK.RU (4K)";
        priority = 4;
      }

      if (!streams.some((s) => s.url === iframeSrc)) {
        streams.push({
          server: srvName,
          url: iframeSrc,
          type: "embed",
          quality: "4k",
          priority,
          isActive: false,
        });
      }
    }

    // Direct iframe on the episode page as default fallback
    const directIframe = html.match(/<(?:iframe)[^>]*(?:data-litespeed-src|src)=["']([^"']+)["'][^>]*>/i);
    if (directIframe && !directIframe[1].includes("about:blank")) {
      const dUrl = directIframe[1].startsWith("//") ? `https:${directIframe[1]}` : directIframe[1];
      if (!streams.some((s) => s.url === dUrl) && !dUrl.includes("t.co") && !dUrl.includes("blogspot")) {
        const dmMatch = dUrl.match(/video=([a-zA-Z0-9]+)/i);
        if (dmMatch) dmVideoId = dmMatch[1];

        streams.unshift({
          server: "Dailymotion (4K)",
          url: dUrl,
          type: "embed",
          quality: "4k",
          priority: 2,
          isActive: false,
        });
      }
    }

    // Try fetching official Dailymotion subtitles
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
        console.warn("[donghuastream] Dailymotion metadata fetch error:", dmErr.message);
      }
    }

    // Sort by priority (StreamPlay -> Dailymotion -> Rumble -> OK.RU)
    streams.sort((a, b) => (a.priority || 99) - (b.priority || 99));

    // Mark first stream as active
    if (streams.length > 0 && !streams.some((s) => s.isActive)) {
      streams[0].isActive = true;
    }

    const payload = {
      anilistId: Number(anilistId),
      episode: Number(epNum),
      audio: "sub",
      intro: { start: 0, end: 0 },
      outro: { start: 0, end: 0 },
      streams,
      subtitles,
      downloads,
      headers: { Referer: "https://donghuastream.org/" },
    };

    return json(payload, 200, {
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    });
  } catch (err) {
    return json({ error: `DonghuaStream: ${err.message}` }, 500);
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const m =
      url.pathname.match(/^\/watch\/donghuastream\/(\d+)\/(sub|dub)\/donghuastream-(\d+)\/?$/) ||
      url.pathname.match(/^\/watch\/luciferdonghua\/(\d+)\/(sub|dub)\/luciferdonghua-(\d+)\/?$/);

    if (!m) {
      return json({ error: "DonghuaStream: Route not found" }, 404);
    }
    const [, anilistId, audio, epNum] = m;
    return handleWatch(anilistId, audio, epNum);
  },
};
