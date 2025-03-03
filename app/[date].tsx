import { useLocalSearchParams, Stack } from 'expo-router';
import DetailedForecast from './screens/DetailedForecast';
import { WeatherForecast } from './services/weatherService';

export default function DetailedForecastPage() {
  const { date, weather } = useLocalSearchParams();
  
  // Parse the weather data from the URL params
  const weatherData: WeatherForecast = typeof weather === 'string' ? JSON.parse(weather) : null;

  return (
    <>
      <Stack.Screen 
        options={{
          title: date as string,
          headerStyle: {
            backgroundColor: '#0F172A',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '600',
          },
        }} 
      />
      <DetailedForecast weather={weatherData} date={date as string} />
    </>
  );
} 