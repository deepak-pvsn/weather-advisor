import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY;
    
    // Report if API key is not set
    if (!apiKey) {
      return NextResponse.json({
        error: 'API key is not set',
        apiKeyExists: false
      }, { status: 400 });
    }
    
    // Test query - should always return results
    const testQuery = 'London';
    
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${testQuery}&key=${apiKey}&limit=2`
    );
    
    // Get response data
    const data = await response.json();
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      apiKeyExists: true,
      keyStartsWith: apiKey.substring(0, 4) + '...',
      results: data.results ? data.results.length : 0,
      data: data.results ? data.results.map(r => ({
        formatted: r.formatted,
        components: r.components
      })) : null,
      error: data.error ? data.error.message : null
    });
  } catch (error) {
    return NextResponse.json({
      error: error.message,
      success: false
    }, { status: 500 });
  }
} 