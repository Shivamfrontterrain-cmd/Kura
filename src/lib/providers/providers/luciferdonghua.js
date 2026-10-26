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

  const isMovie = media?.format === "MOVIE";

  for (const query of queries) {
    try {
      const searchUrl = `${BASE}/?s=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, { headers: H });
      if (!res.ok) continue;
      const html = await res.text();

      // Find series links: <a href="https://luciferdonghua.in/anime/{slug}/" ...>
      const animeMatches = Array.from(html.matchAll(/<a\s+href="(https:\/\/luciferdonghua\.in\/anime\/[^"/]+\/)"[^>]*title="([^"]*)"/gi));
      // Filter out unwanted aggregator links like /anime/lucifer-donghua/
      const filteredMatches = animeMatches.filter(([, url]) => !url.includes("lucifer-donghua"));

      if (filteredMatches.length > 0) {
        let bestUrl = null;

        if (isMovie) {
          // If media is a movie, prefer matches with "movie"
          const movieMatch = filteredMatches.find(([, , title]) => {
            const lower = title.toLowerCase();
            return lower.includes("movie") || lower.includes("juchang ban");
          });
          bestUrl = movieMatch ? movieMatch[1] : filteredMatches[0][1];
        } else {
          // If TV series, deprioritize matches with "movie", "special", "battle of gods"
          const seriesMatch = filteredMatches.find(([, , title]) => {
            const lower = title.toLowerCase();
            return !lower.includes("movie") && !lower.includes("juchang ban") && !lower.includes("slaying the blood");
          });
          bestUrl = seriesMatch ? seriesMatch[1] : filteredMatches[0][1];
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
    const options = Array.from(html.matchAll(/<option\s+value="([^"]+)"[^>]*data-index="(\d+)"[^>]*>([\s\S]*?)<\/option>/gi));

    // Fetch all mirrors in parallel for maximum speed
    const mirrorFetches = options.map(async (opt) => {
      const vUrl = opt[1];
      const dataIdx = opt[2];
      const rawLabel = opt[3].replace(/\s+/g, " ").trim();
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

      // 1. Dailymotion Server
      if (lower.includes("dailymotion") || dataIdx === "1") {
        const vDm = vHtml.match(/data-video="([a-zA-Z0-9]+)"/i)
          || vHtml.match(/embedUrl["']\s+content=["'](https:\/\/geo\.dailymotion\.com\/player\/[^"']+)["']/i);
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
            isActive: false,
          });
        }
      }
      // 2. Rumble Server
      else if (lower.includes("rumble") || dataIdx === "2") {
        const rumbleMatch = vHtml.match(/src="(https:\/\/rumble\.com\/embed\/[^"]+)"/i);
        if (rumbleMatch) {
          streams.push({
            server: "Rumble (4K)",
            url: rumbleMatch[1],
            type: "embed",
            quality: "4k",
            priority: 3,
            isActive: false,
          });
        }
      }
      // 3. VidHide / Yurn Server (4K direct HLS stream via Packer unpack)
      else if (lower.includes("vid hide") || lower.includes("vidhide") || lower.includes("yurn") || dataIdx === "3") {
        const iframeMatch = vHtml.match(/<iframe[^>]+src="([^"]+yurn\.online[^"]+)"/i) || vHtml.match(/<iframe[^>]+src="([^"]+vidhide[^"]+)"/i);
        if (iframeMatch) {
          const yurnUrl = iframeMatch[1].startsWith("//") ? `https:${iframeMatch[1]}` : iframeMatch[1];
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
      }
      // 4. OK.RU Server
      else if (lower.includes("ok.ru") || lower.includes("okru") || dataIdx === "4") {
        const okMatch = vHtml.match(/src="(\/\/[^"]*ok\.ru\/videoembed\/[^"]+)"/i) || vHtml.match(/src="(https?:\/\/[^"]*ok\.ru\/videoembed\/[^"]+)"/i);
        if (okMatch) {
          const okUrl = okMatch[1].startsWith("//") ? `https:${okMatch[1]}` : okMatch[1];
          streams.push({
            server: "OK.RU (4K)",
            url: okUrl,
            type: "embed",
            quality: "4k",
            priority: 4,
            isActive: false,
          });
        }
      }
      // 5. Generic extra server (e.g. Server 5 / MisterDonghua)
      else {
        const genIframe = vHtml.match(/<iframe[^>]+src="([^"]+)"/i);
        if (genIframe && !genIframe[1].includes("t.co") && !genIframe[1].includes("about:blank")) {
          const genUrl = genIframe[1].startsWith("//") ? `https:${genIframe[1]}` : genIframe[1];
          const cleanLabel = rawLabel.replace(/\[|\]|- Server/gi, "").trim() || `Server ${dataIdx}`;
          streams.push({
            server: cleanLabel,
            url: genUrl,
            type: "embed",
            priority: 10 + Number(dataIdx),
            isActive: false,
          });
        }
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
