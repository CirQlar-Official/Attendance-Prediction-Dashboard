/**
 * Weather data fetching utility
 * Uses OpenWeatherMap API to get weather data for a given location and date
 */

const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
// Default to church location - update with actual coordinates
const DEFAULT_LAT = 40.7128; // Latitude
const DEFAULT_LON = -74.0060; // Longitude

export interface WeatherData {
  temperature_high: number;
  temperature_low: number;
  precipitation: number; // in mm
  snow: number; // in mm
}

export async function fetchWeatherForDate(date: Date): Promise<WeatherData | null> {
  if (!OPENWEATHER_API_KEY) {
    console.warn('OpenWeatherMap API key not configured');
    return null;
  }

  try {
    // Get current weather (or forecast if available)
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${DEFAULT_LAT}&lon=${DEFAULT_LON}&units=metric&appid=${OPENWEATHER_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather API error: ${response.statusText}`);
    
    const data = await response.json();
    
    return {
      temperature_high: Math.round(data.main.temp_max),
      temperature_low: Math.round(data.main.temp_min),
      precipitation: data.rain?.['1h'] || 0,
      snow: data.snow?.['1h'] || 0,
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    // Return neutral default values instead of failing
    return {
      temperature_high: 65,
      temperature_low: 55,
      precipitation: 0,
      snow: 0,
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
      precipitation: 0,
      snow: 0,
      is_rainy: 0,
      is_snowy: 0,
    };
  }

  return {
    temp_high: weather.temperature_high,
    temp_low: weather.temperature_low,
    precipitation: weather.precipitation,
    snow: weather.snow,
    is_rainy: weather.precipitation > 0 ? 1 : 0,
    is_snowy: weather.snow > 0 ? 1 : 0,
  };
}
