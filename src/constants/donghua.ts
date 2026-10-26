/**
 * Canonical Donghua series IDs and detection helpers.
 * Donghua must strictly and exclusively use DonghuaWorld (donghuaworld.com).
 */

export const KNOWN_DONGHUA_IDS = new Set<number>([
  196613, // Battle Through the Heavens Season 5 (BTTH Nian Fan 4)
  168164, // BTTH Nian Fan 3
  168163, // BTTH Nian Fan 2
  131584, // BTTH Season 4
  114123, // BTTH Season 3
  107026, // BTTH Season 2
  98314,  // BTTH Season 1
  166219, // Swallowed Star Season 4
  131580, // Swallowed Star Season 1
  142750, // Swallowed Star Season 2
  152864, // Swallowed Star Season 3
  152636, // Renegade Immortal (Xian Ni)
  131518, // Soul Land 1
  156360, // Soul Land 2 (Unrivaled Tang Sect)
  132405, // Perfect World
  150073, // A Will Eternal Season 2/3
  120056, // A Will Eternal Season 1
  153070, // Shrouding the Heavens
  160533, // Against the Gods
  163262, // Martial Universe Season 4
  163273, // The Great Ruler
  143588, // Throne of Seal
  150336, // Jade Dynasty
  150337, // Stellar Transformation Season 5
  120055, // A Record of a Mortal's Journey to Immortality Season 1
  142168, // RMJI Season 2
  160534, // RMJI Season 3
  115230, // Link Click Season 1
  141352, // Link Click Season 2
  101349, // Mo Dao Zu Shi Season 1
  108605, // Mo Dao Zu Shi Season 2
  116674, // Mo Dao Zu Shi Final Season
  112151, // Heaven Official's Blessing Season 1
  130545, // Heaven Official's Blessing Season 2
  142646, // 100,000 Years of Qi Refining
]);

export function isKnownDonghua(animeId?: string | number | null, media?: any): boolean {
  if (animeId && KNOWN_DONGHUA_IDS.has(Number(animeId))) return true;
  if (!media) return false;
  const idNum = Number(media?.id || media?.anilistId);
  if (idNum && KNOWN_DONGHUA_IDS.has(idNum)) return true;
  const co = String(media?.countryOfOrigin || media?.originatingCountry || "").toUpperCase();
  if (co === "CN") return true;
  if (media?.isDonghua === true) return true;
  const allText = `${media?.name || ""} ${media?.title?.native || ""} ${media?.title?.romaji || ""} ${media?.title?.english || ""} ${(media?.synonyms || []).join(" ")}`.toLowerCase();
  if (allText.includes("donghua") || allText.includes("nian fan")) return true;
  if (/[\u4e00-\u9fa5]/.test(allText)) return true;
  return false;
}
