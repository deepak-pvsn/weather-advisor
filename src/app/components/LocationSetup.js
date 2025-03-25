import { useState, useEffect, useRef, useCallback } from 'react';

export default function LocationSetup({ onLocationSet }) {
  const [cityInput, setCityInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch location suggestions from the API
  const fetchLocationSuggestions = useCallback(async (query) => {
    // Don't search until at least 3 characters have been entered
    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Add a cache-busting parameter to prevent caching
      const cacheBuster = new Date().getTime();
      const url = `/api/locations?q=${encodeURIComponent(query)}&_=${cacheBuster}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
      
      // Get the response
      const responseText = await response.text();
      
      let data;
      try {
        // Try to parse the response as JSON
        data = JSON.parse(responseText);
      } catch (err) {
        throw new Error(`Invalid response format: ${err.message}`);
      }
      
      if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
      }
      
      // Check if we have results
      if (data.results && data.results.length > 0) {
        // Extract relevant information from the results
        const formattedSuggestions = data.results.map(result => ({
          city: extractLocationName(result),
          lat: result.geometry.lat,
          lng: result.geometry.lng,
          country: result.components.country || "Unknown",
          formatted: result.formatted
        }));
        
        setSuggestions(formattedSuggestions);
      } else {
        setSuggestions([]);
        setError('No locations found. Try a different search term.');
      }
    } catch (err) {
      console.error('Error fetching location suggestions:', err);
      setError(`Error: ${err.message}`);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper function to extract a readable location name
  const extractLocationName = (result) => {
    try {
      const components = result.components || {};
      return components.city || 
             components.town || 
             components.village || 
             components.municipality || 
             components.city_district || 
             components.district || 
             result.formatted.split(',')[0];
    } catch (err) {
      console.error('Error extracting location name:', err);
      return 'Unknown location';
    }
  };

  // Debounce the location search to prevent too many API calls
  useEffect(() => {
    if (cityInput.trim().length < 3) {
      setSuggestions([]);
      setError('');
      return;
    }
    
    const timer = setTimeout(() => {
      fetchLocationSuggestions(cityInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [cityInput, fetchLocationSuggestions]);

  // Handle location selection
  const handleSelectLocation = (location) => {
    setSelectedLocation(location);
    setCityInput('');
    setSuggestions([]);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (selectedLocation) {
      onLocationSet(selectedLocation);
    } else if (cityInput.trim().length >= 3) {
      fetchLocationSuggestions(cityInput);
    } else {
      setError('Please enter at least 3 characters to search.');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          inputRef.current && !inputRef.current.contains(event.target)) {
        setSuggestions([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Set Your Location</h2>
      <p className="mb-4 text-gray-600">We need your location to provide accurate weather advice.</p>
      
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="relative">
          <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
            <span className="pl-3 text-gray-500">
              🔍
            </span>
            <input
              ref={inputRef}
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="Enter at least 3 characters to search..."
              className="w-full py-2 px-4 outline-none text-gray-700"
            />
          </div>
          
          {suggestions.length > 0 && (
            <div 
              ref={dropdownRef}
              className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto"
            >
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="p-2 hover:bg-gray-100 cursor-pointer flex items-center text-gray-700"
                  onClick={() => handleSelectLocation(suggestion)}
                >
                  <span className="mr-2 text-red-500">📍</span>
                  <div>
                    <div className="font-medium">{suggestion.city}</div>
                    <div className="text-xs text-gray-500">{suggestion.formatted}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {loading && <p className="mt-2 text-sm text-gray-600">Searching...</p>}
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        {cityInput.trim().length > 0 && cityInput.trim().length < 3 && (
          <p className="mt-2 text-sm text-gray-600">Enter at least 3 characters to search</p>
        )}
      </form>
      
      {selectedLocation && (
        <div className="p-3 border rounded-lg bg-blue-50 mt-4">
          <h3 className="font-semibold text-gray-800 mb-1">Selected location:</h3>
          <div className="flex items-start">
            <span className="mt-1 mr-2 text-red-500">📍</span>
            <div>
              <p className="text-gray-800 font-medium">{selectedLocation.city}, {selectedLocation.country}</p>
              <p className="text-xs text-gray-600">{selectedLocation.formatted}</p>
              <button
                onClick={() => onLocationSet(selectedLocation)}
                className="mt-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}