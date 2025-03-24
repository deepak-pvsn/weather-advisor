import { NextResponse } from 'next/server';

// Fallback location data for popular cities
const FALLBACK_LOCATIONS = {
  dallas: {
    results: [{
      formatted: "Dallas, Texas, United States",
      geometry: { lat: 32.7767, lng: -96.7970 },
      components: {
        city: "Dallas",
        country: "United States"
      }
    }]
  },
  london: {
    results: [{
      formatted: "London, England, United Kingdom",
      geometry: { lat: 51.5074, lng: -0.1278 },
      components: {
        city: "London",
        country: "United Kingdom"
      }
    }]
  },
  tokyo: {
    results: [{
      formatted: "Tokyo, Japan",
      geometry: { lat: 35.6762, lng: 139.6503 },
      components: {
        city: "Tokyo",
        country: "Japan"
      }
    }]
  },
  paris: {
    results: [{
      formatted: "Paris, Île-de-France, France",
      geometry: { lat: 48.8566, lng: 2.3522 },
      components: {
        city: "Paris",
        country: "France"
      }
    }]
  },
  "new york": {
    results: [{
      formatted: "New York, NY, United States",
      geometry: { lat: 40.7128, lng: -74.0060 },
      components: {
        city: "New York",
        country: "United States"
      }
    }]
  }
};

export async function GET(request) {
  try {
    // Get the search query from the URL parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Please provide a search query of at least 2 characters' },
        { status: 400 }
      );
    }

    // Normalize the query for matching
    const normalizedQuery = query.toLowerCase().trim();
    
    // Find matching cities
    let results = [];
    
    Object.keys(FALLBACK_LOCATIONS).forEach(cityKey => {
      if (normalizedQuery.includes(cityKey)) {
        results = FALLBACK_LOCATIONS[cityKey].results;
      }
    });

    // Return the fallback data
    return NextResponse.json({
      results,
      source: "fallback"
    });
  } catch (error) {
    console.error('Error in fallback locations API:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    );
  }
} 