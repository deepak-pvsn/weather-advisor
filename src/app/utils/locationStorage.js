/**
 * Location Storage Utility
 * 
 * Handles saving and retrieving location data to/from localStorage
 * with improved data structure for LangChain integration.
 */

// Save the selected location to localStorage
export const saveLocation = (location) => {
  try {
    // Format the location with all necessary details
    const locationData = {
      city: location.city,
      country: location.country,
      lat: location.lat,
      lng: location.lng,
      formatted: location.formatted,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('weatherAdvisorLocation', JSON.stringify(locationData));
    return true;
  } catch (error) {
    console.error('Error saving location:', error);
    return false;
  }
};

// Get the stored location from localStorage
export const getStoredLocation = () => {
  try {
    const locationData = localStorage.getItem('weatherAdvisorLocation');
    if (!locationData) return null;
    
    return JSON.parse(locationData);
  } catch (error) {
    console.error('Error retrieving location:', error);
    return null;
  }
};

// Check if a location is already stored
export const hasStoredLocation = () => {
  try {
    return localStorage.getItem('weatherAdvisorLocation') !== null;
  } catch (error) {
    return false;
  }
};

// Clear the stored location
export const clearStoredLocation = () => {
  try {
    localStorage.removeItem('weatherAdvisorLocation');
    return true;
  } catch (error) {
    console.error('Error clearing location:', error);
    return false;
  }
};

// Format location for LangChain or API usage
export const formatLocationForQuery = (location) => {
  if (!location) return '';
  
  return `${location.city}, ${location.country} (${location.lat}, ${location.lng})`;
};

const locationStorage = {
  saveLocation,
  getStoredLocation,
  hasStoredLocation,
  clearStoredLocation,
  formatLocationForQuery
};

export default locationStorage;

// Note: Remove any LLM related code from this file
// This file should only handle localStorage operations

