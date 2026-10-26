import { CACHE_HEADERS, fetchAnimeInfo } from "@/lib/anilist";
import { fetchDonghuaWorldInfo } from "@/lib/donghuaworld-info";
import { isKnownDonghua } from "@/constants/donghua";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const animeId = Number(id);
    if (!animeId || isNaN(animeId)) {
      return NextResponse.json({ error: "Invalid anime ID" }, { status: 400 });
    }

    // For Donghua: strictly use DonghuaWorld for poster, image, synopsis, episodes count, and seasons
    if (isKnownDonghua(animeId)) {
      const dhwData = await fetchDonghuaWorldInfo(animeId);
      if (dhwData) {
        return NextResponse.json(dhwData, { headers: CACHE_HEADERS });
      }
    }

    const data = await fetchAnimeInfo(animeId);
    if (!data) {
      return NextResponse.json({ error: "Anime not found" }, { status: 404 });
    }

    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch anime info" },
      { status: 500 },
    );
  }
}
