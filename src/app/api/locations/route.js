import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // Get the search query from the URL parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    // Validate the input
    if (!query || query.trim().length < 3) {
      return NextResponse.json(
        { error: 'Please provide a search query of at least 3 characters' },
        { status: 400 }
      );
    }

    // Check for API key
    const apiKey = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY;
    if (!apiKey) {
      console.error('OpenCage API key is missing');
      return NextResponse.json(
        { error: 'Configuration error: API key is missing' },
        { status: 500 }
      );
    }

    // Prepare the search term
    const formattedQuery = encodeURIComponent(query.trim());
    
    // Create URL with all necessary parameters for best results
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${formattedQuery}&key=${apiKey}&limit=10&no_annotations=1`;
    
    console.log(`Fetching from OpenCage: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);

    // Make request to OpenCage API
    const response = await fetch(url, { 
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      next: { revalidate: 0 }, // Don't cache the response
    });

    // For debugging
    console.log(`OpenCage response status: ${response.status}`);
    
    // Parse response
    const data = await response.json();
    
    // Log result count for debugging
    console.log(`OpenCage returned ${data.results?.length || 0} results`);
    
    // Handle common errors
    if (!response.ok) {
      console.error('OpenCage API error:', data);
      return NextResponse.json(
        { error: `Error from location service: ${data.status?.message || response.statusText}` },
        { status: response.status }
      );
    }
    
    // Provide fallback data for common Indian cities that might have issues
    const fallbackData = {
      "hyderabad": [
        {
          formatted: "Hyderabad, Telangana, India",
          geometry: { lat: 17.385044, lng: 78.486671 },
          components: {
            city: "Hyderabad",
            state: "Telangana",
            country: "India"
          }
        }
      ],
      "delhi": [
        {
          formatted: "New Delhi, Delhi, India",
          geometry: { lat: 28.613939, lng: 77.209021 },
          components: {
            city: "New Delhi",
            state: "Delhi",
            country: "India"
          }
        }
      ],
      "mumbai": [
        {
          formatted: "Mumbai, Maharashtra, India",
          geometry: { lat: 19.075984, lng: 72.877656 },
          components: {
            city: "Mumbai",
            state: "Maharashtra",
            country: "India"
          }
        }
      ],
    };
    
    // Check if we got results, if not and it's a common city, use fallback
    if ((!data.results || data.results.length === 0) && Object.keys(fallbackData).includes(query.toLowerCase())) {
      console.log(`Using fallback data for ${query}`);
      return NextResponse.json({
        results: fallbackData[query.toLowerCase()],
        status: { message: "OK (fallback data)" }
      });
    }
    
    // Simple clean response from the API
    return NextResponse.json(data);
      
  } catch (error) {
    console.error('Error in locations API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process location request', 
        details: error.message
      },
      { status: 500 }
    );
  }
} 