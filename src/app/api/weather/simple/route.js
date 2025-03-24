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

    console.log('Simple Weather API called for location:', location.city);

    // Generate weather data based on location
    const weatherData = generateSimpleWeatherData(location);
    
    // Generate a response based on the weather data and user message
    const response = generateSimpleResponse(message, location, weatherData);
    
    return NextResponse.json({
      response,
      weatherData,
    });
  } catch (error) {
    console.error('Error in simple weather API:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    );
  }
}

function generateSimpleWeatherData(location) {
  console.log('Generating simple weather data for:', location.city);
  
  // Generate somewhat realistic data based on location and current date
  const currentDate = new Date();
  const month = currentDate.getMonth(); // 0-11
  
  // Determine temperature based on rough latitude and time of year
  const isNorthern = location.lat > 0;
  const isSummer = (isNorthern && (month >= 5 && month <= 8)) || (!isNorthern && (month <= 2 || month >= 11));
  const isWinter = (isNorthern && (month <= 2 || month >= 11)) || (!isNorthern && (month >= 5 && month <= 8));
  
  let temp, condition;
  
  // Adjust temperature based on latitude (colder near poles, warmer near equator)
  const latitudeFactor = Math.abs(location.lat) / 90; // 0 at equator, 1 at poles
  
  if (isSummer) {
    temp = Math.floor(85 - (latitudeFactor * 25) + (Math.random() * 10)) + "°F";
    condition = ["Sunny", "Partly Cloudy", "Clear", "Hot"][Math.floor(Math.random() * 4)];
  } else if (isWinter) {
    temp = Math.floor(50 - (latitudeFactor * 40) + (Math.random() * 10)) + "°F";
    condition = ["Cloudy", "Cold", "Partly Cloudy", Math.random() > 0.7 ? "Snow" : "Overcast"][Math.floor(Math.random() * 4)];
  } else {
    temp = Math.floor(70 - (latitudeFactor * 20) + (Math.random() * 10)) + "°F";
    condition = ["Cloudy", "Partly Cloudy", Math.random() > 0.7 ? "Rain" : "Clear"][Math.floor(Math.random() * 4)];
  }
  
  const data = {
    current: {
      temperature: temp,
      condition: condition,
      humidity: Math.floor(Math.random() * 40 + 40) + "%",
      wind: Math.floor(Math.random() * 10 + 5) + " mph"
    },
    source: "simulated",
    timestamp: new Date().toISOString()
  };
  
  console.log('Generated weather data:', data);
  
  return data;
}

function generateSimpleResponse(message, location, weatherData) {
  const { temperature, condition, humidity, wind } = weatherData.current;
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('temperature') || lowerMessage.includes('how hot') || lowerMessage.includes('how cold')) {
    return `The current temperature in ${location.city} is ${temperature}. The conditions are ${condition}.`;
  } 
  else if (lowerMessage.includes('umbrella') || lowerMessage.includes('rain')) {
    if (condition.toLowerCase().includes('rain')) {
      return `It's currently ${condition} in ${location.city} with a temperature of ${temperature}. You should bring an umbrella!`;
    } else {
      return `It's currently ${condition} in ${location.city} with a temperature of ${temperature}. You probably don't need an umbrella today.`;
    }
  } 
  else if (lowerMessage.includes('jacket') || lowerMessage.includes('coat') || lowerMessage.includes('wear')) {
    const tempNum = parseInt(temperature);
    if (!isNaN(tempNum)) {
      if (tempNum < 50) {
        return `With a temperature of ${temperature} in ${location.city}, you should wear a warm coat.`;
      } else if (tempNum < 65) {
        return `With a temperature of ${temperature} in ${location.city}, a light jacket would be comfortable.`;
      } else {
        return `With a temperature of ${temperature} in ${location.city}, you probably don't need a jacket.`;
      }
    }
  }
  else if (lowerMessage.includes('run') || lowerMessage.includes('jog') || lowerMessage.includes('exercise')) {
    const isRainy = condition.toLowerCase().includes('rain');
    if (isRainy) {
      return `It's currently ${condition} in ${location.city} with a temperature of ${temperature}. If you don't mind getting wet, you can go for a run.`;
    } else {
      return `The conditions in ${location.city} are generally good for running today. It's ${condition} with a temperature of ${temperature}. Enjoy your run!`;
    }
  }
  
  return `The current weather in ${location.city} is ${condition} with a temperature of ${temperature}. The humidity is ${humidity} and wind speed is ${wind}.`;
} 