/**
 * Central place for constants that were previously duplicated or scattered
 * across the codebase (weather defaults appeared 6 times across two files
 * with the same literal values). Not a place for per-component styling
 * constants - only cross-cutting values with a single conceptual owner.
 */

/** Default coordinates used for weather lookups when a group has no location of its own. */
export const WEATHER_LOCATION = {
  latitude: 39.852285881165265,
  longitude: -86.33698522806094,
} as const;

/** Fallback weather values used when a fetch fails or no weather data exists yet. */
export const WEATHER_DEFAULTS = {
  highTemp: 65,
  lowTemp: 55,
  rainfall: 0,
  snowfall: 0,
} as const;

/** Random Forest training hyperparameters (see src/app/utils/randomForest.ts). */
export const RANDOM_FOREST_CONFIG = {
  trees: 80,
  maxDepth: 7,
  minLeafSize: 2,
  seed: 42,
} as const;

/** Prediction std-dev thresholds below which confidence is reported as high/medium. */
export const CONFIDENCE_THRESHOLDS = {
  high: 6,
  medium: 12,
} as const;
