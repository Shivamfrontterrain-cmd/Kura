"use client";

import EpisodeCard from "./common/episode-card";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAnimeStore } from "@/store/anime-store";
import { Episode, IEpisodes } from "@/types/episodes";
import Select, { ISelectOptions } from "./common/select";
import { Input } from "./ui/input";
import { Bookmark } from "@/hooks/use-get-bookmark";

type Props = {
  animeId: string;
  title: string;
  subOrDub?: { sub: number; dub: number };
  episodes: IEpisodes;
  isLoading: boolean;
  bookmarks?: Bookmark[] | null;
};

const EpisodePlaylist = ({
  animeId,
  title,
  subOrDub,
  episodes,
  isLoading,
  bookmarks,
}: Props) => {
  const searchParams = useSearchParams();

  const episodeId = searchParams.get("episode");

  const isLatestEpisode = searchParams.get("type");

  const { setSelectedEpisode } = useAnimeStore();

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const episodeRefs = useRef<(HTMLDivElement | null)[]>([]);

  const groupOptions = React.useCallback((): ISelectOptions[] => {
    if (!episodes?.episodes?.length) return [];
    const options: ISelectOptions[] = [];
    const eps = episodes.episodes;
    // group episodes in range of 50
    for (let i = 0; i < eps.length; i += 50) {
      const startEp = eps[i].number;
      const endEp = eps[Math.min(i + 49, eps.length - 1)].number;
      const range = startEp === endEp ? `${startEp}` : `${startEp} - ${endEp}`;
      options.push({
        label: range,
        value: range,
      });
    }
    return options;
  }, [episodes?.episodes]);

  const [currentGroup, setCurrentGroup] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filteredEpisodes, setFilteredEpisodes] = React.useState<Episode[]>([]);

  useEffect(() => {
    const epQuery = searchParams.get("ep");
    if (
      !epQuery &&
      (!episodeId || !episodeId.includes("ep")) &&
      !!episodes &&
      !!episodes.episodes.length
    ) {
      if (!!isLatestEpisode) {
        setSelectedEpisode(
          episodes.episodes[episodes.episodes.length - 1].episodeId as string,
        );
      } else {
        setSelectedEpisode(episodes.episodes[0].episodeId as string);
      }
    }
    //eslint-disable-next-line
  }, [episodes]);

  useEffect(() => {
    if (!episodes?.episodes?.length) return;

    const options = groupOptions();
    if (!options.length) {
      setFilteredEpisodes(episodes.episodes);
      return;
    }

    const epParam = searchParams.get("ep");
    const activeEpNum = epParam
      ? Number(epParam)
      : episodeId
        ? episodes.episodes.find((e) => e.episodeId === episodeId)?.number || null
        : null;

    let targetIndex = 0;
    if (activeEpNum !== null && !isNaN(activeEpNum)) {
      const foundIdx = options.findIndex((opt) => {
        const parts = opt.value.split(" - ").map(Number);
        const start = parts[0];
        const end = parts.length > 1 && !isNaN(parts[1]) ? parts[1] : start;
        return activeEpNum >= start && activeEpNum <= end;
      });
      if (foundIdx !== -1) {
        targetIndex = foundIdx;
      }
    } else if (currentGroup) {
      const existingIdx = options.findIndex((opt) => opt.value === currentGroup);
      if (existingIdx !== -1) {
        targetIndex = existingIdx;
      }
    }

    const selectedOption = options[targetIndex] || options[0];
    setCurrentGroup(selectedOption.value);
    setFilteredEpisodes(
      episodes.episodes.slice(targetIndex * 50, (targetIndex + 1) * 50),
    );
  }, [episodes, searchParams, episodeId, groupOptions]);

  useEffect(() => {
    if (!filteredEpisodes?.length) return;
    const epParam = searchParams.get("ep");
    const activeEpNum = epParam ? Number(epParam) : null;
    const episodeIndex = filteredEpisodes.findIndex((ep) =>
      activeEpNum !== null ? ep.number === activeEpNum : ep.episodeId === episodeId,
    );

    if (
      episodeIndex >= 0 &&
      episodeRefs.current[episodeIndex]
    ) {
      const episodeElement = episodeRefs.current[episodeIndex];
      const scrollContainer = scrollContainerRef.current;

      if (episodeElement && scrollContainer) {
        const episodeOffsetTop = episodeElement.offsetTop;
        scrollContainer.scrollTop =
          episodeOffsetTop -
          scrollContainer.offsetHeight / 2 +
          episodeElement.offsetHeight / 2 +
          80;
      }
    }
  }, [animeId, episodeId, searchParams, filteredEpisodes]);

  const handleOnSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!episodes?.episodes) return;
    const value = e.target.value.toLowerCase().trim();
    setSearch(value);

    if (!value) {
      const options = groupOptions();
      const rangeIndex = options.findIndex((opt) => opt.value === currentGroup);
      const targetIndex = rangeIndex !== -1 ? rangeIndex : 0;
      setFilteredEpisodes(
        episodes.episodes.slice(targetIndex * 50, (targetIndex + 1) * 50),
      );
      return;
    }

    const filtered = episodes.episodes.filter((episode) => {
      const epNumStr = episode.number.toString();
      const epTitle = (episode.title || "").toLowerCase();
      return (
        epNumStr === value ||
        epNumStr.includes(value) ||
        epTitle.includes(value) ||
        `episode ${epNumStr}`.includes(value)
      );
    });

    setFilteredEpisodes(filtered);
  };

  const handleOnSelectChange = (range: string) => {
    setCurrentGroup(range);
    const options = groupOptions();
    const rangeIndex = options.findIndex((opt) => opt.value === range);
    if (rangeIndex !== -1 && episodes?.episodes) {
      setFilteredEpisodes(
        episodes.episodes.slice(rangeIndex * 50, (rangeIndex + 1) * 50),
      );
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  return (
    episodes && (
      <div className="col-span-1 flex flex-col w-full gap-5 border-[.0313rem] border-secondary rounded-md overflow-hidden min-h-[20vh] sm:min-h-[30vh] md:min-h-[40vh] lg:min-h-[60vh] max-h-[500px]">
        <div className="h-fit bg-[#18181a] px-5 py-3">
          <h3 className="text-lg font-semibold"> Episode Playlist</h3>
          <span className="text-sm font-thin">{title}</span>
          <div className="flex flex-row w-full items-center justify-between gap-2 mt-2">
            <Input
              placeholder="Search Episode"
              value={search}
              onChange={handleOnSearchChange}
              className="w-1/2"
            />
            <Select
              value={currentGroup}
              placeholder={currentGroup}
              onChange={handleOnSelectChange}
              options={groupOptions()}
              className="w-1/2"
            />
          </div>
        </div>
        <div
          ref={scrollContainerRef}
          className={`flex flex-col flex-grow gap-1 px-2 pb-3 overflow-y-auto`}
        >
          {filteredEpisodes &&
            filteredEpisodes.map((episode, idx) => (
              //@ts-expect-error type mismatch
              <div key={idx} ref={(el) => (episodeRefs.current[idx] = el)}>
                <EpisodeCard
                  subOrDub={subOrDub}
                  variant={"list"}
                  episode={episode}
                  animeId={animeId}
                  watchedEpisodes={bookmarks?.[0].expand.watchHistory}
                />
              </div>
            ))}
          {!filteredEpisodes?.length && !isLoading && "No Episodes"}
          {isLoading && <PlaylistSkeleton />}
        </div>
      </div>
    )
  );
};

const PlaylistSkeleton = () => {
  return (
    <>
      {[1, 1, 1, 1, 1, 1, 1, 1, 1].map((_, idx) => {
        return (
          <div
            className="flex gap-5 items-center w-full relative !min-h-16 rounded-md  animate-pulse bg-slate-800"
            key={idx}
          ></div>
        );
      })}
    </>
  );
};

export default EpisodePlaylist;
