import {
  smartFetch,
  KNOWN_SERIES_MAP,
  findSeriesUrl,
} from "./providers/providers/donghuaworld.js";
import {
  KNOWN_DONGHUA_EN_TITLES,
  KNOWN_DONGHUA_POSTERS,
  KNOWN_DONGHUA_SERIES_RELATIONS,
} from "@/constants/donghua";
import { MediaFull, MediaStatus, RelationEdge } from "@/types/miruro-api";
import {
  get as cacheGet,
  set as cacheSet,
  SHOW_IDENTITY_TTL,
} from "./providers/core/smartcache.js";

function stripTags(s?: string | null): string {
  return (s || "").replace(/<[^>]+>/g, "").trim();
}

const TOP_DONGHUA_RECOMMENDATIONS = [
  { id: 196613, title: "Battle Through the Heavens Season 5" },
  { id: 152636, title: "Renegade Immortal" },
  { id: 166219, title: "Swallowed Star Season 4" },
  { id: 132405, title: "Perfect World" },
  { id: 156360, title: "Soul Land 2: The Unrivaled Tang Sect" },
  { id: 153070, title: "Shrouding the Heavens" },
  { id: 143588, title: "Throne of Seal" },
  { id: 160533, title: "Against the Gods" },
];

/**
 * Fetches and builds complete anime details from DonghuaWorld directly.
 * Decouples Donghua entirely from AniList to avoid episode/season mismatches.
 */
export async function fetchDonghuaWorldInfo(
  animeId: number | string,
): Promise<MediaFull | null> {
  const numId = Number(animeId);
  const cacheKey = `dhw:fullinfo:${numId}`;
  const cached = cacheGet(cacheKey);
  if (cached && cached.data) {
    return cached.data as MediaFull;
  }

  // 1. Resolve series URL
  let seriesUrl = (KNOWN_SERIES_MAP as Record<number, string>)[numId];
  if (!seriesUrl) {
    const canonicalTitle = KNOWN_DONGHUA_EN_TITLES[numId];
    if (canonicalTitle) {
      seriesUrl = await findSeriesUrl(numId, {
        title: { english: canonicalTitle },
      }).catch(() => null);
    }
  }

  if (!seriesUrl) {
    return null;
  }

  try {
    const res = await smartFetch(seriesUrl);
    if (!res.ok) {
      return null;
    }
    const html = await res.text();

    // 2. Extract Title
    const titleMatch = html.match(
      /<h1[^>]*class="entry-title"[^>]*>([\s\S]*?)<\/h1>/i,
    );
    const rawTitle = titleMatch ? stripTags(titleMatch[1]) : "";
    const canonicalTitle =
      KNOWN_DONGHUA_EN_TITLES[numId] || rawTitle || "Donghua";

    // 3. Extract Poster & Banner
    const thumbMatch = html.match(
      /<div class="thumb"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i,
    );
    const ogImgMatch = html.match(
      /<meta property="og:image" content="([^"]+)"/i,
    );
    const scrapedPoster = thumbMatch
      ? thumbMatch[1]
      : ogImgMatch
        ? ogImgMatch[1]
        : "";
    const poster = KNOWN_DONGHUA_POSTERS[numId] || scrapedPoster.trim();

    // 4. Extract Description
    const synMatch = html.match(
      /<div class="entry-content" itemprop="description">([\s\S]*?)<\/div>/i,
    );
    const description = synMatch ? stripTags(synMatch[1]) : "";

    // 5. Extract Metadata fields (Status, Studio, Duration, Season)
    let status: MediaStatus = "RELEASING";
    let studioName = "Tencent Penguin Pictures";
    let duration = 24;
    let seasonStr = "";

    const infoSpans = Array.from(
      html.matchAll(/<span><b>([^<]+)<\/b>([\s\S]*?)<\/span>/gi),
    ) as RegExpMatchArray[];
    for (const m of infoSpans) {
      const key = m[1].replace(/[:\s]/g, "").toLowerCase();
      const val = stripTags(m[2]);
      if (key.includes("status")) {
        if (val.toLowerCase().includes("completed")) {
          status = "FINISHED";
        } else {
          status = "RELEASING";
        }
      } else if (key.includes("studio")) {
        if (val) studioName = val;
      } else if (key.includes("duration")) {
        const durMatch = val.match(/(\d+)/);
        if (durMatch) duration = Number(durMatch[1]);
      } else if (key.includes("season")) {
        seasonStr = val;
      }
    }

    // 6. Extract Genres
    const genreMatch = html.match(/<div class="genxed">([\s\S]*?)<\/div>/i);
    const genres: string[] = genreMatch
      ? (Array.from(genreMatch[1].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)) as RegExpMatchArray[])
          .map((m) => stripTags(m[1]))
          .filter(Boolean)
      : ["Action", "Fantasy", "Cultivation", "Martial Arts"];

    // 7. Extract Total Episode Count from eplister
    let totalEpisodes = 0;
    const startIdx = html.indexOf('class="eplister"');
    if (startIdx !== -1) {
      const ulMatch = html.slice(startIdx).match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
      if (ulMatch) {
        const items = Array.from(
          ulMatch[1].matchAll(/<li[^>]*data-index="(\d+)"/gi),
        );
        totalEpisodes = items.length;
      }
    }

    // 8. Build Relations (Other seasons of this Donghua)
    const relationIds = KNOWN_DONGHUA_SERIES_RELATIONS[numId] || [numId];
    const relationEdges: RelationEdge[] = relationIds.map((relId, idx) => {
      const isCurrent = relId === numId;
      const relTitle = KNOWN_DONGHUA_EN_TITLES[relId] || `Season ${idx + 1}`;
      const relPoster =
        KNOWN_DONGHUA_POSTERS[relId] || (isCurrent ? poster : "");
      let relationType = "PREQUEL";
      if (isCurrent) {
        relationType = "CURRENT";
      } else if (relId > numId) {
        relationType = "SEQUEL";
      }

      return {
        relationType,
        node: {
          id: relId,
          title: {
            english: relTitle,
            romaji: relTitle,
            native: null,
          },
          coverImage: {
            large: relPoster,
            extraLarge: relPoster,
          },
          bannerImage: relPoster,
          format: "ONA",
          type: "ANIME",
          status: "FINISHED",
          episodes: null,
          meanScore: 85,
        },
      };
    });

    // 9. Build Recommended Donghua Nodes
    const recommendationNodes = TOP_DONGHUA_RECOMMENDATIONS.filter(
      (rec) => rec.id !== numId,
    ).map((rec) => {
      const recPoster = KNOWN_DONGHUA_POSTERS[rec.id] || poster;
      return {
        rating: 90,
        mediaRecommendation: {
          id: rec.id,
          title: {
            english: rec.title,
            romaji: rec.title,
            native: null,
          },
          coverImage: {
            large: recPoster,
            extraLarge: recPoster,
          },
          bannerImage: recPoster,
          format: "ONA" as const,
          episodes: null,
          status: "RELEASING" as const,
          meanScore: 88,
          averageScore: 88,
          genres: ["Action", "Fantasy", "Cultivation"],
        },
      };
    });

    const media: MediaFull = {
      id: numId,
      idMal: null,
      title: {
        english: canonicalTitle,
        romaji: canonicalTitle,
        native: null,
      },
      coverImage: {
        large: poster,
        extraLarge: poster,
      },
      bannerImage: poster,
      description:
        description ||
        `Watch full episodes of ${canonicalTitle} with English subtitles in HD/4K on DonghuaWorld.`,
      format: "ONA",
      season: null,
      seasonYear: 2024,
      episodes: totalEpisodes > 0 ? totalEpisodes : null,
      duration,
      status,
      averageScore: 88,
      meanScore: 88,
      popularity: 50000,
      favourites: 25000,
      genres: genres.length > 0 ? genres : ["Action", "Fantasy", "Martial Arts"],
      source: "ORIGINAL",
      countryOfOrigin: "CN",
      isAdult: false,
      studios: {
        nodes: [{ name: studioName, isAnimationStudio: true }],
      },
      nextAiringEpisode: null,
      startDate: { year: 2024, month: 1, day: 1 },
      endDate: { year: null, month: null, day: null },
      trending: 95,
      tags: [],
      hashtag: null,
      synonyms: [],
      siteUrl: seriesUrl,
      trailer: null,
      characters: { edges: [] },
      staff: { edges: [] },
      relations: { edges: relationEdges },
      recommendations: { nodes: recommendationNodes },
      externalLinks: [],
      streamingEpisodes: [],
      stats: { scoreDistribution: [], statusDistribution: [] },
    };

    cacheSet(cacheKey, media, SHOW_IDENTITY_TTL);
    return media;
  } catch (err: any) {
    console.error(`[fetchDonghuaWorldInfo] Error fetching ${animeId}:`, err);
    return null;
  }
}
