import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { location, message } = await request.json();

    if (!location || !message) {
      return NextResponse.json(
        { error: 'Location and message are required' },
        { status: 400 }
      );
    }

    // Now we have rich location data for more precise weather queries
    const locationString = `${location.city}, ${location.admin}, ${location.country}`;
    
    // Create a more accurate query for LangChain
    const weatherQuery = `current weather in ${locationString}`;
    
    // Simulate getting response - in real implementation, this would use LangChain
    // to search for weather data using the precise location
    let response;
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('umbrella') || lowerMessage.includes('rain')) {
      response = `For ${locationString}, there's a moderate chance of rain today. It might be a good idea to bring an umbrella just to be safe.`;
    } 
    else if (lowerMessage.includes('jacket') || lowerMessage.includes('coat')) {
      response = `In ${locationString} today, temperatures will range between 55-68°F. A light jacket might be comfortable in the morning and evening.`;
    }
    else if (lowerMessage.includes('run') || lowerMessage.includes('exercise')) {
      response = `The conditions in ${locationString} are good for running today. The air quality is good and there's a light breeze. Morning would be the best time.`;
    }
    else if (lowerMessage.includes('sun') || lowerMessage.includes('sunscreen')) {
      response = `The UV index for ${locationString} today is moderate. If you'll be outside for more than 30 minutes, wearing sunscreen would be advisable.`;
    }
    else {
      response = `The weather in ${locationString} today is partly cloudy with temperatures around 65°F. It's generally pleasant with a light breeze from the west.`;
    }
    
    // Add a small delay to simulate API processing
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return NextResponse.json({ response });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    );
  }
} 