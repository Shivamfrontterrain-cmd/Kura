// Re-export DonghuaStream as the Donghua provider
export {
  findSeriesUrl,
  parseEpisodeRange,
  getEpisodes,
  handleWatch,
} from "./donghuastream.js";

import donghuastreamHandler from "./donghuastream.js";
export default donghuastreamHandler;
