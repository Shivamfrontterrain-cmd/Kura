import { GET_ALL_EPISODES } from "@/constants/query-keys";
import { api } from "@/lib/api";
import { resolveApiEndpoint } from "@/lib/local-proxy";
import { Episode, IEpisodes } from "@/types/episodes";
import { EpisodeResponse, NextAiringEpisode } from "@/types/miruro-api";
import { useQuery } from "@tanstack/react-query";
import { isKnownDonghua } from "@/constants/donghua";

const KNOWN_PROVIDERS = [
  "donghuaworld",
  "animepahe",
  "anizone",
  "reanime",
  "anikoto",
  "aniwaves",
  "animegg",
  "animenosub",
  "kaa",
  "animedunya",
  "animeonsen",
  "senshi",
  "anipm",
  "mkissa",
];

export interface IEpisodesData extends IEpisodes {
  rawResponse?: EpisodeResponse;
  availableProviders?: string[];
  nextAiringEpisode?: NextAiringEpisode | null;
}

const fetchAniListEpisodesFallback = async (
  animeId: string,
): Promise<IEpisodesData> => {
  try {
    const query = `
      query ($id: Int) {
        Media (id: $id, type: ANIME) {
          id
          episodes
          nextAiringEpisode {
            episode
            airingAt
            timeUntilAiring
          }
        }
      }
    `;
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { id: parseInt(animeId, 10) || 0 },
      }),
    });

    const json = await res.json();
    const media = json?.data?.Media;
    const totalEpCount = media?.nextAiringEpisode?.episode
      ? media.nextAiringEpisode.episode - 1
      : media?.episodes || 12;

    const episodes: Episode[] = Array.from(
      { length: totalEpCount > 0 ? totalEpCount : 12 },
      (_, i) => {
        const epNum = i + 1;
        return {
          title: `Episode ${epNum}`,
          episodeId: `${epNum}`,
          number: epNum,
          isFiller: false,
          hasSub: true,
          hasDub: false,
        };
      },
    );

    return {
      totalEpisodes: episodes.length,
      episodes,
      availableProviders: [],
      nextAiringEpisode: media?.nextAiringEpisode || null,
    };
  } catch (err) {
    console.error("AniList fallback error:", err);
    const fallbackEpisodes: Episode[] = Array.from({ length: 12 }, (_, i) => ({
      title: `Episode ${i + 1}`,
      episodeId: `${i + 1}`,
      number: i + 1,
      isFiller: false,
      hasSub: true,
      hasDub: false,
    }));
    return {
      totalEpisodes: 12,
      episodes: fallbackEpisodes,
      availableProviders: [],
    };
  }
};

const getAllEpisodes = async (animeId: string): Promise<IEpisodesData> => {
  try {
    const endpointUrl = await resolveApiEndpoint(`/episodes/${animeId}`);
    const res = endpointUrl.startsWith("http")
      ? await fetch(endpointUrl).then(async (r) => ({ data: await r.json() }))
      : await api.get<EpisodeResponse>(`/episodes/${animeId}`);
    const data: any = res.data;

    const providersMap: Record<string, any> = { ...(data.providers || {}) };
    for (const p of KNOWN_PROVIDERS) {
      if (!providersMap[p] && data[p] && !data[p].error && data[p].episodes) {
        const subLen = data[p].episodes?.sub?.length || 0;
        const dubLen = data[p].episodes?.dub?.length || 0;
        if (subLen > 0 || dubLen > 0) {
          providersMap[p] = data[p];
        }
      }
    }

    // Strict Donghua detection and isolation:
    // If it is Donghua, strictly and ONLY use donghuaworld! Never mix in Japanese providers!
    const epCo = String(data?.countryOfOrigin || data?.mappings?.countryOfOrigin || "").toUpperCase();
    const isNonDonghuaCountry = epCo === "JP" || epCo === "JA" || epCo === "KR" || epCo === "KO";
    const isDonghua = !isNonDonghuaCountry && (
      isKnownDonghua(animeId, data?.mappings || data) ||

      data?.countryOfOrigin === "CN" ||
      data?.mappings?.countryOfOrigin === "CN" ||
      data?.isDonghua === true);

    if (isDonghua) {
      // STRICT DONGHUA RESTRICTION: immediately purge all non-donghuaworld providers
      for (const k of Object.keys(providersMap)) {
        if (k !== "donghuaworld") {
          delete providersMap[k];
        }
      }

      // If donghuaworld is missing from providersMap, explicitly fetch it from /episodes/donghuaworld/${animeId}
      if (!providersMap["donghuaworld"]) {
        try {
          const dhwEndpoint = await resolveApiEndpoint(`/episodes/donghuaworld/${animeId}`);
          const dhwRes: any = dhwEndpoint.startsWith("http")
            ? await fetch(dhwEndpoint).then((r) => r.json())
            : (await api.get(`/episodes/donghuaworld/${animeId}`)).data;
          if (dhwRes?.donghuaworld && !dhwRes.donghuaworld.error) {
            providersMap["donghuaworld"] = dhwRes.donghuaworld;
          }
        } catch (e) {
          console.warn("[get-all-episodes] Direct fetch of donghuaworld failed:", e);
        }
      }
    } else {
      // STRICT NON-DONGHUA RESTRICTION: remove donghuaworld
      delete providersMap["donghuaworld"];
    }

    const providerNames = Object.keys(providersMap).sort((a, b) => {
      const idxA = KNOWN_PROVIDERS.indexOf(a);
      const idxB = KNOWN_PROVIDERS.indexOf(b);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    const subEpNumbers = new Set<number>();
    const dubEpNumbers = new Set<number>();

    for (const pName of providerNames) {
      const pData = providersMap[pName]?.episodes;
      if (pData?.sub) {
        pData.sub.forEach((ep: any) => subEpNumbers.add(Number(ep.number)));
      }
      if (pData?.dub) {
        pData.dub.forEach((ep: any) => dubEpNumbers.add(Number(ep.number)));
      }
    }

    const allEpNumbersSet = new Set<number>([
      ...Array.from(subEpNumbers),
      ...Array.from(dubEpNumbers),
    ]);
    const allEpisodeNumbers = Array.from(allEpNumbersSet)
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);

    const episodeList: Episode[] = allEpisodeNumbers.map((epNum) => {
      let epDetail: any = null;
      let fallbackId = "";

      for (const pName of providerNames) {
        const pData = providersMap[pName]?.episodes;
        const subMatch = pData?.sub?.find((e: any) => Number(e.number) === epNum);
        const dubMatch = pData?.dub?.find((e: any) => Number(e.number) === epNum);

        if (subMatch) {
          epDetail = subMatch;
          fallbackId = subMatch.id;
          break;
        }
        if (dubMatch && !epDetail) {
          epDetail = dubMatch;
          fallbackId = dubMatch.id;
        }
      }

      return {
        title: epDetail?.title || `Episode ${epNum}`,
        episodeId: fallbackId || `${epNum}`,
        number: epNum,
        isFiller: !!epDetail?.filler,
        hasSub: subEpNumbers.has(epNum),
        hasDub: dubEpNumbers.has(epNum),
      };
    });

    if (episodeList.length === 0) {
      if (isDonghua) {
        return {
          totalEpisodes: 0,
          episodes: [],
          availableProviders: ["donghuaworld"],
        };
      }
      return await fetchAniListEpisodesFallback(animeId);
    }

    const normalizedRawResponse: EpisodeResponse = {
      ...data,
      mappings: data.mappings || { anilistId: Number(animeId) },
      providers: providersMap,
    };

    return {
      totalEpisodes: episodeList.length,
      episodes: episodeList,
      rawResponse: normalizedRawResponse,
      availableProviders: providerNames,
      nextAiringEpisode: data.mappings?.nextAiringEpisode || null,
    };
  } catch (err) {
    if (isKnownDonghua(animeId)) {
      console.warn(`Upstream /episodes API failed for donghua ${animeId}:`, err);
      try {
        const dhwEndpoint = await resolveApiEndpoint(`/episodes/donghuaworld/${animeId}`);
        const dhwRes: any = dhwEndpoint.startsWith("http")
          ? await fetch(dhwEndpoint).then((r) => r.json())
          : (await api.get(`/episodes/donghuaworld/${animeId}`)).data;
        const subEps = dhwRes?.donghuaworld?.episodes?.sub || [];
        if (subEps.length > 0) {
          const episodeList: Episode[] = subEps.map((ep: any) => ({
            title: ep.title || `Episode ${ep.number}`,
            episodeId: ep.id || `${ep.number}`,
            number: ep.number,
            isFiller: false,
            hasSub: true,
            hasDub: false,
          }));
          return {
            totalEpisodes: episodeList.length,
            episodes: episodeList,
            availableProviders: ["donghuaworld"],
          };
        }
      } catch (dhwErr) {
        console.error("Direct fallback to donghuaworld failed:", dhwErr);
      }
      return {
        totalEpisodes: 0,
        episodes: [],
        availableProviders: ["donghuaworld"],
      };
    }
    console.warn(
      `Upstream /episodes API failed for animeId ${animeId}. Using AniList fallback:`,
      err,
    );
    return await fetchAniListEpisodesFallback(animeId);
  }
};

export const useGetAllEpisodes = (animeId: string) => {
  return useQuery({
    queryFn: () => getAllEpisodes(animeId),
    queryKey: [GET_ALL_EPISODES, animeId],
    enabled: !!animeId,
  });
};
