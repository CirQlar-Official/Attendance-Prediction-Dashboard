/**
 * Weather data fetching utility
 * Uses Open-Meteo to get weather data for a specific date (past or future).
 */

import { WEATHER_LOCATION, WEATHER_DEFAULTS } from '../config';

export interface WeatherData {
  low_temp: number;
  high_temp: number;
  rainfall: number;
  snowfall: number;
}

const DAILY_VARS = 'temperature_2m_max,temperature_2m_min,rain_sum,snowfall_sum';

function toYmd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/* Fetch weather data for a specific date */
export async function fetchWeatherForDate(d: Date): Promise<WeatherData | null> {
  try {
    const ymd = toYmd(d);
    const today = toYmd(new Date());

    // Open-Meteo splits historical data (archive-api) from forecast data
    // (api); the forecast endpoint has no record of past days.
    const base =
      ymd <= today
        ? 'https://archive-api.open-meteo.com/v1/archive'
        : 'https://api.open-meteo.com/v1/forecast';

    const url =
      `${base}?latitude=${WEATHER_LOCATION.latitude}` +
      `&longitude=${WEATHER_LOCATION.longitude}` +
      `&start_date=${ymd}` +
      `&end_date=${ymd}` +
      `&daily=${DAILY_VARS}` +
      `&timezone=America/New_York` +
      `&temperature_unit=fahrenheit`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather API error: ${response.statusText}`);

    const data = await response.json();
    const daily = data.daily;

    if (!daily?.time?.length) throw new Error("No daily weather data returned");

    return {
      high_temp: Math.round(daily.temperature_2m_max[0]),
      low_temp: Math.round(daily.temperature_2m_min[0]),
      rainfall: daily.rain_sum[0] ?? 0,
      snowfall: daily.snowfall_sum[0] ?? 0,
    };
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return {
      high_temp: WEATHER_DEFAULTS.highTemp,
      low_temp: WEATHER_DEFAULTS.lowTemp,
      rainfall: WEATHER_DEFAULTS.rainfall,
      snowfall: WEATHER_DEFAULTS.snowfall,
    };
  }
}

/**
 * Convert weather data to features for the ML model
 */
export function weatherToFeatures(weather: WeatherData | null) {
  if (!weather) {
    return {
      temp_high: 0,
      temp_low: 0,
      rainfall: 0,
      snowfall: 0,
      is_rainy: 0,
      is_snowy: 0,
    };
  }

  return {
    low_temp: weather.low_temp,
  high_temp: weather.high_temp,
  rainfall: weather.rainfall,
  snowfall: weather.snowfall
  };
}
