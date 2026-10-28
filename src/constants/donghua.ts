/**
 * Canonical Donghua series IDs, English name mappings, and detection helpers.
 * Donghua must strictly and exclusively use DonghuaWorld (donghuaworld.com)
 * and display English (EN) names across all pages and components.
 */

export const KNOWN_DONGHUA_EN_TITLES: Record<number, string> = {
  // Battle Through the Heavens (BTTH / Dou Po Cangqiong)
  196613: "Battle Through the Heavens Season 5",
  168164: "Battle Through the Heavens Season 5 (Part 3)",
  168163: "Battle Through the Heavens Season 5 (Part 2)",
  137728: "Battle Through the Heavens Season 5",
  131584: "Battle Through the Heavens Season 4",
  122639: "Battle Through the Heavens Season 4",
  114123: "Battle Through the Heavens Season 3",
  104922: "Battle Through the Heavens Season 3",
  107026: "Battle Through the Heavens Season 2",
  102463: "Battle Through the Heavens Season 2",
  98314: "Battle Through the Heavens Season 1",
  102464: "Battle Through the Heavens Season 1",
  102462: "Battle Through the Heavens Specials",
  109484: "Battle Through the Heavens Specials 2: Song of Desert",
  137729: "Battle Through the Heavens: Three Year Agreement",
  137730: "Battle Through the Heavens: The Origin",

  // Swallowed Star (Tunshi Xingkong)
  166219: "Swallowed Star Season 4",
  166218: "Swallowed Star Season 3",
  152864: "Swallowed Star Season 3",
  134283: "Swallowed Star Season 2",
  142750: "Swallowed Star Season 2",
  117012: "Swallowed Star Season 1",
  131580: "Swallowed Star Season 1",
  185724: "Swallowed Star Movie: Blood Luo Continent",
  213516: "Swallowed Star Movie 2",

  // Renegade Immortal (Xian Ni)
  137653: "Renegade Immortal",
  152636: "Renegade Immortal",
  185121: "Renegade Immortal: Battle of Gods",
  217627: "Renegade Immortal: Slaying the Blood Progenitor",

  // Soul Land (Douluo Dalu)
  102465: "Soul Land",
  103543: "Soul Land Part 2",
  129348: "Soul Land Part 4",
  129350: "Soul Land Part 6",
  129946: "Soul Land Part 8",
  137761: "Soul Land Part 10",
  141802: "Soul Land Part 11",
  149799: "Soul Land Part 13",
  152211: "Soul Land Part 14",
  152213: "Soul Land Part 16",
  163797: "Soul Land Part 24",
  163821: "Soul Land Part 26",
  163823: "Soul Land Part 27",
  165680: "Soul Land Part 30",
  206142: "Soul Land: 9528",
  156360: "Soul Land 2: The Unrivaled Tang Sect",

  // Perfect World (Wanmei Shijie)
  120218: "Perfect World",
  137757: "Perfect World Season 2",
  155222: "Perfect World Season 3",
  168131: "Perfect World Season 4",
  199363: "Perfect World Season 6",

  // Shrouding the Heavens (Zhe Tian)
  137671: "Shrouding the Heavens",
  153070: "Shrouding the Heavens",
  213664: "Shrouding the Heavens Movie: The Imperial Path",

  // Against the Gods (Ni Tian Xie Shen)
  160533: "Against the Gods",

  // Martial Universe (Wu Dong Qian Kun)
  163262: "Martial Universe Season 4",

  // The Great Ruler (Da Zhu Zai)
  163273: "The Great Ruler",

  // Throne of Seal (Shen Yin Wangzuo)
  143588: "Throne of Seal",

  // Jade Dynasty (Zhu Xian)
  150336: "Jade Dynasty",

  // Stellar Transformations (Xing Chen Bian)
  150337: "Stellar Transformations Season 5",

  // A Record of a Mortal's Journey to Immortality (Fanren Xiu Xian Chuan)
  120055: "A Record of a Mortal's Journey to Immortality",
  142168: "A Record of a Mortal's Journey to Immortality Season 2",
  160534: "A Record of a Mortal's Journey to Immortality Season 3",

  // A Will Eternal (Yi Nian Yong Heng)
  120056: "A Will Eternal Season 1",
  150073: "A Will Eternal Season 2",

  // Link Click (Shiguang Dailiren)
  115230: "Link Click Season 1",
  136484: "Link Click Season 2",
  141352: "Link Click Season 2",
  170166: "Link Click: Bridon Arc",

  // The Founder of Diabolism / Grandmaster of Demonic Cultivation (Modao Zushi)
  101349: "The Founder of Diabolism Season 1",
  101972: "The Founder of Diabolism Season 1",
  104458: "The Founder of Diabolism Season 2",
  108605: "The Founder of Diabolism Season 2",
  116674: "The Founder of Diabolism: Final Season",
  121467: "The Founder of Diabolism: Final Season",

  // Heaven Official's Blessing (Tian Guan Ci Fu)
  112151: "Heaven Official's Blessing Season 1",
  113260: "Heaven Official's Blessing Season 1",
  127976: "Heaven Official's Blessing Season 2",
  130545: "Heaven Official's Blessing Season 2",

  // 100,000 Years of Qi Refining
  142646: "100,000 Years of Qi Refining",

  // Spare Me, Great Lord! (Dawang Raoming)
  120220: "Spare Me, Great Lord!",

  // The King's Avatar (Quanzhi Gaoshou)
  102997: "The King's Avatar Season 2",
  101410: "The King's Avatar Specials",

  // The Daily Life of the Immortal King (Xian Wang De Richang Shenghuo)
  126357: "The Daily Life of the Immortal King Season 2",
  141852: "The Daily Life of the Immortal King Season 3",
  156110: "The Daily Life of the Immortal King Season 4",

  // Scissor Seven (Cike Wu Liuqi)
  107912: "Scissor Seven",
  113290: "Scissor Seven Season 2",
  127595: "Scissor Seven Season 3",

  // All Saints Street (Wan Sheng Jie)
  114555: "All Saints Street",
  122497: "All Saints Street Season 2",
  137740: "All Saints Street Season 3",
  158830: "All Saints Street Season 4",

  // Other Notable Series
  122511: "Dragon Raja -The Blazing Dawn-",
  166442: "Super Cube",
  99200: "Full-Time Magister",
  21818: "Cupid's Chocolates",
  156111: "The Girl Downstairs",
};

export const KNOWN_DONGHUA_POSTERS: Record<number, string> = {
  // Battle Through the Heavens
  98314: "https://donghuaworld.com/wp-content/uploads/2022/10/Battle-Through-the-Heavens-Season-1.webp",
  102464: "https://donghuaworld.com/wp-content/uploads/2022/10/Battle-Through-the-Heavens-Season-1.webp",
  107026: "https://donghuaworld.com/wp-content/uploads/2022/10/Battle-Through-the-Heavens-Season-2.webp",
  102463: "https://donghuaworld.com/wp-content/uploads/2022/10/Battle-Through-the-Heavens-Season-2.webp",
  102462: "https://donghuaworld.com/wp-content/uploads/2022/10/Battle-Through-the-Heavens-Specials.webp",
  109484: "https://donghuaworld.com/wp-content/uploads/2022/10/Battle-Through-the-Heavens-Specials.webp",
  114123: "https://donghuaworld.com/wp-content/uploads/2022/10/Battle-Through-the-Heavens-Season-3.webp",
  104922: "https://donghuaworld.com/wp-content/uploads/2022/10/Battle-Through-the-Heavens-Season-3.webp",
  137729: "https://donghuaworld.com/wp-content/uploads/2022/10/Battle-Through-the-Heavens-Three-Year-Agreement.webp",
  131584: "https://donghuaworld.com/wp-content/uploads/2022/10/Battle-Through-the-Heavens-Season-4.webp",
  122639: "https://donghuaworld.com/wp-content/uploads/2022/10/Battle-Through-the-Heavens-Season-4.webp",
  137730: "https://donghuaworld.com/wp-content/uploads/2022/10/Battle-Through-the-Heavens-The-Origin.webp",
  196613: "https://donghuaworld.com/wp-content/uploads/2023/01/Battle-Through-the-Heavens-Season-5-1.webp",
  168164: "https://donghuaworld.com/wp-content/uploads/2023/01/Battle-Through-the-Heavens-Season-5-1.webp",
  168163: "https://donghuaworld.com/wp-content/uploads/2023/01/Battle-Through-the-Heavens-Season-5-1.webp",
  137728: "https://donghuaworld.com/wp-content/uploads/2023/01/Battle-Through-the-Heavens-Season-5-1.webp",

  // Swallowed Star
  131580: "https://donghuaworld.com/wp-content/uploads/2022/10/Swallowed-Star.webp",
  117012: "https://donghuaworld.com/wp-content/uploads/2022/10/Swallowed-Star.webp",
  142750: "https://donghuaworld.com/wp-content/uploads/2022/10/Swallowed-Star.webp",
  134283: "https://donghuaworld.com/wp-content/uploads/2022/10/Swallowed-Star.webp",
  152864: "https://donghuaworld.com/wp-content/uploads/2022/10/Swallowed-Star.webp",
  166218: "https://donghuaworld.com/wp-content/uploads/2022/10/Swallowed-Star.webp",
  166219: "https://donghuaworld.com/wp-content/uploads/2022/10/Swallowed-Star.webp",
  185724: "https://donghuaworld.com/wp-content/uploads/2022/10/Swallowed-Star.webp",

  // Soul Land
  131518: "https://donghuaworld.com/wp-content/uploads/2022/10/Soul-Land.webp",
  102465: "https://donghuaworld.com/wp-content/uploads/2022/10/Soul-Land.webp",
  156360: "https://donghuaworld.com/wp-content/uploads/2023/06/Soul-Land-2-The-Unrivaled-Tang-Sect.webp",

  // Perfect World
  132405: "https://donghuaworld.com/wp-content/uploads/2022/10/Perfect-World.webp",
  120218: "https://donghuaworld.com/wp-content/uploads/2022/10/Perfect-World.webp",

  // Renegade Immortal
  152636: "https://donghuaworld.com/wp-content/uploads/2023/09/Renegade-Immortal-Xian-Ni.webp",
  137653: "https://donghuaworld.com/wp-content/uploads/2023/09/Renegade-Immortal-Xian-Ni.webp",

  // Shrouding the Heavens
  153070: "https://donghuaworld.com/wp-content/uploads/2023/05/Shrouding-the-Heavens.webp",
  137671: "https://donghuaworld.com/wp-content/uploads/2023/05/Shrouding-the-Heavens.webp",

  // Against the Gods
  160533: "https://donghuaworld.com/wp-content/uploads/2023/12/Against-the-Gods.webp",

  // Martial Universe
  163262: "https://donghuaworld.com/wp-content/uploads/2023/11/Martial-Universe-Season-4.webp",

  // The Great Ruler
  163273: "https://donghuaworld.com/wp-content/uploads/2023/07/The-Great-Ruler.webp",

  // Throne of Seal
  143588: "https://donghuaworld.com/wp-content/uploads/2022/10/Throne-of-Seal.webp",

  // Jade Dynasty
  150336: "https://donghuaworld.com/wp-content/uploads/2022/10/Jade-Dynasty.webp",

  // A Record of a Mortal's Journey to Immortality
  120055: "https://donghuaworld.com/wp-content/uploads/2022/10/A-Record-of-a-Mortals-Journey-to-Immortality.webp",
  142168: "https://donghuaworld.com/wp-content/uploads/2022/10/A-Record-of-a-Mortals-Journey-to-Immortality-Season-2.webp",
  160534: "https://donghuaworld.com/wp-content/uploads/2023/11/A-Record-of-a-Mortals-Journey-to-Immortality-Season-3.webp",

  // A Will Eternal
  120056: "https://donghuaworld.com/wp-content/uploads/2022/10/A-Will-Eternal.webp",
  150073: "https://donghuaworld.com/wp-content/uploads/2022/10/A-Will-Eternal-Season-2.webp",
};

export const KNOWN_DONGHUA_SERIES_RELATIONS: Record<number, number[]> = {
  // BTTH group
  98314: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  102464: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  107026: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  102463: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  102462: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  109484: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  114123: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  104922: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  137729: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  131584: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  122639: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  137730: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  196613: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  168164: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  168163: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],
  137728: [98314, 107026, 102462, 114123, 137729, 131584, 137730, 196613],

  // Swallowed Star group
  131580: [131580, 142750, 152864, 166219, 185724],
  117012: [131580, 142750, 152864, 166219, 185724],
  142750: [131580, 142750, 152864, 166219, 185724],
  134283: [131580, 142750, 152864, 166219, 185724],
  152864: [131580, 142750, 152864, 166219, 185724],
  166218: [131580, 142750, 152864, 166219, 185724],
  166219: [131580, 142750, 152864, 166219, 185724],
  185724: [131580, 142750, 152864, 166219, 185724],

  // Soul Land group
  131518: [131518, 156360],
  102465: [131518, 156360],
  156360: [131518, 156360],

  // RMJI group
  120055: [120055, 142168, 160534],
  142168: [120055, 142168, 160534],
  160534: [120055, 142168, 160534],

  // A Will Eternal group
  120056: [120056, 150073],
  150073: [120056, 150073],

  // Link Click group
  115230: [115230, 141352, 170166],
  141352: [115230, 141352, 170166],
  170166: [115230, 141352, 170166],

  // Mo Dao Zu Shi group
  101349: [101349, 108605, 116674],
  108605: [101349, 108605, 116674],
  116674: [101349, 108605, 116674],

  // TGCF group
  112151: [112151, 130545],
  130545: [112151, 130545],
};

export const KNOWN_DONGHUA_IDS = new Set<number>([
  ...Object.keys(KNOWN_DONGHUA_EN_TITLES).map(Number),
  132405, // Perfect World alt
  131518, // Soul Land alt
]);

const PINYIN_SERIES_MAP: Array<{ pinyin: RegExp; en: string }> = [
  { pinyin: /dou po cangqiong/i, en: "Battle Through the Heavens" },
  { pinyin: /douluo dalu/i, en: "Soul Land" },
  { pinyin: /tunshi xingkong/i, en: "Swallowed Star" },
  { pinyin: /wanmei shijie/i, en: "Perfect World" },
  { pinyin: /zhe tian/i, en: "Shrouding the Heavens" },
  { pinyin: /xian ni/i, en: "Renegade Immortal" },
  { pinyin: /fanren xiu ?xian chuan/i, en: "A Record of a Mortal's Journey to Immortality" },
  { pinyin: /yi nian yong ?heng/i, en: "A Will Eternal" },
  { pinyin: /shen yin wangzuo/i, en: "Throne of Seal" },
  { pinyin: /wu dong qian kun/i, en: "Martial Universe" },
  { pinyin: /da zhu zai/i, en: "The Great Ruler" },
  { pinyin: /cike wu liuqi|wu liuqi/i, en: "Scissor Seven" },
  { pinyin: /quanzhi gaoshou/i, en: "The King's Avatar" },
  { pinyin: /quanzhi fashi/i, en: "Full-Time Magister" },
  { pinyin: /xian wang de richang shenghuo/i, en: "The Daily Life of the Immortal King" },
  { pinyin: /dawang raoming/i, en: "Spare Me, Great Lord!" },
  { pinyin: /shiguang dailiren/i, en: "Link Click" },
  { pinyin: /modao zushi|mo dao zu shi/i, en: "The Founder of Diabolism" },
  { pinyin: /tian guan ci fu/i, en: "Heaven Official's Blessing" },
  { pinyin: /wan jie shenzhu/i, en: "Lord of the Universe" },
  { pinyin: /wan jie xian zong/i, en: "Wonderland" },
  { pinyin: /wan jie fa shen/i, en: "God of Ten Thousand Realms" },
  { pinyin: /wan jie zhizun/i, en: "The Emperor of Myriad Realms" },
  { pinyin: /wan jie du zun|wan jie duzun/i, en: "Ten Thousand Worlds" },
  { pinyin: /wan sheng jie/i, en: "All Saints Street" },
  { pinyin: /bailian cheng shen|bai lian cheng shen/i, en: "Apotheosis" },
  { pinyin: /lian qi shiwan nian/i, en: "100,000 Years of Qi Refining" },
  { pinyin: /zhu xian/i, en: "Jade Dynasty" },
  { pinyin: /xing chen bian/i, en: "Stellar Transformations" },
  { pinyin: /ni tian xie shen/i, en: "Against the Gods" },
  { pinyin: /cang yuan tu/i, en: "The Demon Hunter" },
  { pinyin: /zhen dao ge/i, en: "Song of the Broadsword" },
  { pinyin: /zhen hun jie/i, en: "Rakshasa Street" },
  { pinyin: /yuan zun/i, en: "Yuan Zun" },
  { pinyin: /shen mu/i, en: "Tomb of Fallen Gods" },
  { pinyin: /ling jian zun/i, en: "Spirit Blade Sovereign" },
  { pinyin: /wu shen zhu zai/i, en: "The God of Martial Arts" },
  { pinyin: /yao shen ji/i, en: "Tales of Demons and Gods" },
  { pinyin: /kuang shen/i, en: "Mad God" },
  { pinyin: /binghuo mochu/i, en: "The Magic Chef of Ice and Fire" },
  { pinyin: /long zu/i, en: "Dragon Raja" },
  { pinyin: /chao neng lifang/i, en: "Super Cube" },
  { pinyin: /aishen qiaokeli/i, en: "Cupid's Chocolates" },
  { pinyin: /aishang ta de liyou/i, en: "The Girl Downstairs" },
  { pinyin: /zuihou de zhaohuan shi/i, en: "The Last Summoner" },
];

const NON_LATIN_REGEX = /[\u4e00-\u9fa5\uac00-\ud7af\u3040-\u30ff\u0e00-\u0e7f\u0400-\u04ff]/;

export function isCleanEnglishTitle(str?: string | null): boolean {
  if (!str || typeof str !== "string") return false;
  const s = str.trim();
  if (s.length < 2) return false;
  if (NON_LATIN_REGEX.test(s)) return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  return true;
}

function scoreEnglishCandidate(candidate: string, romajiTitle?: string): number {
  if (!isCleanEnglishTitle(candidate)) return -1;
  const candLower = candidate.toLowerCase();
  const romajiLower = (romajiTitle || "").toLowerCase();

  if (candLower === romajiLower) return 1;

  let score = 10;
  const englishWords = [
    "season", "the", "of", "and", "in", "to", "a", "an", "battle", "heavens",
    "soul", "land", "swallowed", "star", "immortal", "renegade", "god", "gods",
    "world", "lord", "emperor", "king", "avatar", "master", "legend", "martial",
    "universe", "record", "mortal", "journey", "great", "ruler", "magic", "magister",
    "throne", "seal", "perfect", "shrouding", "dynasty", "transformations", "against",
    "hunter", "blade", "sovereign", "spirit", "sword", "dragon", "demon", "demons",
    "seven", "scissor", "spare", "life", "daily", "cube", "origin", "agreement",
    "street", "apotheosis", "refining", "saints", "blessing", "founder", "diabolism",
  ];

  for (const w of englishWords) {
    if (candLower.includes(w)) score += 5;
  }

  if (/\bseason \d+\b/i.test(candidate)) score += 15;
  if (/\bpart \d+\b/i.test(candidate)) score += 10;
  if (/\b(special|specials|movie)\b/i.test(candidate)) score += 8;

  const pinyinPatterns = ["cangqiong", "douluo", "dalu", "xingkong", "shijie", "xiuxian", "wangzuo", "gaoshou"];
  for (const p of pinyinPatterns) {
    if (candLower.includes(p)) score -= 15;
  }

  return score;
}

export function translatePinyinTitle(romaji?: string | null): string {
  if (!romaji) return "";
  let working = romaji.trim();

  for (const { pinyin, en } of PINYIN_SERIES_MAP) {
    if (pinyin.test(working)) {
      working = working.replace(pinyin, en);
      break;
    }
  }

  working = working
    .replace(/:\s*nian fan\s*4/i, " Season 5")
    .replace(/:\s*nian fan\s*3/i, " Season 5 (Part 3)")
    .replace(/:\s*nian fan\s*2/i, " Season 5 (Part 2)")
    .replace(/:\s*nian fan/i, " Season 5")
    .replace(/:\s*yuanqi/i, ": The Origin")
    .replace(/:\s*san nian zhi yue/i, ": Three Year Agreement")
    .replace(/:\s*sha zhi lan ge/i, ": Song of Desert")
    .replace(/:\s*tebie pian/i, " Special")
    .replace(/\btebie pian\b/i, "Special")
    .replace(/:\s*xuanwu guo pian/i, " Season 3")
    .replace(/:\s*zui qiang faxingshi/i, " Season 2")
    .replace(/:\s*yingdu pian/i, ": Bridon Arc")
    .replace(/\bjuchang ban\b/i, "Movie")
    .replace(/\bmovie:\s*/i, "Movie: ")
    .replace(/\s+(\d+)$/, " Season $1")
    .replace(/\s+II$/i, " Season 2")
    .replace(/\s+III$/i, " Season 3")
    .replace(/\s+IV$/i, " Season 4")
    .replace(/\s+V$/i, " Season 5");

  return working.trim();
}

/**
 * Returns canonical English (EN) title for any Donghua item.
 */
export function getDonghuaEnglishTitle(media?: any): string {
  if (!media) return "";

  const idNum = typeof media === "number" ? media : Number(media?.id || media?.anilistId);

  // 1. Check direct canonical map
  if (idNum && KNOWN_DONGHUA_EN_TITLES[idNum]) {
    return KNOWN_DONGHUA_EN_TITLES[idNum];
  }

  const romaji = media?.title?.romaji || (typeof media === "string" ? media : media?.name) || "";
  const english = media?.title?.english || (media?.countryOfOrigin === "CN" ? null : null);
  const synonyms: string[] = Array.isArray(media?.synonyms) ? media.synonyms : [];

  // 2. If valid English title already exists
  if (english && isCleanEnglishTitle(english)) {
    const enScore = scoreEnglishCandidate(english, romaji);
    if (enScore >= 10) {
      return english.trim();
    }
  }

  // 3. Search synonyms for high-confidence English title
  let bestSynonym = "";
  let bestScore = 0;
  for (const syn of synonyms) {
    const sc = scoreEnglishCandidate(syn, romaji);
    if (sc > bestScore) {
      bestScore = sc;
      bestSynonym = syn.trim();
    }
  }

  if (bestSynonym && bestScore >= 15) {
    return bestSynonym;
  }

  // 4. Procedural Pinyin translation
  const translated = translatePinyinTitle(romaji);
  if (translated && translated !== romaji) {
    return translated;
  }

  // 5. Fallback to best available synonym or romaji
  if (bestSynonym && bestScore > 0) return bestSynonym;
  if (english && isCleanEnglishTitle(english)) return english.trim();
  return romaji || "Donghua";
}

export function isKnownDonghua(animeId?: string | number | null, media?: any): boolean {
  if (animeId && KNOWN_DONGHUA_IDS.has(Number(animeId))) return true;
  if (!media) return false;
  const idNum = Number(media?.id || media?.anilistId);
  if (idNum && KNOWN_DONGHUA_IDS.has(idNum)) return true;

  const co = String(media?.countryOfOrigin || media?.originatingCountry || "").toUpperCase();
  if (co === "CN") return true;
  if (co === "JP" || co === "JA" || co === "KR" || co === "KO") return false; // Non-Chinese anime

  if (media?.isDonghua === true) return true;
  const allText = `${media?.name || ""} ${media?.title?.native || ""} ${media?.title?.romaji || ""} ${media?.title?.english || ""} ${(media?.synonyms || []).join(" ")}`.toLowerCase();
  if (/[\u3040-\u30ff\uac00-\ud7af]/.test(allText)) return false; // Japanese Kana or Korean Hangul = NOT Donghua!
  if (allText.includes("donghua") || allText.includes("chinese animation") || allText.includes("nian fan")) return true;
  return false;
}
