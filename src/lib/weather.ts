/**
 * Weather data fetching utility
 * Uses Open-Meteo API to get weather data for the current day
 */

const DEFAULT_LAT = 39.852285881165265;
const DEFAULT_LON = -86.33698522806094;

export interface WeatherData {
  low_temp: number;
  high_temp: number;
  rainfall: number;
  snowfall: number;
}

export async function fetchWeatherForDate(date: Date): Promise<WeatherData | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${DEFAULT_LAT}` +
      `&longitude=${DEFAULT_LON}` +
      `&daily=temperature_2m_max,temperature_2m_min,rain_sum,snowfall_sum` +
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
      high_temp: 65,
      low_temp: 55,
      rainfall: 0,
      snowfall: 0,
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
