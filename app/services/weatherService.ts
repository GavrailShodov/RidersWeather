const BASE_URL = 'https://api.weatherapi.com/v1';
const API_KEY = '8d874b5ad0164325af391018251202';
const FORECAST_DAYS = 3; // Free tier limitation

export interface HourlyForecast {
  time: string;
  temperature: number;
  condition: string;
  wind_speed: number;
  precipitation: number;
  humidity: number;
  visibility: number;
}

export interface WeatherForecast {
  date: string;
  temperature: number;
  condition: string;
  wind_speed: number;
  precipitation: number;
  humidity: number;
  hours: HourlyForecast[];
}

export class WeatherError extends Error {
  constructor(message: string, public code?: string, public originalError?: any) {
    super(message);
    this.name = 'WeatherError';
  }
}

export async function get3DayForecast(latitude: number, longitude: number): Promise<WeatherForecast[]> {
  try {
    console.log('Fetching weather data for:', { latitude, longitude });
    
    const url = `${BASE_URL}/forecast.json?key=${API_KEY}&q=${latitude},${longitude}&days=${FORECAST_DAYS}&aqi=no`;
    console.log('API URL:', url);

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new WeatherError(
        `Weather API error: ${response.status} - ${response.statusText}`,
        response.status.toString(),
        errorText
      );
    }

    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    if (!data.forecast?.forecastday) {
      console.error('Invalid API response - missing forecast data:', data);
      throw new WeatherError('Invalid response format: missing forecast data', 'INVALID_RESPONSE', data);
    }

    return data.forecast.forecastday.map((day: any) => ({
      date: new Date(day.date).toLocaleDateString(),
      temperature: Math.round(day.day.maxtemp_c),
      condition: day.day.condition.text,
      wind_speed: Math.round(day.day.maxwind_kph),
      precipitation: Math.round(day.day.daily_chance_of_rain),
      humidity: Math.round(day.day.avghumidity),
      hours: day.hour.map((hour: any) => ({
        time: hour.time.split(' ')[1],
        temperature: Math.round(hour.temp_c),
        condition: hour.condition.text,
        wind_speed: Math.round(hour.wind_kph),
        precipitation: hour.chance_of_rain,
        humidity: hour.humidity,
        visibility: hour.vis_km
      }))
    }));
  } catch (err) {
    const error = err as Error;
    console.error('Weather service error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    if (error instanceof WeatherError) {
      throw error;
    }
    
    throw new WeatherError(
      'Failed to fetch weather data: ' + error.message,
      'FETCH_ERROR',
      error
    );
  }
} 