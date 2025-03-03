import { StyleSheet, View, Text, ActivityIndicator, ScrollView, TouchableOpacity, Platform, SafeAreaView } from 'react-native';
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import { WeatherForecast, get3DayForecast, WeatherError } from './services/weatherService';
import Svg, { Circle } from 'react-native-svg';

export default function Home() {
  const router = useRouter();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [address, setAddress] = useState<string>('Loading location...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const getLocationName = async (latitude: number, longitude: number) => {
    try {
      console.log('Attempting to get location name for:', latitude, longitude);
      
      // Use WeatherAPI.com location API with the same API key we use for weather
      const response = await fetch(
        `https://api.weatherapi.com/v1/search.json?key=8d874b5ad0164325af391018251202&q=${latitude},${longitude}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch location data');
      }

      const data = await response.json();
      console.log('WeatherAPI location response:', data);

      if (data && data.length > 0) {
        const location = data[0];
        console.log('Found location:', location);
        // Get the city name and region/country
        const cityName = location.name;
        const region = location.region || location.country;
        setAddress(`${cityName}, ${region}`);
      } else {
        // Fallback to coordinates with better formatting
        console.log('No location name found, using coordinates');
        const lat = Math.abs(latitude).toFixed(2) + '°' + (latitude >= 0 ? 'N' : 'S');
        const lon = Math.abs(longitude).toFixed(2) + '°' + (longitude >= 0 ? 'E' : 'W');
        setAddress(`${lat}, ${lon}`);
      }
    } catch (error) {
      console.error('Error in getLocationName:', error);
      // Fallback to coordinates with compass directions
      const lat = Math.abs(latitude).toFixed(2) + '°' + (latitude >= 0 ? 'N' : 'S');
      const lon = Math.abs(longitude).toFixed(2) + '°' + (longitude >= 0 ? 'E' : 'W');
      setAddress(`${lat}, ${lon}`);
    }
  };

  const fetchWeatherData = async () => {
    setLoading(true);
    setErrorMsg(null);
    setErrorDetails(null);

    try {
      console.log('Starting location fetch...');
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location access needed');
        setErrorDetails(
          Platform.select({
            ios: 'Please enable location access in your iPhone settings:\nSettings > Privacy > Location Services > RidersWeather',
            android: 'Please enable location access in your device settings:\nSettings > Apps > RidersWeather > Permissions > Location',
            default: 'Please enable location access in your device settings to use this app.'
          })
        );
        setLoading(false);
        return;
      }

      console.log('Getting current position...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High, // Changed to high accuracy
      });
      console.log('Got location:', location.coords);
      setLocation(location);

      // Get city name
      await getLocationName(location.coords.latitude, location.coords.longitude);

      // Get weather data
      console.log('Fetching weather data...');
      const forecast = await get3DayForecast(location.coords.latitude, location.coords.longitude);
      console.log('Got weather data');
      setWeatherData(forecast);
    } catch (error) {
      console.error('Error in fetchWeatherData:', error);
      
      if (error instanceof WeatherError) {
        setErrorMsg(error.message);
        if (error.originalError) {
          setErrorDetails(typeof error.originalError === 'string' 
            ? error.originalError 
            : JSON.stringify(error.originalError, null, 2));
        }
      } else if (error instanceof Error) {
        setErrorMsg('Unable to fetch weather data.');
        setErrorDetails(error.message);
      } else {
        setErrorMsg('An unexpected error occurred.');
        setErrorDetails('Please check your internet connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeatherData();
  }, []);

  const getRiderRecommendation = (weather: WeatherForecast) => {
    const conditions = weather.condition.toLowerCase();
    
    // Check for severe weather conditions first
    if (conditions.includes('thunderstorm')) {
      return "⚠️ Dangerous conditions - Avoid riding";
    }
    if (conditions.includes('snow') || conditions.includes('freezing')) {
      return "❄️ Icy conditions - Not recommended";
    }
    if (conditions.includes('heavy rain') || conditions.includes('violent')) {
      return "🌧️ Heavy rain - Not recommended";
    }
    
    // Check other weather parameters
    if (weather.precipitation > 50) {
      return "🌦️ High chance of rain - Consider postponing";
    }
    if (weather.wind_speed > 30) {
      return "💨 Strong winds - Ride with caution";
    }
    if (weather.temperature < 5) {
      return "🥶 Very cold - Wear proper gear";
    }
    if (weather.temperature > 30) {
      return "🌡️ Very hot - Stay hydrated";
    }
    
    // Good conditions with slight weather
    if (conditions.includes('light') || conditions.includes('slight')) {
      return "🟡 Moderate conditions - Ride with care";
    }
    if (conditions.includes('clear') || conditions.includes('mainly clear')) {
      return "✅ Perfect conditions for riding";
    }
    
    return "🟢 Generally good conditions";
  };

  const getWeatherIcon = (condition: string) => {
    const conditions = condition.toLowerCase();
    if (conditions.includes('thunderstorm')) return '⛈️';
    if (conditions.includes('snow')) return '🌨️';
    if (conditions.includes('rain') || conditions.includes('drizzle')) return '🌧️';
    if (conditions.includes('fog')) return '🌫️';
    if (conditions.includes('cloud')) return '☁️';
    if (conditions.includes('clear')) return '☀️';
    return '🌤️';
  };

  const calculateRidingScore = (weather: WeatherForecast) => {
    // Define weighting factors (adjust as needed)
    const k_w = 2;  // Wind speed impact
    const k_p = 10; // Precipitation impact
    const k_r = 15; // Road condition impact
    const k_h = 1;  // Humidity impact
    const k_v = 5;  // Visibility impact
    const k_t = 2;  // Temperature deviation impact

    // Ideal temperature for riding (adjustable)
    const idealTemp = 22;

    // Get visibility value based on conditions (0-10 scale)
    const getVisibilityValue = (conditions: string) => {
      if (conditions.includes('fog') || conditions.includes('mist')) return 8;
      if (conditions.includes('heavy rain')) return 6;
      if (conditions.includes('rain')) return 4;
      if (conditions.includes('overcast')) return 2;
      if (conditions.includes('cloudy')) return 1;
      return 0;
    };

    // Get road condition value based on weather (0-10 scale)
    const getRoadValue = (conditions: string) => {
      if (conditions.includes('thunderstorm') || conditions.includes('snow')) return 10;
      if (conditions.includes('heavy rain')) return 8;
      if (conditions.includes('rain')) return 5;
      if (conditions.includes('drizzle')) return 2;
      return 0;
    };

    const conditions = weather.condition.toLowerCase();
    
    // Severe weather conditions result in a score of 0
    if (conditions.includes('thunderstorm') || 
        conditions.includes('snow') || 
        conditions.includes('freezing') ||
        conditions.includes('violent')) {
      return 0;
    }

    // Get input values for the formula
    const T = weather.temperature;                    // Temperature in °C
    const W = weather.wind_speed;                     // Wind speed in km/h
    const P = weather.precipitation / 100;            // Precipitation probability (0-1)
    const R = getRoadValue(conditions) / 10;          // Road condition (0-1)
    const H = weather.humidity / 100;                 // Humidity (0-1)
    const V = getVisibilityValue(conditions) / 10;    // Visibility impact (0-1)
    
    // Calculate the riding score using the formula
    let score = 100 - (W * k_w) - (P * k_p) - (R * k_r) - (H * k_h) - (V * k_v) - (Math.abs(T - idealTemp) * k_t);
    
    // Ensure score is within 0-100 range
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#2ecc71'; // Green
    if (score >= 60) return '#f1c40f'; // Yellow
    if (score >= 40) return '#e67e22'; // Orange
    return '#e74c3c'; // Red
  };

  const getFormattedDates = () => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    return [today, tomorrow, dayAfter].map(date => ({
      day: days[date.getDay()],
      date: date.getDate().toString(),
      fullDate: `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`
    }));
  };

  const handleViewDetailed = (weather: WeatherForecast, date: string) => {
    router.push({
      pathname: '/[date]',
      params: {
        weather: JSON.stringify(weather),
        date: date
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: "RideWeather",
          headerStyle: {
            backgroundColor: '#0F172A',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontSize: 24,
            fontWeight: '600',
          },
        }} 
      />
      
      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" />
      ) : errorMsg ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          {errorDetails && (
            <Text style={styles.errorDetails}>{errorDetails}</Text>
          )}
          <TouchableOpacity style={styles.retryButton} onPress={fetchWeatherData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.forecastContainer}>
          <View style={styles.locationContainer}>
            <Text style={styles.locationText}>
              {location ? address : 'Getting location...'}
            </Text>
          </View>

          <View style={styles.forecastHeader}>
            <Text style={styles.title}>3-Day Forecast</Text>
            <Text style={styles.subtitle}>Riding conditions for the next 3 days</Text>
          </View>

          <View style={styles.tabContainer}>
            {getFormattedDates().map((date, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.tabItem, index === selectedDayIndex && styles.tabItemActive]}
                onPress={() => setSelectedDayIndex(index)}
              >
                <Text style={[styles.tabDay, index === selectedDayIndex && styles.tabTextActive]}>{date.day}</Text>
                <Text style={[styles.tabDate, index === selectedDayIndex && styles.tabTextActive]}>{date.date}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {weatherData.length > selectedDayIndex && (
            <View style={styles.dayContainer}>
              <View style={styles.mainContent}>
                <View style={styles.leftContent}>
                  <Text style={styles.dayTitle}>
                    {getFormattedDates()[selectedDayIndex].fullDate}
                  </Text>
                  <View style={styles.mainWeather}>
                    <Text style={styles.weatherIcon}>{getWeatherIcon(weatherData[selectedDayIndex].condition)}</Text>
                    <Text style={styles.conditionText}>{weatherData[selectedDayIndex].condition}</Text>
                  </View>
                  <Text style={styles.tempText}>{weatherData[selectedDayIndex].temperature}°C</Text>
                </View>
                <View style={styles.scoreContainer}>
                  <Svg width={90} height={90} style={styles.scoreBackground}>
                    {/* Background circle */}
                    <Circle
                      cx="45"
                      cy="45"
                      r="40"
                      stroke="#2D3B54"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    {/* Progress circle */}
                    <Circle
                      cx="45"
                      cy="45"
                      r="40"
                      stroke={getScoreColor(calculateRidingScore(weatherData[selectedDayIndex]))}
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - calculateRidingScore(weatherData[selectedDayIndex]) / 100)}`}
                      strokeLinecap="round"
                      transform="rotate(-90, 45, 45)"
                    />
                  </Svg>
                  <View style={styles.scoreTextContainer}>
                    <Text style={styles.scoreValue}>{calculateRidingScore(weatherData[selectedDayIndex])}</Text>
                    <Text style={styles.scoreLabel}>RIDE</Text>
                  </View>
                </View>
              </View>

              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>💧</Text>
                  <Text style={styles.detailLabel}>Precipitation</Text>
                  <Text style={styles.detailValue}>{weatherData[selectedDayIndex].precipitation}%</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>💨</Text>
                  <Text style={styles.detailLabel}>Wind</Text>
                  <Text style={styles.detailValue}>{weatherData[selectedDayIndex].wind_speed} km/h</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>💧</Text>
                  <Text style={styles.detailLabel}>Humidity</Text>
                  <Text style={styles.detailValue}>{weatherData[selectedDayIndex].humidity}%</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>👁️</Text>
                  <Text style={styles.detailLabel}>Visibility</Text>
                  <Text style={styles.detailValue}>Good</Text>
                </View>
              </View>

              <View style={styles.recommendationContainer}>
                <Text style={styles.recommendationTitle}>Riding Recommendation</Text>
                <Text style={styles.recommendationText}>
                  {getRiderRecommendation(weatherData[selectedDayIndex])}
                </Text>
                <TouchableOpacity 
                  style={styles.detailButton}
                  onPress={() => handleViewDetailed(
                    weatherData[selectedDayIndex],
                    getFormattedDates()[selectedDayIndex].fullDate
                  )}
                >
                  <Text style={styles.detailButtonText}>View Detailed Forecast</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  forecastContainer: {
    flex: 1,
    padding: 20,
  },
  locationContainer: {
    marginBottom: 20,
  },
  locationText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  forecastHeader: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    padding: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#3B82F6',
  },
  tabDay: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 2,
  },
  tabDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  dayContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  mainContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  leftContent: {
    flex: 1,
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  mainWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  weatherIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  conditionText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  tempText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  scoreContainer: {
    width: 90,
    height: 90,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreBackground: {
    position: 'absolute',
  },
  scoreTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    gap: 12,
  },
  detailItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#2D3B54',
    borderRadius: 12,
    padding: 12,
  },
  detailIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  recommendationContainer: {
    backgroundColor: '#2D3B54',
    borderRadius: 12,
    padding: 16,
  },
  recommendationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
    lineHeight: 20,
  },
  detailButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  detailButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorDetails: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
}); 