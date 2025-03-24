// Simple in-memory cache for weather data
const weatherCache = new Map();

// Get cached weather data if available and not expired
export function getCachedWeatherData(locationId) {
  if (!weatherCache.has(locationId)) {
    return null;
  }
  
  const cachedData = weatherCache.get(locationId);
  const now = Date.now();
  
  // Check if cache has expired (30 minutes)
  if (now - cachedData.timestamp > 30 * 60 * 1000) {
    weatherCache.delete(locationId);
    return null;
  }
  
  return cachedData.data;
}

// Cache weather data for a location
export function cacheWeatherData(locationId, data) {
  weatherCache.set(locationId, {
    data,
    timestamp: Date.now()
  });
}

// Generate a unique ID for a location to use as cache key
export function getLocationCacheId(location) {
  return `${location.lat},${location.lng}`;
}

// Clear all cached weather data
export function clearAllWeatherCache() {
  weatherCache.clear();
} 