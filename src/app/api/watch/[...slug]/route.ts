import providerWorker from "@/lib/providers/index.js";
import { CORS_PNA_HEADERS } from "@/lib/hls-proxy";
import { NextRequest, NextResponse } from "next/server";
import { isKnownDonghua } from "@/constants/donghua";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> },
) {
  try {
    const { slug } = await context.params;
    const currentUrl = new URL(req.url);

    // Strict Donghua Redirect:
    // If anime ID is Donghua, force provider to donghuaworld!
    let effectiveSlug = [...slug];
    const provider = (effectiveSlug[0] || "").toLowerCase();
    const animeId = effectiveSlug[1] || "";
    if (provider !== "donghuaworld" && isKnownDonghua(animeId)) {
      const epPart = effectiveSlug[3] || "";
      const epNumMatch = epPart.match(/(\d+)/);
      const epNum = epNumMatch ? epNumMatch[1] : "1";
      effectiveSlug = ["donghuaworld", animeId, "sub", `donghuaworld-${epNum}`];
    }

    const targetUrl = new URL(`/watch/${effectiveSlug.join("/")}${currentUrl.search}`, req.url);
    const res = await providerWorker.fetch(
      new Request(targetUrl.toString(), { headers: req.headers }),
      {},
    );
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return NextResponse.json(
        {
          streams: [],
          subtitles: [],
          intro: { start: 0, end: 0 },
          outro: { start: 0, end: 0 },
          error: errBody?.error || `Provider returned ${res.status}`,
        },
        { status: 200, headers: CORS_PNA_HEADERS },
      );
    }
    return res;
  } catch (error: any) {
    return NextResponse.json(
      {
        streams: [],
        subtitles: [],
        intro: { start: 0, end: 0 },
        outro: { start: 0, end: 0 },
        error: error?.message,
      },
      { status: 200, headers: CORS_PNA_HEADERS },
    );
  }
}
