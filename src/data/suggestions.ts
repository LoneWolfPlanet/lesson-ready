import type { Grade } from "../api/types";

/**
 * Topic chips shown after a grade is picked.
 *
 * IMPORTANT: the Lesson Pack API only writes lessons for topics that exist in the
 * curriculum library (blob container `lessons`, files like g4-science-photosynthesis.md).
 * A chip for a topic that isn't there produces an "unavailable" pack, so list ONLY
 * topics that are in the library. Better still, replace this with an API call
 * (e.g. GET /topics?grade=4) built from the library index.
 *
 * Only topics confirmed in the library so far are listed; add the rest from the
 * `lessons` container.
 */
export const SUGGESTIONS: Partial<Record<Grade, string[]>> = {
  1: [],
  2: ["Parts of a plant"],
  3: [],
  4: ["Photosynthesis"],
  5: [],
  6: [],
};
