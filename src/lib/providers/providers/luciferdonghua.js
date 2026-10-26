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

  // Clean titles for search (remove season labels, brackets)
  const queries = [];
  for (const raw of candidateTitles) {
    const cleaned = raw.replace(/\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "").replace(/Season\s*\d+/i, "").trim();
    if (cleaned.length >= 3 && !queries.includes(cleaned)) queries.push(cleaned);
  }

  for (const query of queries) {
    try {
      const searchUrl = `${BASE}/?s=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, { headers: H });
      if (!res.ok) continue;
      const html = await res.text();

      // Find series links: <a href="https://luciferdonghua.in/anime/{slug}/" ...>
      const animeMatches = Array.from(html.matchAll(/<a\s+href="(https:\/\/luciferdonghua\.in\/anime\/[^"/]+\/)"[^>]*title="([^"]*)"/gi));
      if (animeMatches.length > 0) {
        // Pick the best match (prefer TV / Donghua, not movie unless query matches)
        let bestUrl = animeMatches[0][1];
        for (const [, url, title] of animeMatches) {
          const lower = title.toLowerCase();
          if (!lower.includes("movie") || query.toLowerCase().includes("movie")) {
            bestUrl = url;
            break;
          }
        }
        cacheSet(cacheKey, bestUrl, SHOW_IDENTITY_TTL);
        return bestUrl;
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
  // <li data-index="0"><a href="..."><div class="epl-num">45 [4K]</div><div class="epl-title">...</div>...
  const liMatches = Array.from(
    html.matchAll(/<li[^>]*data-index="(\d+)"[^>]*>[\s\S]*?<a\s+href="([^"]+)"[\s\S]*?<div class="epl-num">([\s\S]*?)<\/div>[\s\S]*?(?:<div class="epl-title">([\s\S]*?)<\/div>)?[\s\S]*?(?:<div class="epl-date">([\s\S]*?)<\/div>)?[\s\S]*?<\/li>/gi)
  );

  if (!liMatches.length) {
    throw new Error(`LuciferDonghua: No episodes parsed from ${seriesUrl}`);
  }

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

    // Cache the episode URL for fast watch retrieval
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

  // Ensure ascending order (Ep 1, Ep 2, Ep 3 ...)
  sub.sort((a, b) => a.number - b.number);

  return {
    meta: {
      title: media?.title?.english || media?.title?.romaji || "Donghua",
      source: "luciferdonghua",
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
    // Execute packer decode logic safely
    const unpacked = Function(`"use strict"; return ${cleanFn}`)();
    return typeof unpacked === "string" ? unpacked : "";
  } catch {
    return "";
  }
}

/**
 * Handles watch request and extracts 4K / HLS streams and download links
 */
export async function handleWatch(anilistId, audio, epNum) {
  let epUrl = cacheGet(`ld:ep:${anilistId}:${epNum}`)?.data;

  // Fallback: fetch episodes to resolve epUrl if not in cache
  if (!epUrl) {
    await getEpisodes(anilistId).catch(() => null);
    epUrl = cacheGet(`ld:ep:${anilistId}:${epNum}`)?.data;
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
        priority: 4,
        isActive: false,
      });
    }

    // Check for Dailymotion embed
    const dmMatch = html.match(/data-video="([a-zA-Z0-9]+)"/i) || html.match(/dailymotion\.com\/(?:embed\/video|player\/xdcdz\.html\?video)=([a-zA-Z0-9]+)/i);
    if (dmMatch) {
      const dmId = dmMatch[1];
      try {
        const dmMetaRes = await fetch(`https://www.dailymotion.com/player/metadata/video/${dmId}`, {
          headers: { "User-Agent": UA },
        });
        if (dmMetaRes.ok) {
          const dmMeta = await dmMetaRes.json();
          // Extract subtitles if present
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

      streams.push({
        url: `https://geo.dailymotion.com/player/xdcdz.html?video=${dmId}`,
        type: "embed",
        server: "Dailymotion",
        priority: 3,
        isActive: false,
      });
    }

    // 2. Fetch Mirror v/3/ (Yurn / VidHide) which provides true direct HLS (.m3u8) in 4K
    const mirror3Url = epUrl.replace(/\/$/, "") + "/v/3/";
    try {
      const m3Res = await fetch(mirror3Url, { headers: H });
      if (m3Res.ok) {
        const m3Html = await m3Res.text();
        const iframeMatch = m3Html.match(/<iframe[^>]+src="([^"]+yurn\.online[^"]+)"/i) || m3Html.match(/<iframe[^>]+src="([^"]+vidhide[^"]+)"/i);
        if (iframeMatch) {
          const yurnUrl = iframeMatch[1].startsWith("//") ? `https:${iframeMatch[1]}` : iframeMatch[1];
          const yurnRes = await fetch(yurnUrl, {
            headers: {
              "User-Agent": UA,
              "Referer": `${BASE}/`,
            },
          });
          if (yurnRes.ok) {
            const yurnHtml = await yurnRes.text();
            // Unpack Packer JS script
            const scripts = yurnHtml.match(/<script[\s\S]*?<\/script>/gi) || [];
            for (const s of scripts) {
              if (s.includes("eval(function(p,a,c,k,e,d)")) {
                const unpacked = unpackPacker(s);
                const hlsMatch = unpacked.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
                if (hlsMatch) {
                  streams.unshift({
                    url: hlsMatch[0],
                    type: "hls",
                    server: "Lucifer 4K (HLS)",
                    referer: "https://yurn.online/",
                    quality: "4k",
                    priority: 5,
                    isActive: true,
                  });
                  break;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[luciferdonghua] Mirror v/3/ HLS extraction error:", e.message);
    }

    // Ensure at least one stream is marked active
    if (streams.length > 0 && !streams.some(s => s.isActive)) {
      streams[0].isActive = true;
    }

    return json({
      anilistId: Number(anilistId),
      episode: Number(epNum),
      audio: "sub",
      intro: { start: 0, end: 0 },
      outro: { start: 0, end: 0 },
      streams,
      subtitles,
      downloads,
      headers: { Referer: "https://yurn.online/" },
    });
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
