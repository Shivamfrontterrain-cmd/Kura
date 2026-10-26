import { json, episodeMeta, decodeEntities, stripTags, UA } from "../core/new-provider-utils.js";
import { getMedia } from "../core/anilist.js";
import { get as cacheGet, set as cacheSet, isFresh, SHOW_IDENTITY_TTL, WATCH_TTL } from "../core/smartcache.js";

const BASE = "https://luciferdonghua.in";
const H = {
  "User-Agent": UA,
  "Referer": `${BASE}/`,
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * Searches LuciferDonghua for an anime title and returns the series URL.
 */
async function findSeriesUrl(anilistId, media) {
  const cacheKey = `np:ld:url:${anilistId}`;
  const cached = cacheGet(cacheKey);
  if (isFresh(cached)) return cached.data;

  // Gather candidate titles in priority order (English > synonyms > Romaji > native)
  const candidateTitles = [];
  if (media?.title?.english) candidateTitles.push(media.title.english);
  if (Array.isArray(media?.synonyms)) {
    for (const syn of media.synonyms) {
      if (typeof syn === "string" && syn.trim().length > 2) {
        candidateTitles.push(syn.trim());
      }
    }
  }
  if (media?.title?.romaji) candidateTitles.push(media.title.romaji);
  if (media?.title?.native) candidateTitles.push(media.title.native);

  // Clean titles for search (remove season labels, brackets, trailing digits)
  const queries = [];
  for (const raw of candidateTitles) {
    const cleaned = raw.replace(/\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "").replace(/Season\s*\d+/i, "").trim();
    if (cleaned.length >= 3 && !queries.includes(cleaned)) queries.push(cleaned);
    const baseCleaned = cleaned.replace(/\b\d+\b/g, "").trim();
    if (baseCleaned.length >= 3 && !queries.includes(baseCleaned)) queries.push(baseCleaned);
  }

  const isMovie = media?.format === "MOVIE";
  const primaryTitle = candidateTitles[0] || "";
  const seasonMatch = primaryTitle.match(/season\s*(\d+)/i) || primaryTitle.match(/(\d+)(?:st|nd|rd|th)\s*season/i) || primaryTitle.match(/\bS(\d+)\b/i) || primaryTitle.match(/\b(\d+)$/);
  const targetSeason = seasonMatch ? Number(seasonMatch[1]) : null;

  for (const query of queries) {
    try {
      const searchUrl = `${BASE}/?s=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, { headers: H });
      if (!res.ok) continue;
      const html = await res.text();

      // Find series links and titles from article cards or link tags
      const articles = [];
      const articleMatches = Array.from(html.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/gi));
      if (articleMatches.length > 0) {
        for (const a of articleMatches) {
          const linkMatch = a[1].match(/href=["'](https:\/\/luciferdonghua\.in\/anime\/[^"']+\/)["']/i);
          const titleMatch = a[1].match(/itemprop=["']headline["']>([^<]*)<\/h2>/i) || a[1].match(/title=["']([^"']*)["']/i);
          if (linkMatch && !linkMatch[1].includes("lucifer-donghua")) {
            articles.push({ link: linkMatch[1], title: titleMatch ? decodeEntities(titleMatch[1].trim()) : "" });
          }
        }
      }
      if (!articles.length) {
        const rawLinks = Array.from(html.matchAll(/href=["'](https:\/\/luciferdonghua\.in\/anime\/[^"'/]+\/)["']/gi));
        for (const [, url] of rawLinks) {
          if (!url.includes("lucifer-donghua") && !articles.some((a) => a.link === url)) {
            articles.push({ link: url, title: "" });
          }
        }
      }

      if (articles.length > 0) {
        let bestUrl = null;
        let bestScore = -999;

        for (const item of articles) {
          const lowerTitle = (item.title || "").toLowerCase();
          const lowerLink = item.link.toLowerCase();
          const pTitle = primaryTitle.toLowerCase();

          if (isMovie) {
            if (lowerTitle.includes("movie") || lowerLink.includes("movie") || lowerTitle.includes("juchang ban")) {
              bestUrl = item.link;
              break;
            }
          } else {
            // Deprioritize movies for series
            if (lowerTitle.includes("movie") || lowerLink.includes("movie") || lowerTitle.includes("juchang ban")) continue;
          }

          // Penalize specials / origin prequels unless specifically searching for them
          if (!pTitle.includes("origin") && (lowerTitle.includes("origin") || lowerLink.includes("origin"))) {
            continue;
          }
          if (!pTitle.includes("special") && (lowerTitle.includes("special") || lowerLink.includes("special"))) {
            continue;
          }

          let score = 10;
          const itemSeasonMatch = lowerTitle.match(/season\s*(\d+)/i) || lowerLink.match(/season-(\d+)/i);
          const itemSeason = itemSeasonMatch ? Number(itemSeasonMatch[1]) : (lowerTitle.includes("season 1") ? 1 : null);

          if (targetSeason !== null) {
            if (itemSeason === targetSeason) {
              score += 50;
            } else if (targetSeason >= 5 && itemSeason === 5) {
              // Continuous multi-year Donghua broadcast is grouped under Season 5 on LuciferDonghua
              score += 35;
            } else if (itemSeason !== null) {
              score -= 20;
            }
          } else {
            if (itemSeason === 1 || itemSeason === null) {
              score += 15;
            }
          }

          if (lowerLink.includes("new")) score += 5;

          if (score > bestScore) {
            bestScore = score;
            bestUrl = item.link;
          }
        }

        if (!bestUrl && articles[0]?.link) {
          bestUrl = articles[0].link;
        }

        if (bestUrl) {
          cacheSet(cacheKey, bestUrl, SHOW_IDENTITY_TTL);
          return bestUrl;
        }
      }

      // If no /anime/ link found, check if direct episode links appeared
      const epMatches = Array.from(html.matchAll(/<a\s+href="(https:\/\/luciferdonghua\.in\/[^"/]+-episode-\d+[^"/]*\/)"/gi));
      if (epMatches.length > 0) {
        // Fetch first episode page and extract "All Episodes" series link
        const epRes = await fetch(epMatches[0][1], { headers: H });
        if (epRes.ok) {
          const epHtml = await epRes.text();
          const seriesMatch = epHtml.match(/<a\s+href=['"](https:\/\/luciferdonghua\.in\/anime\/[^'"]+\/)['"]\s+aria-label=['"]All Episodes['"]/i);
          if (seriesMatch) {
            cacheSet(cacheKey, seriesMatch[1], SHOW_IDENTITY_TTL);
            return seriesMatch[1];
          }
        }
      }
    } catch (e) {
      console.warn(`[luciferdonghua] Search query "${query}" failed:`, e.message);
    }
  }

  return null;
}

export function parseEpisodeRange(description) {
  if (!description || typeof description !== "string") return null;
  const m = description.match(/(?:Note:\s*)?Episodes\s*(\d+)\s*(?:to|-)\s*(\d+)/i);
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (Number.isFinite(start) && Number.isFinite(end) && start > 1) {
    return { start, end, offset: start - 1 };
  }
  return null;
}

/**
 * Fetches episode list for an anime from LuciferDonghua
 */
export async function getEpisodes(anilistId, ctx = {}) {
  let media = ctx.media;
  if (!media) {
    media = await getMedia(anilistId).catch(() => null);
  }

  const seriesUrl = await findSeriesUrl(anilistId, media);
  if (!seriesUrl) {
    throw new Error(`LuciferDonghua: Could not find series for AniList ID ${anilistId}`);
  }

  const res = await fetch(seriesUrl, { headers: H });
  if (!res.ok) {
    throw new Error(`LuciferDonghua: HTTP ${res.status} fetching series ${seriesUrl}`);
  }
  const html = await res.text();

  // Extract episode items from <div class="eplister">
  const liMatches = Array.from(
    html.matchAll(/<li[^>]*data-index="(\d+)"[^>]*>[\s\S]*?<a\s+href="([^"]+)"[\s\S]*?<div class="epl-num">([\s\S]*?)<\/div>[\s\S]*?(?:<div class="epl-title">([\s\S]*?)<\/div>)?[\s\S]*?(?:<div class="epl-date">([\s\S]*?)<\/div>)?[\s\S]*?<\/li>/gi)
  );

  if (!liMatches.length) {
    throw new Error(`LuciferDonghua: No episodes parsed from ${seriesUrl}`);
  }

  const range = parseEpisodeRange(media?.description);
  const sub = [];

  for (const match of liMatches) {
    const [, , epUrl, rawNum, rawTitle, rawDate] = match;
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
        cacheSet(`ld:ep:${anilistId}:${relEpNum}`, epUrl, SHOW_IDENTITY_TTL);
        cacheSet(`ld:ep:${anilistId}:${epNum}`, epUrl, SHOW_IDENTITY_TTL);

        sub.push({
          id: `watch/luciferdonghua/${anilistId}/sub/luciferdonghua-${relEpNum}`,
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
      cacheSet(`ld:ep:${anilistId}:${epNum}`, epUrl, SHOW_IDENTITY_TTL);
      sub.push({
        id: `watch/luciferdonghua/${anilistId}/sub/luciferdonghua-${epNum}`,
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

  // Fallback: if range was set but matched 0 episodes, push all episodes from series
  if (range && sub.length === 0) {
    for (const match of liMatches) {
      const [, , epUrl, rawNum, rawTitle, rawDate] = match;
      const numMatch = rawNum.match(/(\d+)/);
      if (!numMatch) continue;
      const epNum = Number(numMatch[1]);
      if (!Number.isFinite(epNum) || epNum <= 0) continue;

      const meta = episodeMeta(epNum, ctx);
      const cleanTitle = stripTags(rawTitle || "").trim() || meta.title || `Episode ${epNum}`;
      const cleanDate = stripTags(rawDate || "").trim() || meta.airDate;

      sub.push({
        id: `watch/luciferdonghua/${anilistId}/sub/luciferdonghua-${epNum}`,
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
    meta: {
      title: media?.title?.english || media?.title?.romaji || "Donghua",
      source: "luciferdonghua",
      totalEpisodes: sub.length,
    },
    episodes: { sub, dub: [] },
  };
}

/**
 * Unpacks P.A.C.K.E.R. obfuscated JavaScript
 */
function unpackPacker(code) {
  try {
    const evalPrefix = /^[\s\S]*?eval\(/;
    if (!evalPrefix.test(code)) return "";
    const cleanFn = code.replace(/^[\s\S]*?eval\(/, "(");
    const unpacked = Function(`"use strict"; return ${cleanFn}`)();
    return typeof unpacked === "string" ? unpacked : "";
  } catch {
    return "";
  }
}

/**
 * Handles watch request and extracts all mirrors (VidHide 4K, Dailymotion 4K, Rumble 4K, OK.RU 4K, Archive.org 4K)
 */
export async function handleWatch(anilistId, audio, epNum) {
  const watchCacheKey = `ld:watch:${anilistId}:${epNum}`;
  const cachedWatch = cacheGet(watchCacheKey);
  if (isFresh(cachedWatch)) return json(cachedWatch.data);

  let epUrl = cacheGet(`ld:ep:${anilistId}:${epNum}`)?.data;

  // Fallback: fetch episodes to resolve epUrl if not in cache
  if (!epUrl) {
    const media = await getMedia(anilistId).catch(() => null);
    await getEpisodes(anilistId, { media }).catch(() => null);
    epUrl = cacheGet(`ld:ep:${anilistId}:${epNum}`)?.data;

    if (!epUrl && media) {
      const range = parseEpisodeRange(media.description);
      if (range) {
        const num = Number(epNum);
        if (num <= (range.end - range.offset)) {
          epUrl = cacheGet(`ld:ep:${anilistId}:${num + range.offset}`)?.data;
        } else if (num >= range.start && num <= range.end) {
          epUrl = cacheGet(`ld:ep:${anilistId}:${num - range.offset}`)?.data;
        }
      }
    }
  }

  if (!epUrl) {
    return json({ error: `LuciferDonghua: No URL found for episode ${epNum}` }, 404);
  }

  const streams = [];
  const downloads = [];
  const subtitles = [];

  try {
    // 1. Fetch main episode page
    const res = await fetch(epUrl, { headers: H });
    if (!res.ok) throw new Error(`HTTP ${res.status} from episode page`);
    const html = await res.text();

    // Check for Archive.org direct download link (often 4K MP4!)
    const archiveMatch = html.match(/href="(https:\/\/[^"]*archive\.org\/[^"]+\.mp4)"/i);
    if (archiveMatch) {
      downloads.push({ url: archiveMatch[1], label: "Archive.org 4K MP4" });
      streams.push({
        url: archiveMatch[1],
        type: "mp4",
        server: "Archive.org (4K MP4)",
        quality: "4k",
        priority: 5,
        isActive: false,
      });
    }

    // Default Dailymotion check on main page
    const dmMatch = html.match(/data-video="([a-zA-Z0-9]+)"/i)
      || html.match(/dailymotion\.com\/(?:embed\/video|player\/xdcdz\.html\?video)=([a-zA-Z0-9]+)/i)
      || html.match(/embedUrl["']\s+content=["'](https:\/\/geo\.dailymotion\.com\/player\/[^"']+)["']/i);
    let defaultDmId = dmMatch ? (dmMatch[1].startsWith("http") ? null : dmMatch[1]) : null;

    if (defaultDmId) {
      try {
        const dmMetaRes = await fetch(`https://www.dailymotion.com/player/metadata/video/${defaultDmId}`, {
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
        console.warn("[luciferdonghua] Dailymotion metadata fetch error:", dmErr.message);
      }
    }

    // Parse all mirror options in <select class="mirror">
    const options = Array.from(html.matchAll(/<option[^>]*value=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi));

    // Fetch all mirrors in parallel for maximum speed
    const mirrorFetches = options.map(async (opt, idx) => {
      const vUrl = opt[1];
      const dataIdx = String(idx + 1);
      const rawLabel = opt[2].replace(/\s+/g, " ").trim();
      const lower = rawLabel.toLowerCase();

      try {
        const vRes = await fetch(vUrl, { headers: H });
        if (!vRes.ok) return null;
        const vHtml = await vRes.text();
        return { dataIdx, rawLabel, lower, vUrl, vHtml };
      } catch {
        return null;
      }
    });

    const mirrorResults = (await Promise.all(mirrorFetches)).filter(Boolean);

    for (const m of mirrorResults) {
      const { dataIdx, rawLabel, lower, vHtml } = m;

      const allIframes = Array.from(vHtml.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)).map(match => match[1]);
      const videoIframes = allIframes
        .map(u => (u.startsWith("//") ? `https:${u}` : u))
        .filter(u => !u.includes("t.co") && !u.includes("blogspot") && !u.includes("about:blank") && !u.includes("histats") && !u.includes("disqus") && !u.includes("facebook") && !u.includes("twitter"));

      // 1. VidHide / Yurn Server (4K direct HLS / embed)
      const yurnUrl = videoIframes.find(u => u.includes("yurn.online") || u.includes("vidhide"));
      if (yurnUrl && !streams.some(s => s.server.includes("VidHide"))) {
        let hlsUrl = null;
        try {
          const yurnRes = await fetch(yurnUrl, {
            headers: {
              "User-Agent": UA,
              "Referer": `${BASE}/`,
            },
          });
          if (yurnRes.ok) {
            const yHtml = await yurnRes.text();
            const evalMatch = yHtml.match(/eval\(function\(p,a,c,k,e,d[\s\S]*?<\/script>/i);
            if (evalMatch) {
              const code = evalMatch[0].replace(/<\/script>$/i, "");
              const cleanFn = code.replace(/^[\s\S]*?eval\(/, "(");
              const unpacked = Function(`"use strict"; return ${cleanFn}`)();
              const m3u8 = unpacked.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
              if (m3u8) hlsUrl = m3u8[0];
            }
          }
        } catch (e) {
          console.warn("[luciferdonghua] Yurn HLS unpack error:", e.message);
        }

        if (hlsUrl) {
          streams.unshift({
            server: "VidHide (4K HLS)",
            url: hlsUrl,
            embedUrl: yurnUrl,
            type: "hls",
            referer: "https://yurn.online/",
            quality: "4k",
            priority: 1,
            isActive: true,
          });
        } else {
          streams.unshift({
            server: "VidHide (4K)",
            url: yurnUrl,
            type: "embed",
            quality: "4k",
            priority: 1,
            isActive: true,
          });
        }
      }

      // 2. Dailymotion Server
      const vDm = vHtml.match(/data-video=["']([a-zA-Z0-9]+)["']/i)
        || vHtml.match(/dailymotion\.com\/(?:embed\/video|player\/xdcdz\.html\?video)=([a-zA-Z0-9]+)/i)
        || vHtml.match(/embedUrl["']\s+content=["'](https:\/\/geo\.dailymotion\.com\/player\/[^"']+)["']/i);
      if (vDm || lower.includes("dailymotion")) {
        const dmId = vDm ? (vDm[1].startsWith("http") ? null : vDm[1]) : defaultDmId;
        const dmEmbed = vDm && vDm[1].startsWith("http")
          ? vDm[1]
          : dmId ? `https://geo.dailymotion.com/player/xdcdz.html?video=${dmId}` : null;

        if (dmEmbed && !streams.some(s => s.server.includes("Dailymotion"))) {
          streams.push({
            server: "Dailymotion (4K)",
            url: dmEmbed,
            type: "embed",
            quality: "4k",
            priority: 2,
            isActive: !streams.some(s => s.isActive),
          });
        }
      }

      // 3. Rumble Server
      const rumbleUrl = videoIframes.find(u => u.includes("rumble.com"));
      if (rumbleUrl && !streams.some(s => s.server.includes("Rumble"))) {
        streams.push({
          server: "Rumble (4K)",
          url: rumbleUrl,
          type: "embed",
          quality: "4k",
          priority: 3,
          isActive: false,
        });
      }

      // 4. OK.RU Server
      const okUrl = videoIframes.find(u => u.includes("ok.ru"));
      if (okUrl && !streams.some(s => s.server.includes("OK.RU"))) {
        streams.push({
          server: "OK.RU (4K)",
          url: okUrl,
          type: "embed",
          quality: "4k",
          priority: 4,
          isActive: false,
        });
      }

      // 5. Generic / MisterDonghua / Extra Server
      const otherUrl = videoIframes.find(u => !u.includes("yurn.online") && !u.includes("vidhide") && !u.includes("rumble.com") && !u.includes("ok.ru"));
      if (otherUrl && !streams.some(s => s.url === otherUrl)) {
        const srvName = otherUrl.includes("misterdonghua") ? "V2 (4K)" : (rawLabel.replace(/\[|\]|- Server/gi, "").trim() || `Server ${dataIdx}`);
        streams.push({
          server: srvName,
          url: otherUrl,
          type: "embed",
          quality: "4k",
          priority: 5,
          isActive: false,
        });
      }
    }

    // Ensure priority sorting
    streams.sort((a, b) => (a.priority || 99) - (b.priority || 99));

    // Ensure at least one stream is marked active
    if (streams.length > 0 && !streams.some(s => s.isActive)) {
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
      headers: { Referer: "https://yurn.online/" },
    };

    cacheSet(watchCacheKey, payload, WATCH_TTL);
    return json(payload);
  } catch (err) {
    return json({ error: `LuciferDonghua: ${err.message}` }, 500);
  }
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }
    const url = new URL(request.url);
    try {
      const m = url.pathname.match(/^\/watch\/luciferdonghua\/(\d+)\/(sub|dub)\/luciferdonghua-(\d+)\/?$/);
      if (m) return await handleWatch(m[1], m[2], m[3]);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err.message, stack: err.stack }, 500);
    }
  },
};
