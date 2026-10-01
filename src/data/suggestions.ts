import type { Grade } from "../api/types";

/**
 * Topic suggestions shown after a grade is picked. Static for phase 1; aligned loosely
 * with common DepEd K-12 elementary topics. Replace with an API call
 * (e.g. GET /suggestions?grade=4) if you want them data-driven.
 */
export const SUGGESTIONS: Record<Grade, string[]> = {
  1: ["Parts of the body", "Counting to 100", "My family", "Shapes around us"],
  2: ["Addition with regrouping", "Living and non-living things", "Telling time", "Community helpers"],
  3: ["Fractions", "Multiplication", "Parts of a plant", "Weather"],
  4: ["Photosynthesis", "Parts of a plant", "Food chains", "States of matter"],
  5: ["Decimals", "Reproductive parts of a flower", "Weathering and erosion", "Philippine regions"],
  6: ["Ratio and proportion", "Solar system", "Circulatory system", "Philippine Revolution"],
};
