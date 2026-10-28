import { getMedia } from "../core/anilist.js";
import {
  buildTitles,
  buildTitleSearchQueries,
  decodeEntities,
  episodeMeta,
  json,
  stripTags,
  titleIdentityScore,
  UA,
} from "../core/new-provider-utils.js";
import {
  get as cacheGet,
  set as cacheSet,
  isFresh,
  SHOW_IDENTITY_TTL,
  WATCH_TTL,
} from "../core/smartcache.js";
import { wreqFetch } from "../core/wreq.js";

const BASE = "https://animepahe.pw";
const FALLBACK_BASES = ["https://animepahe.org", "https://animepahe.com"];
const COOKIE_JAR = new Map();

function getCookies() {
  return [...COOKIE_JAR.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(headers) {
  if (!headers) return;
  const setCookie = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : headers.get("set-cookie");
  if (!setCookie) return;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of list) {
    const parts = c.split(";")[0].split("=");
    if (parts.length >= 2) {
      COOKIE_JAR.set(parts[0].trim(), parts.slice(1).join("=").trim());
    }
  }
}

async function smartFetch(url, options = {}) {
  const cookieStr = getCookies();
  const headers = {
    "User-Agent": UA,
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": `${BASE}/`,
    ...(cookieStr ? { Cookie: cookieStr } : {}),
    ...(options.headers || {}),
  };

  const urlsToTry = [url];
  for (const fb of FALLBACK_BASES) {
    if (url.startsWith(BASE)) {
      urlsToTry.push(url.replace(BASE, fb));
    }
  }

  let lastError = null;
  for (const targetUrl of urlsToTry) {
    // 1. Try wreqFetch
    try {
      const res = await wreqFetch(targetUrl, {
        ...options,
        headers,
        session: "animepahe",
        browser: "chrome_149",
        os: "windows",
        warm: [{
          url: `${new URL(targetUrl).origin}/`,
          headers: {
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        }],
      });
      storeCookies(res.headers);
      if (res.ok) return res;
      if (res.status !== 403 && res.status !== 503) {
        return res;
      }
    } catch (err) {
      lastError = err;
    }

    // 2. Try native fetch fallback
    try {
      const res = await fetch(targetUrl, {
        ...options,
        headers,
      });
      storeCookies(res.headers);
      if (res.ok) return res;
      if (res.status !== 403 && res.status !== 503) {
        return res;
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`AnimePahe request failed for ${url}`);
}

/**
 * Dean Edwards JavaScript unpacker for p,a,c,k,e,d scripts
 */
function unpackJs(code) {
  if (!code || typeof code !== "string") return "";
  const match = code.match(/}\s*\('(.*)',\s*(\d+),\s*(\d+),\s*'([^']*)'\.split\('\|'\)/s);
  if (!match) return code;

  let [, p, aStr, cStr, kStr] = match;
  let a = parseInt(aStr, 10);
  let c = parseInt(cStr, 10);
  const k = kStr.split("|");

  const e = (val) => {
    return (val < a ? "" : e(Math.floor(val / a))) +
      ((val = val % a) > 35 ? String.fromCharCode(val + 29) : val.toString(36));
  };

  while (c--) {
    if (k[c]) {
      const regex = new RegExp(`\\b${e(c)}\\b`, "g");
      p = p.replace(regex, k[c]);
    }
  }
  return p;
}

/**
 * Searches AnimePahe for anime title queries
 */
async function searchAnimePahe(query) {
  try {
    const res = await smartFetch(`${BASE}/api?m=search&q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    return Array.isArray(data?.data) ? data.data : [];
  } catch (e) {
    console.warn(`[animepahe] Search failed for query "${query}":`, e.message);
    return [];
  }
}

/**
 * Resolves AniList anime to AnimePahe series
 */
export async function resolveSeries(anilistId, ctx = {}) {
  const cacheKey = `np:match2:animepahe:${anilistId}`;
  const cached = cacheGet(cacheKey);
  if (isFresh(cached)) return cached.data;

  const media = ctx.media ?? (await getMedia(anilistId).catch(() => null));
  if (!media) throw new Error(`AnimePahe: could not resolve media for AniList ${anilistId}`);

  const titles = buildTitles(media, ctx.anizip);
  const queries = buildTitleSearchQueries(titles, 12);

  const candidatesMap = new Map();
  for (const q of queries) {
    const results = await searchAnimePahe(q);
    for (const r of results) {
      if (r?.session && !candidatesMap.has(r.session)) {
        candidatesMap.set(r.session, r);
      }
    }
    if (candidatesMap.size >= 8) break;
  }

  const candidates = Array.from(candidatesMap.values());
  if (!candidates.length) {
    throw new Error(`AnimePahe: No series found for AniList ${anilistId}`);
  }

  const expectedYear = media.startDate?.year || (media.seasonYear ? Number(media.seasonYear) : null);
  const expectedFormat = (media.format || "").toUpperCase();

  let bestMatch = null;
  let bestScore = -1;

  for (const item of candidates) {
    const itemTitle = item.title || "";
    let score = titleIdentityScore(titles, [itemTitle]);

    if (expectedYear && item.year) {
      if (Number(item.year) === Number(expectedYear)) {
        score += 0.2;
      } else if (Math.abs(Number(item.year) - Number(expectedYear)) === 1) {
        score += 0.05;
      } else {
        score -= 0.15;
      }
    }

    if (expectedFormat && item.type) {
      const itType = item.type.toUpperCase();
      if (itType === expectedFormat) {
        score += 0.1;
      } else if (expectedFormat === "TV" && itType === "TV") {
        score += 0.1;
      }
    }

    if (media.episodes && item.episodes) {
      if (Number(media.episodes) === Number(item.episodes)) {
        score += 0.15;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (!bestMatch || bestScore < 0.35) {
    bestMatch = candidates[0];
  }

  const matchData = {
    id: bestMatch.id,
    session: bestMatch.session,
    title: bestMatch.title,
    episodes: bestMatch.episodes,
    poster: bestMatch.poster,
  };

  cacheSet(cacheKey, matchData, SHOW_IDENTITY_TTL);
  return matchData;
}

/**
 * Fetches all releases/episodes for an anime session from AnimePahe
 */
async function fetchAllReleases(animeSession) {
  const firstUrl = `${BASE}/api?m=release&id=${animeSession}&sort=episode_asc&page=1`;
  const firstRes = await smartFetch(firstUrl);
  if (!firstRes.ok) {
    throw new Error(`AnimePahe: HTTP ${firstRes.status} fetching release page 1`);
  }
  const firstData = await firstRes.json();
  const allReleases = [...(Array.isArray(firstData?.data) ? firstData.data : [])];
  const lastPage = firstData?.last_page || 1;

  if (lastPage > 1) {
    const pageTasks = [];
    for (let p = 2; p <= Math.min(lastPage, 50); p++) {
      const pageUrl = `${BASE}/api?m=release&id=${animeSession}&sort=episode_asc&page=${p}`;
      pageTasks.push(
        smartFetch(pageUrl)
          .then((r) => r.json())
          .then((d) => (Array.isArray(d?.data) ? d.data : []))
          .catch(() => [])
      );
    }
    const additional = await Promise.all(pageTasks);
    for (const chunk of additional) {
      allReleases.push(...chunk);
    }
  }

  return allReleases;
}

/**
 * Gets episode listing for an AniList ID from AnimePahe
 */
export async function getEpisodes(anilistId, ctx = {}) {
  const series = await resolveSeries(anilistId, ctx);
  const releases = await fetchAllReleases(series.session);

  if (!releases.length) {
    throw new Error(`AnimePahe: No releases found for session ${series.session}`);
  }

  const sub = [];
  const dub = [];
  const seenSub = new Set();
  const seenDub = new Set();

  for (const item of releases) {
    const epNum = Number(item.episode);
    if (!Number.isFinite(epNum) || epNum <= 0) continue;

    const isDub = item.audio === "eng";
    const cleanTitle = item.title && !item.title.toLowerCase().startsWith("episode")
      ? `Episode ${epNum}: ${item.title}`
      : `Episode ${epNum}`;

    const epEntry = {
      id: `watch/animepahe/${anilistId}/${isDub ? "dub" : "sub"}/animepahe-${epNum}`,
      number: epNum,
      title: cleanTitle,
      duration: item.duration ? 1440 : 1440,
      audio: isDub ? "dub" : "sub",
      filler: item.filler === 1,
      recap: false,
      uncensored: false,
      description: "",
      image: item.snapshot || null,
      airDate: item.created_at || null,
      session: item.session,
    };

    if (isDub) {
      if (!seenDub.has(epNum)) {
        seenDub.add(epNum);
        dub.push(epEntry);
      }
    } else {
      if (!seenSub.has(epNum)) {
        seenSub.add(epNum);
        sub.push(epEntry);
      }
    }
  }

  sub.sort((a, b) => a.number - b.number);
  dub.sort((a, b) => a.number - b.number);

  return {
    source: "animepahe",
    episodes: {
      sub,
      dub,
    },
  };
}

/**
 * Resolves streams for a given episode
 */
export async function handleWatch(anilistId, audio, epNum) {
  const series = await resolveSeries(anilistId);
  const releases = await fetchAllReleases(series.session);

  const isTargetDub = audio === "dub";
  const targetRelease =
    releases.find((r) => Number(r.episode) === Number(epNum) && (isTargetDub ? r.audio === "eng" : r.audio !== "eng")) ||
    releases.find((r) => Number(r.episode) === Number(epNum)) ||
    releases[0];

  if (!targetRelease?.session) {
    return json({ error: `AnimePahe: Episode ${epNum} not found` }, 404);
  }

  const streams = [];
  const subtitles = [];
  const downloads = [];

  // 1. Fetch links via API
  try {
    const linksUrl = `${BASE}/api?m=links&id=${series.id}&session=${targetRelease.session}&p=kwik`;
    const linksRes = await smartFetch(linksUrl);
    if (linksRes.ok) {
      const linksJson = await linksRes.json();
      const dataArr = Array.isArray(linksJson?.data) ? linksJson.data : [];
      for (const group of dataArr) {
        for (const [resKey, info] of Object.entries(group)) {
          const kwikUrl = info?.kwik;
          if (!kwikUrl) continue;

          // Add embed fallback
          streams.push({
            server: `Kwik (${resKey}p)`,
            url: kwikUrl,
            type: "embed",
            quality: `${resKey}p`,
            priority: resKey === "1080" ? 1 : (resKey === "720" ? 2 : 3),
            isActive: true,
          });

          // Attempt to extract direct HLS .m3u8 from Kwik
          try {
            const kwikRes = await smartFetch(kwikUrl, {
              headers: { Referer: `${BASE}/` },
            });
            if (kwikRes.ok) {
              const kwikHtml = await kwikRes.text();
              const unpacked = unpackJs(kwikHtml);
              const m3u8Match = (unpacked + kwikHtml).match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
              if (m3u8Match) {
                const streamUrl = m3u8Match[0].replace(/\\/g, "");
                streams.unshift({
                  server: `Kwik Direct (${resKey}p)`,
                  url: streamUrl,
                  type: "hls",
                  quality: `${resKey}p`,
                  priority: resKey === "1080" ? 1 : (resKey === "720" ? 2 : 3),
                  isActive: true,
                });
              }
            }
          } catch {}
        }
      }
    }
  } catch (e) {
    console.warn("[animepahe] links API fetch failed:", e.message);
  }

  // 2. Fallback to scraping play page
  if (!streams.length) {
    try {
      const playUrl = `${BASE}/play/${series.session}/${targetRelease.session}`;
      const playRes = await smartFetch(playUrl);
      if (playRes.ok) {
        const playHtml = await playRes.text();
        const kwikMatches = Array.from(
          playHtml.matchAll(/data-src=["'](https?:\/\/[^"']*kwik\.[^"']+)["'][^>]*data-resolution=["'](\d+)["']/gi)
        );
        for (const m of kwikMatches) {
          const kwikUrl = m[1];
          const resolution = m[2] || "720";
          streams.push({
            server: `Kwik (${resolution}p)`,
            url: kwikUrl,
            type: "embed",
            quality: `${resolution}p`,
            priority: resolution === "1080" ? 1 : (resolution === "720" ? 2 : 3),
            isActive: true,
          });
        }
      }
    } catch (playErr) {
      console.warn("[animepahe] play page fallback failed:", playErr.message);
    }
  }

  streams.sort((a, b) => (a.priority || 99) - (b.priority || 99));

  const payload = {
    anilistId: Number(anilistId),
    episode: Number(epNum),
    audio: isTargetDub ? "dub" : "sub",
    intro: { start: 0, end: 0 },
    outro: { start: 0, end: 0 },
    streams,
    sources: streams.filter((s) => s.type === "hls" || s.type === "mp4"),
    allStreams: streams,
    subtitles,
    downloads,
    headers: { Referer: `${BASE}/` },
  };

  return json(payload, 200, {
    "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/watch\/animepahe\/(\d+)\/(sub|dub)\/animepahe-(\d+)\/?$/);
    if (!m) {
      return json({ error: "AnimePahe: Route not found" }, 404);
    }
    const [, anilistId, audio, epNum] = m;
    return handleWatch(anilistId, audio, epNum);
  },
};
