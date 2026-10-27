"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { Search } from "lucide-react";
import EpisodeCard from "./common/episode-card";
import { useGetAllEpisodes } from "@/query/get-all-episodes";
import { Episode } from "@/types/episodes";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type Props = {
  animeId: string;
};

const AnimeEpisodes = ({ animeId }: Props) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [ranges, setRanges] = useState<string[]>([]);
  const [selectedRange, setSelectedRange] = useState<string>("");

  const { data, isLoading } = useGetAllEpisodes(animeId);

  useEffect(() => {
    if (data) {
      const allEps = data.episodes || [];
      setAllEpisodes(allEps);

      if (allEps.length > 50) {
        // Calculate ranges using actual episode numbers
        const rangesArray: string[] = [];
        for (let i = 0; i < allEps.length; i += 50) {
          const startEp = allEps[i].number;
          const endEp = allEps[Math.min(i + 50, allEps.length) - 1].number;
          rangesArray.push(startEp === endEp ? `${startEp}` : `${startEp}-${endEp}`);
        }
        setRanges(rangesArray);
        setSelectedRange(rangesArray[0]);

        // Filter the first range directly from episodes
        setEpisodes(allEps.slice(0, 50));
      } else {
        setRanges([]);
        setSelectedRange("");
        setEpisodes(allEps);
      }
    }
  }, [data]);

  const handleRangeChange = (range: string) => {
    setSelectedRange(range);

    const rangeIndex = ranges.indexOf(range);
    if (rangeIndex !== -1) {
      const startIdx = rangeIndex * 50;
      setEpisodes(allEpisodes.slice(startIdx, startIdx + 50));
    } else {
      const parts = range.split("-").map(Number);
      const start = parts[0];
      const end = parts.length > 1 && !isNaN(parts[1]) ? parts[1] : start;
      const filteredEpisodes = allEpisodes.filter(
        (ep) => ep.number >= start && ep.number <= end,
      );
      setEpisodes(filteredEpisodes);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      // Reset episodes to the selected range
      if (selectedRange && ranges.length > 0) {
        const rangeIndex = ranges.indexOf(selectedRange);
        if (rangeIndex !== -1) {
          const startIdx = rangeIndex * 50;
          setEpisodes(allEpisodes.slice(startIdx, startIdx + 50));
        } else {
          setEpisodes(allEpisodes.slice(0, 50));
        }
      } else {
        setEpisodes(allEpisodes);
      }
    } else {
      const filteredEpisodes = allEpisodes.filter((episode) => {
        const epNumStr = episode.number.toString();
        const epTitle = (episode.title || "").toLowerCase();
        return (
          epNumStr === query ||
          epNumStr.includes(query) ||
          epTitle.includes(query) ||
          `episode ${epNumStr}`.includes(query)
        );
      });
      setEpisodes(filteredEpisodes);
    }
  };

  return (
    <>
      <div className="flex w-full items-center justify-between">
        <h3 className="text-xl font-semibold">Episodes</h3>
        <div className="flex items-center gap-2">
          {ranges.length > 0 && (
            <Select onValueChange={handleRangeChange} value={selectedRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue
                  className="text-white"
                  placeholder="Select Range"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ranges.map((range) => (
                    <SelectItem key={range} value={range}>
                      {range}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <div className="relative max-w-[21.875rem] ">
            <Search className="absolute inset-y-0 left-2 m-auto h-4 w-4" />
            <Input
              placeholder="Search for episode..."
              className=" w-full pl-8 text-white border-white"
              onChange={handleSearch}
            />
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-5 grid-cols-4 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-9 w-full gap-5 content-center">
        {episodes.map((episode, idx) => (
          <EpisodeCard
            episode={episode}
            key={idx}
            className="self-center justify-self-center"
            animeId={animeId}
          />
        ))}
        {!episodes.length && !isLoading && (
          <div className="lg:col-span-5 col-span-2 sm:col-span-3 md:col-span-4 xl:col-span-6 2xl:col-span-7 flex items-center justify-center py-10 bg-slate-900 rounded-md">
            No Episodes
          </div>
        )}
        {isLoading &&
          Array.from({ length: 14 }).map((_, idx) => (
            <div
              key={idx}
              className={cn([
                "h-[6.25rem] rounded-lg cursor-pointer w-full flex items-center justify-center animate-pulse bg-slate-800",
                "self-center justify-self-center",
              ])}
            ></div>
          ))}
      </div>
    </>
  );
};

export default AnimeEpisodes;
