import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, ScrollView } from 'react-native';
import { WeatherForecast, HourlyForecast } from '../services/weatherService';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';

interface DetailedForecastProps {
  weather: WeatherForecast;
  date: string;
}

export default function DetailedForecast({ weather, date }: DetailedForecastProps) {
  const [selectedHour, setSelectedHour] = useState<HourlyForecast | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Set initial selected hour to current hour or first hour
    const currentHour = new Date().getHours();
    setSelectedHour(weather.hours[currentHour]);
    setSelectedIndex(currentHour);
    
    // Scroll to the current hour
    setTimeout(() => {
      if (scrollViewRef.current) {
        const scrollToX = Math.max(0, (currentHour - 2)) * HOUR_WIDTH;
        scrollViewRef.current.scrollTo({
          x: scrollToX,
          animated: true
        });
      }
    }, 100);
  }, [weather]);

  const calculateRidingScore = (hourData: HourlyForecast) => {
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

    const conditions = hourData.condition.toLowerCase();
    
    // Severe weather conditions result in a score of 0
    if (conditions.includes('thunderstorm') || 
        conditions.includes('snow') || 
        conditions.includes('freezing') ||
        conditions.includes('violent')) {
      return 0;
    }

    // Get input values for the formula
    const T = hourData.temperature;                    // Temperature in °C
    const W = hourData.wind_speed;                     // Wind speed in km/h
    const P = hourData.precipitation / 100;            // Precipitation probability (0-1)
    const R = getRoadValue(conditions) / 10;          // Road condition (0-1)
    const H = hourData.humidity / 100;                // Humidity (0-1)
    const V = getVisibilityValue(conditions) / 10;    // Visibility impact (0-1)
    
    // Calculate the riding score using the formula
    let score = 100 - (W * k_w) - (P * k_p) - (R * k_r) - (H * k_h) - (V * k_v) - (Math.abs(T - idealTemp) * k_t);
    
    // Ensure score is within 0-100 range
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const HOUR_WIDTH = 100; // Increased width for each hour
  const TOTAL_WIDTH = HOUR_WIDTH * 24 + 80; // Total width including padding
  const VISIBLE_WIDTH = Dimensions.get('window').width - 40;
  const chartHeight = 220;
  const padding = { top: 20, right: 40, bottom: 40, left: 40 };

  const xScale = (index: number) => index * HOUR_WIDTH + padding.left;
  const yScale = (value: number) => chartHeight - ((value * (chartHeight - padding.top - padding.bottom)) / 100 + padding.bottom);

  // Generate path data for the entire 24 hours
  const pathData = weather.hours.map((hour, index) => {
    const x = xScale(index);
    const y = yScale(calculateRidingScore(hour));
    return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');

  const handlePointPress = (index: number) => {
    setSelectedHour(weather.hours[index]);
    setSelectedIndex(index);
  };

  const getRiderRecommendation = (hourData: HourlyForecast) => {
    const conditions = hourData.condition.toLowerCase();
    
    if (conditions.includes('thunderstorm')) {
      return "⚠️ Dangerous conditions - Avoid riding";
    }
    if (conditions.includes('snow') || conditions.includes('freezing')) {
      return "❄️ Icy conditions - Not recommended";
    }
    if (conditions.includes('heavy rain')) {
      return "🌧️ Heavy rain - Not recommended";
    }
    if (hourData.precipitation > 50) {
      return "🌦️ High chance of rain - Consider postponing";
    }
    if (hourData.wind_speed > 30) {
      return "💨 Strong winds - Ride with caution";
    }
    if (hourData.temperature < 5) {
      return "🥶 Very cold - Wear proper gear";
    }
    if (hourData.temperature > 30) {
      return "🌡️ Very hot - Stay hydrated";
    }
    if (conditions.includes('clear')) {
      return "✅ Perfect conditions for riding";
    }
    return "🟢 Generally good conditions";
  };

  return (
    <View style={styles.container}>
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Hourly Forecast</Text>
        <Text style={styles.chartSubtitle}>Riding conditions throughout the day</Text>
        
        <View style={styles.scrollContainer}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            style={{ width: VISIBLE_WIDTH }}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            scrollEventThrottle={16}
            alwaysBounceHorizontal={false}
          >
            <View style={{ width: TOTAL_WIDTH }}>
              <Svg width={TOTAL_WIDTH} height={chartHeight}>
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((value) => (
                  <Line
                    key={value}
                    x1={padding.left}
                    y1={yScale(value)}
                    x2={TOTAL_WIDTH - padding.right}
                    y2={yScale(value)}
                    stroke="#2D3B54"
                    strokeWidth="1"
                  />
                ))}
                
                {/* Y-axis labels */}
                {[0, 25, 50, 75, 100].map((value) => (
                  <SvgText
                    key={value}
                    x={padding.left - 10}
                    y={yScale(value)}
                    fill="#94A3B8"
                    fontSize="10"
                    textAnchor="end"
                    alignmentBaseline="middle"
                  >
                    {value}
                  </SvgText>
                ))}

                {/* X-axis labels */}
                {weather.hours.map((_, index) => (
                  <SvgText
                    key={index}
                    x={xScale(index)}
                    y={chartHeight - 10}
                    fill="#94A3B8"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {index.toString().padStart(2, '0')}:00
                  </SvgText>
                ))}

                {/* Line chart */}
                <Path
                  d={pathData}
                  stroke="#3B82F6"
                  strokeWidth="3"
                  fill="none"
                />

                {/* Interactive points */}
                {weather.hours.map((hour, index) => (
                  <Circle
                    key={index}
                    cx={xScale(index)}
                    cy={yScale(calculateRidingScore(hour))}
                    r={index === selectedIndex ? "8" : "6"}
                    fill={index === selectedIndex ? "#22C55E" : "#3B82F6"}
                    stroke={index === selectedIndex ? "#FFFFFF" : "transparent"}
                    strokeWidth="2"
                    onPress={() => handlePointPress(index)}
                  />
                ))}
              </Svg>
            </View>
          </ScrollView>
        </View>
      </View>

      {selectedHour && (
        <View style={styles.detailsPanel}>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{selectedHour.time}</Text>
            <Text style={styles.temperatureText}>{Math.round(selectedHour.temperature)}°C</Text>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>💧</Text>
              <Text style={styles.detailLabel}>Precipitation</Text>
              <Text style={styles.detailValue}>{Math.round(selectedHour.precipitation)}%</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>💨</Text>
              <Text style={styles.detailLabel}>Wind</Text>
              <Text style={styles.detailValue}>{Math.round(selectedHour.wind_speed)} km/h</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>💧</Text>
              <Text style={styles.detailLabel}>Humidity</Text>
              <Text style={styles.detailValue}>{Math.round(selectedHour.humidity)}%</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>👁️</Text>
              <Text style={styles.detailLabel}>Visibility</Text>
              <Text style={styles.detailValue}>{selectedHour.visibility} km</Text>
            </View>
          </View>

          <Text style={styles.recommendationText}>
            {getRiderRecommendation(selectedHour)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  chartContainer: {
    padding: 20,
  },
  scrollContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
  },
  chart: {
    marginVertical: 8,
  },
  chartTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  chartSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 20,
  },
  detailsPanel: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    marginTop: 'auto',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  temperatureText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
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
  recommendationText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
  },
  tooltip: {
    backgroundColor: '#2D3B54',
    padding: 8,
    borderRadius: 4,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
}); 