import { NextResponse } from 'next/server';
import axios from 'axios';
import cheerio from 'cheerio';
import { ChatPromptTemplate, SystemMessage, HumanMessage } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";

// Simple in-memory cache for weather data
const weatherCache = new Map();
// Export sessionMemory so it can be accessed by clear-memory route
export const sessionMemory = new Map();
const historicalCache = new Map();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const HISTORICAL_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for historical data

// Cache helper functions
function getCachedWeatherData(cacheKey) {
  if (!weatherCache.has(cacheKey)) return null;
  
  const cachedData = weatherCache.get(cacheKey);
  if (Date.now() - cachedData.timestamp > CACHE_DURATION) { // 15 min expiration
    weatherCache.delete(cacheKey);
    return null;
  }
  
  return cachedData.data;
}

function cacheWeatherData(cacheKey, data) {
  weatherCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
}

// Generate cache key from location and question
function generateCacheKey(location, question) {
  const locationKey = `${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;
  const questionHash = Math.abs(question.split('').reduce((a, b) => {
    return ((a << 5) - a) + b.charCodeAt(0);
  }, 0) % 1000000);
  
  return `${locationKey}-${questionHash}`;
}

// Memory functions for chat history
function getMemoryForSession(sessionId) {
  if (!sessionMemory.has(sessionId)) {
    sessionMemory.set(sessionId, []);
  }
  return sessionMemory.get(sessionId);
}

function saveToMemory(sessionId, question, answer) {
  const memory = getMemoryForSession(sessionId);
  memory.push({ type: 'human', content: question });
  memory.push({ type: 'ai', content: answer });
  
  // Keep only the last 10 messages (5 exchanges)
  while (memory.length > 10) {
    memory.shift();
  }
}

function clearMemory(sessionId) {
  sessionMemory.delete(sessionId);
}

// Function to fetch comprehensive weather data from OpenWeatherMap APIs
async function fetchWeatherData(location) {
  const cacheKey = `${location.city}-${location.country}`;
  const cachedData = weatherCache.get(cacheKey);
  
  // Return cached data if it exists and hasn't expired
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    console.log(`Using cached weather data for ${location.city}, ${location.country}`);
    return cachedData.data;
  }
  
  console.log(`Fetching weather data for ${location.city}, ${location.country} using OpenWeatherMap API`);
  
  try {
    // Step 1: Get coordinates using the Geocoding API
    const geocodingResponse = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location.city)},${encodeURIComponent(location.country)}&limit=1&appid=${process.env.OPENWEATHER_API_KEY}`
    );
    
    if (!geocodingResponse.data || geocodingResponse.data.length === 0) {
      throw new Error('Location not found');
    }
    
    const { lat, lon } = geocodingResponse.data[0];
    console.log(`Found coordinates for ${location.city}: lat=${lat}, lon=${lon}`);
    
    // Step 2: Get current weather data
    const currentWeatherResponse = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${process.env.OPENWEATHER_API_KEY}`
    );
    
    // Step 3: Get OneCall API data (current, minutely, hourly, daily, alerts)
    const oneCallResponse = await axios.get(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=imperial&exclude=minutely&appid=${process.env.OPENWEATHER_API_KEY}`
    );
    
    // Step 4: Get air pollution data
    const airPollutionResponse = await axios.get(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}`
    );
    
    // Step 5: Get historical data for yesterday (for comparison)
    const yesterdayTimestamp = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
    let yesterdayData = null;
    
    // Check historical cache first
    const historicalCacheKey = `${cacheKey}-${yesterdayTimestamp}`;
    const cachedHistorical = historicalCache.get(historicalCacheKey);
    
    if (cachedHistorical && Date.now() - cachedHistorical.timestamp < HISTORICAL_CACHE_DURATION) {
      yesterdayData = cachedHistorical.data;
    } else {
      try {
        const historicalResponse = await axios.get(
          `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${yesterdayTimestamp}&units=imperial&appid=${process.env.OPENWEATHER_API_KEY}`
        );
        yesterdayData = historicalResponse.data;
        
        // Cache historical data
        historicalCache.set(historicalCacheKey, {
          timestamp: Date.now(),
          data: yesterdayData
        });
      } catch (error) {
        console.warn('Could not fetch historical data:', error.message);
        // Proceed without historical data
      }
    }
    
    // Process all the data
    const current = currentWeatherResponse.data;
    const oneCall = oneCallResponse.data;
    const airPollution = airPollutionResponse.data;
    
    // Get air quality index description
    const aqiDescriptions = [
      "Good", "Fair", "Moderate", "Poor", "Very Poor"
    ];
    
    const aqi = airPollution.list[0].main.aqi;
    const aqiDescription = aqiDescriptions[aqi - 1] || "Unknown";
    
    // Process alerts if any
    const alerts = oneCall.alerts || [];
    const activeAlerts = alerts.map(alert => ({
      event: alert.event,
      description: alert.description,
      start: new Date(alert.start * 1000).toLocaleString(),
      end: new Date(alert.end * 1000).toLocaleString()
    }));
    
    // Format the comprehensive weather data
    const weatherData = [
      {
        // Current weather
        temperature: `${Math.round(oneCall.current.temp)}°F`,
        condition: oneCall.current.weather[0].main,
        description: oneCall.current.weather[0].description,
        
        details: {
          "Feels Like": `${Math.round(oneCall.current.feels_like)}°F`,
          "Humidity": `${oneCall.current.humidity}%`,
          "Wind": `${Math.round(oneCall.current.wind_speed)} mph`,
          "Wind Direction": getWindDirection(oneCall.current.wind_deg),
          "Pressure": `${oneCall.current.pressure} hPa`,
          "Visibility": `${(oneCall.current.visibility / 1609).toFixed(1)} mi`,
          "Cloud Cover": `${oneCall.current.clouds}%`,
          "UV Index": `${oneCall.current.uvi.toFixed(1)}`,
          "Dew Point": `${Math.round(oneCall.current.dew_point)}°F`,
          "Sunrise": formatTime(oneCall.current.sunrise),
          "Sunset": formatTime(oneCall.current.sunset),
          "Air Quality": aqiDescription,
          "Rain Last Hour": oneCall.current.rain?.["1h"] ? `${oneCall.current.rain["1h"]} mm` : "0 mm",
          "Snow Last Hour": oneCall.current.snow?.["1h"] ? `${oneCall.current.snow["1h"]} mm` : "0 mm"
        },
        
        // Weather alerts
        alerts: activeAlerts,
        
        // Comparison with yesterday if available
        comparison: yesterdayData ? {
          tempYesterday: `${Math.round(yesterdayData.data[0].temp)}°F`,
          tempDifference: Math.round(oneCall.current.temp - yesterdayData.data[0].temp),
          conditionYesterday: yesterdayData.data[0].weather[0].main,
          wasWarmer: oneCall.current.temp > yesterdayData.data[0].temp,
          wasDrier: oneCall.current.humidity < yesterdayData.data[0].humidity,
          wasWindier: oneCall.current.wind_speed > yesterdayData.data[0].wind_speed
        } : null,
        
        // Daily forecast
        forecast: oneCall.daily.map(day => ({
          day: new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
          date: new Date(day.dt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          condition: day.weather[0].main,
          description: day.weather[0].description,
          temperature: `${Math.round(day.temp.max)}°F / ${Math.round(day.temp.min)}°F`,
          morningTemp: `${Math.round(day.temp.morn)}°F`,
          dayTemp: `${Math.round(day.temp.day)}°F`,
          eveTemp: `${Math.round(day.temp.eve)}°F`,
          nightTemp: `${Math.round(day.temp.night)}°F`,
          feelsLike: {
            morning: `${Math.round(day.feels_like.morn)}°F`,
            day: `${Math.round(day.feels_like.day)}°F`,
            evening: `${Math.round(day.feels_like.eve)}°F`,
            night: `${Math.round(day.feels_like.night)}°F`
          },
          precipitation: day.pop > 0 ? `${Math.round(day.pop * 100)}%` : "0%",
          rain: day.rain ? `${day.rain} mm` : "0 mm",
          snow: day.snow ? `${day.snow} mm` : "0 mm",
          humidity: `${day.humidity}%`,
          wind: `${Math.round(day.wind_speed)} mph`,
          windDirection: getWindDirection(day.wind_deg),
          uvi: day.uvi.toFixed(1),
          sunrise: formatTime(day.sunrise),
          sunset: formatTime(day.sunset),
          moonrise: formatTime(day.moonrise),
          moonset: formatTime(day.moonset),
          moonPhase: getMoonPhase(day.moon_phase)
        })),
        
        // Hourly forecast for the next 24 hours
        hourlyForecast: oneCall.hourly.slice(0, 24).map(hour => ({
          time: new Date(hour.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
          timestamp: hour.dt,
          condition: hour.weather[0].main,
          description: hour.weather[0].description,
          temperature: `${Math.round(hour.temp)}°F`,
          feelsLike: `${Math.round(hour.feels_like)}°F`,
          precipitation: hour.pop > 0 ? `${Math.round(hour.pop * 100)}%` : "0%",
          rain: hour.rain?.["1h"] ? `${hour.rain["1h"]} mm` : "0 mm",
          snow: hour.snow?.["1h"] ? `${hour.snow["1h"]} mm` : "0 mm",
          humidity: `${hour.humidity}%`,
          wind: `${Math.round(hour.wind_speed)} mph`,
          windDirection: getWindDirection(hour.wind_deg),
          uvi: hour.uvi.toFixed(1),
          visibility: `${(hour.visibility / 1609).toFixed(1)} mi`,
          cloudCover: `${hour.clouds}%`
        }))
      }
    ];
    
    // Cache the data
    weatherCache.set(cacheKey, {
      timestamp: Date.now(),
      data: weatherData
    });
    
    console.log(`Got comprehensive weather data for ${location.city}, ${location.country}`);
    console.log(`Current conditions: ${weatherData[0].condition}, Temperature: ${weatherData[0].temperature}`);
    console.log(`Has forecast data: ${weatherData[0].forecast && weatherData[0].forecast.length > 0}`);
    console.log(`Has hourly forecast data: ${weatherData[0].hourlyForecast && weatherData[0].hourlyForecast.length > 0}`);
    console.log(`Has alerts: ${weatherData[0].alerts && weatherData[0].alerts.length > 0}`);
    
    return weatherData;
  } catch (error) {
    console.error('Error fetching weather data from OpenWeatherMap:', error.message);
    
    if (error.response) {
      console.error('API error details:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    
    // If there's cached data, return it even if expired
    if (cachedData) {
      console.log('Using expired cached data as fallback');
      return cachedData.data;
    }
    
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}

// Helper function to format time
function formatTime(timestamp) {
  if (!timestamp) return "N/A";
  return new Date(timestamp * 1000).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

// Helper function to get wind direction from degrees
function getWindDirection(degrees) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

// Helper function to get moon phase name
function getMoonPhase(phase) {
  if (phase === 0 || phase === 1) return "New Moon";
  if (phase < 0.25) return "Waxing Crescent";
  if (phase === 0.25) return "First Quarter";
  if (phase < 0.5) return "Waxing Gibbous";
  if (phase === 0.5) return "Full Moon";
  if (phase < 0.75) return "Waning Gibbous";
  if (phase === 0.75) return "Last Quarter";
  return "Waning Crescent";
}

// Enhanced function to handle more specific questions about forecasts and activities
function handleCommonWeatherQuestions(weatherData, question, location) {
  if (!weatherData || weatherData.length === 0) {
    return `I'm sorry, I don't have any weather data for ${location.city}, ${location.country} at the moment.`;
  }
  
  const data = weatherData[0];
  return `Currently in ${location.city}, it's ${data.temperature} with ${data.condition} conditions. I don't have specific information to answer your question in detail.`;
}

// Update our custom OpenRouter integration to match LangChain's Runnable interface
class OpenRouterChatModel {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.modelName = config.modelName || "google/gemini-2.0-pro-exp-02-05:free";
    this.temperature = config.temperature || 0.7;
    this.maxTokens = config.maxTokens || 500;
    this.baseUrl = config.baseUrl || "https://openrouter.ai/api/v1/chat/completions";
    this.httpRetries = config.httpRetries || 2;
  }

  async invoke(messages, options = {}) {
    // Convert LangChain message format to OpenRouter format
    const formattedMessages = messages.map(msg => ({
      role: msg._getType() === 'system' ? 'system' : (msg._getType() === 'human' ? 'user' : 'assistant'),
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    }));
    
    // Retry logic
    let lastError;
    for (let attempt = 0; attempt <= this.httpRetries; attempt++) {
      try {
        console.log("Sending request to OpenRouter with formatted messages:", JSON.stringify(formattedMessages).substring(0, 200) + "...");
        
        // Make request to OpenRouter
        const response = await axios.post(
          this.baseUrl,
          {
            model: this.modelName,
            messages: formattedMessages,
            max_tokens: this.maxTokens,
            temperature: this.temperature
          },
          {
            headers: {
              "Authorization": `Bearer ${this.apiKey}`,
              "HTTP-Referer": process.env.APP_URL || "https://weather-advisor.example.com",
              "X-Title": "Weather Advisor",
              "Content-Type": "application/json"
            }
          }
        );
        
        // Extract the response
        const responseMessage = response.data.choices[0].message;
        return responseMessage.content;
      } catch (error) {
        console.error(`OpenRouter API error (attempt ${attempt + 1}):`, error.message);
        lastError = error;
        
        // Wait before retrying (exponential backoff)
        if (attempt < this.httpRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If we get here, all attempts failed
    throw lastError || new Error("Failed to communicate with OpenRouter API");
  }
}

// Use LangChain's prompt templates to analyze weather data
async function analyzeWeatherWithLangChain(weatherData, question, location, sessionId) {
  try {
    // Get chat history
    const history = getMemoryForSession(sessionId) || [];
    
    // Format history for the prompt
    let formattedHistory = "";
    if (history.length > 0) {
      const recentHistory = history.slice(-6); // Get last 6 messages (3 exchanges)
      formattedHistory = recentHistory.map(m => 
        `${m.type === 'human' ? 'Human' : 'Assistant'}: ${m.content}`
      ).join('\n');
    }
    
    // Extract current weather information
    const currentWeather = {
      temperature: weatherData[0]?.temperature || "Not available",
      condition: weatherData[0]?.condition || "Not available",
      details: weatherData[0]?.details || {}
    };
    
    // Extract forecast information if available
    const forecast = weatherData.find(data => data.forecast && data.forecast.length > 0)?.forecast || [];
    const hourlyForecast = weatherData.find(data => data.hourlyForecast && data.hourlyForecast.length > 0)?.hourlyForecast || [];
    
    // Prepare comprehensive weather context
    let currentWeatherString = `Temperature: ${currentWeather.temperature}\nConditions: ${currentWeather.condition}\n`;
    if (Object.keys(currentWeather.details).length > 0) {
      currentWeatherString += Object.entries(currentWeather.details)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
    }
    
    // Format forecast data
    let forecastString = "";
    if (forecast && forecast.length > 0) {
      forecastString = forecast.map(f => 
        `${f.day}: ${f.condition}, ${f.temperature}`
      ).join('\n');
    }
    
    // Format hourly forecast data
    let hourlyForecastString = "";
    if (hourlyForecast && hourlyForecast.length > 0) {
      hourlyForecastString = hourlyForecast.slice(0, 6).map(f => 
        `${f.time}: ${f.condition}, ${f.temperature}`
      ).join('\n');
    }
    
    // Create LangChain prompt templates
    const systemTemplate = `You are a helpful weather advisor for {location}. 
Your job is to provide accurate, helpful information about the weather based solely on the data provided.

For forecast questions, refer specifically to the forecast data if available.
For activity questions, consider the current conditions, temperature, and forecast.
Keep responses concise, accurate, and helpful.`;

    const humanTemplate = `{chat_history}

I need information about the weather in {location}. My question is: "{question}"

Current Weather:
{current_weather}

{forecast_data}

{hourly_forecast_data}

Please answer my question accurately based on this weather information.`;

    // Create a chat prompt template
    const chatPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(systemTemplate),
      HumanMessagePromptTemplate.fromTemplate(humanTemplate)
    ]);
    
    console.log("Using LangChain to generate response with Gemini via OpenRouter...");
    
    // Create custom OpenRouter model
    const openRouterModel = new OpenRouterChatModel({
      apiKey: process.env.OPENROUTER_API_KEY,
      modelName: "google/gemini-2.0-pro-exp-02-05:free",
      temperature: 0.7,
      maxTokens: 500
    });

    // Create a custom parser to handle the output
    const outputParser = new StringOutputParser();
    
    // Create a chain using the new RunnableSequence API
    const chain = RunnableSequence.from([
      chatPrompt,
      openRouterModel,
      outputParser
    ]);
    
    // Execute the chain with the updated API
    const response = await chain.invoke({
      location: `${location.city}, ${location.country}`,
      chat_history: formattedHistory,
      question: question,
      current_weather: currentWeatherString,
      forecast_data: forecast.length > 0 ? `Forecast:\n${forecastString}` : "No forecast data available.",
      hourly_forecast_data: hourlyForecast.length > 0 ? `Hourly Forecast:\n${hourlyForecastString}` : "No hourly forecast data available."
    });
    
    console.log("LangChain response received:", response.substring(0, 100) + "...");
    
    // Save to memory
    saveToMemory(sessionId, question, response);
    
    return response;
  } catch (error) {
    console.error("Error using LangChain:", error);
    
    // Use the enhanced fallback approach
    const patternAnswer = handleCommonWeatherQuestions(weatherData, question, location);
    if (patternAnswer) {
      return patternAnswer;
    }
    
    // Last resort - use basic pattern matching
    return createFallbackAnswer(weatherData, question, location);
  }
}

// Create specialized templates for different weather question types
function createSpecializedPrompt(questionType) {
  switch (questionType) {
    case "forecast":
      return ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(
          `You are a weather forecaster providing information for {location}.
          Focus only on the forecast data provided. Be specific about temperatures, 
          conditions, and precipitation chances. If data isn't available for a specific 
          time period, clearly state that.`
        ),
        HumanMessagePromptTemplate.fromTemplate(
          `What will the weather be like in {location} {time_period}?
          
          Current Weather:
          {current_weather}
          
          Forecast Data:
          {forecast_data}
          
          Hourly Forecast:
          {hourly_forecast_data}`
        )
      ]);
      
    case "activity":
      return ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(
          `You are a helpful advisor determining if weather conditions in {location} 
          are suitable for {activity}. Consider temperature, precipitation, wind, 
          and other relevant factors. Give clear advice and reasoning.`
        ),
        HumanMessagePromptTemplate.fromTemplate(
          `Is it good weather for {activity} in {location} {time_period}?
          
          Current Weather:
          {current_weather}
          
          Forecast Data:
          {forecast_data}
          
          Hourly Forecast:
          {hourly_forecast_data}`
        )
      ]);
      
    default:
      return ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(
          `You are a helpful weather advisor for {location}. 
          Your job is to provide accurate information based solely on the weather data provided.`
        ),
        HumanMessagePromptTemplate.fromTemplate(
          `{question}
          
          Current Weather:
          {current_weather}
          
          Forecast Data:
          {forecast_data}
          
          Hourly Forecast:
          {hourly_forecast_data}`
        )
      ]);
  }
}

// Determine the type of weather question
function categorizeQuestion(question) {
  const lowerQuestion = question.toLowerCase();
  
  if (lowerQuestion.includes("forecast") || 
      lowerQuestion.includes("tomorrow") || 
      lowerQuestion.includes("later") || 
      lowerQuestion.includes("tonight")) {
    return "forecast";
  }
  
  if ((lowerQuestion.includes("can i") || lowerQuestion.includes("should i")) &&
      (lowerQuestion.includes("walk") || lowerQuestion.includes("run") || 
       lowerQuestion.includes("outside"))) {
    return "activity";
  }
  
  return "general";
}

// Use the appropriate chain based on question type
async function analyzeWithSpecializedChain(weatherData, question, location, sessionId) {
  const questionType = categorizeQuestion(question);
  const promptTemplate = createSpecializedPrompt(questionType);
  
  // Extract activity and time period for activity questions
  let activity = "outdoor activity";
  let timePeriod = "now";
  
  if (questionType === "activity") {
    // Extract activity type
    const activityMatch = question.match(/(?:can|should)\s+i\s+(?:go\s+(?:for\s+a\s+)?|do\s+)(\w+)/i);
    if (activityMatch && activityMatch[1]) {
      activity = activityMatch[1];
    }
    
    // Extract time period
    const timeMatch = question.match(/(?:tonight|tomorrow|later|this\s+\w+)/i);
    if (timeMatch) {
      timePeriod = timeMatch[0];
    }
  } else if (questionType === "forecast") {
    // Extract time period for forecast
    const timeMatch = question.match(/(?:tonight|tomorrow|later|next\s+\w+|this\s+\w+)/i);
    if (timeMatch) {
      timePeriod = timeMatch[0];
    }
  }
  
  // Create specialized chain
  const llm = new OpenRouterChatModel({
    apiKey: process.env.OPENROUTER_API_KEY,
    modelName: "google/gemini-2.0-pro-exp-02-05:free",
    temperature: 0.7,
    maxTokens: 500
  });
  const chain = new LLMChain({
    prompt: promptTemplate,
    llm: llm
  });
  
  // Prepare variables
  // ... (extract weather data as before) ...
  
  // Execute the chain with the specialized variables
  const response = await chain.invoke({
    location: `${location.city}, ${location.country}`,
    question: question,
    activity: activity,
    time_period: timePeriod,
    current_weather: currentWeatherString,
    forecast_data: forecastString,
    hourly_forecast_data: hourlyForecastString
  });
  
  return response.text;
}

// Use a chain to extract key weather factors, then a second chain to provide advice
function createActivityAdvisorChain(llm) {
  // First chain extracts relevant weather factors for the activity
  const extractFactorsChain = new LLMChain({
    llm,
    prompt: ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `You are a weather analyst. Extract only the weather factors relevant to {activity} in {location}.`
      ),
      HumanMessagePromptTemplate.fromTemplate(
        `What weather factors are important for {activity} in {location}?
        
        Current Weather:
        {current_weather}
        
        Forecast:
        {forecast_data}`
      )
    ]),
    outputKey: "relevant_factors"
  });
  
  // Second chain provides specific advice
  const provideAdviceChain = new LLMChain({
    llm,
    prompt: ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `You are a helpful advisor determining if weather conditions are suitable for an activity.`
      ),
      HumanMessagePromptTemplate.fromTemplate(
        `Based on these weather factors:
        {relevant_factors}
        
        Is it good weather for {activity} in {location} {time_period}? Provide a brief, helpful recommendation.`
      )
    ]),
    outputKey: "advice"
  });
  
  // Combine chains
  return new LLMChain({
    llm,
    prompt: ChatPromptTemplate.fromPromptMessages([
      extractFactorsChain,
      provideAdviceChain
    ]),
    inputVariables: ["activity", "location", "time_period", "current_weather", "forecast_data"],
    outputVariables: ["advice"],
    verbose: true
  });
}

// Main API handler
export async function POST(request) {
  try {
    const { question, location, sessionId } = await request.json();
    
    if (!question || !location || !location.city) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Fetch weather data (with caching)
    const weatherData = await getWeatherData(location);
    
    // Get chat history for this session
    sessionMemory[sessionId] = sessionMemory[sessionId] || [];
    
    // Add user question to session memory
    sessionMemory[sessionId].push({ role: 'user', content: question });
    
    // Use full LLM analysis for all questions
    console.log("Using full LLM analysis for all weather questions");
    
    // Try to get an answer from LLM
    const answer = await analyzeWeatherWithLLM(
      question,
      location,
      weatherData,
      sessionMemory[sessionId]
    );
    
    // Add assistant response to session memory
    sessionMemory[sessionId].push({ role: 'assistant', content: answer });
    
    // Keep only the last 10 messages for context
    if (sessionMemory[sessionId].length > 10) {
      sessionMemory[sessionId] = sessionMemory[sessionId].slice(-10);
    }
    
    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Error in weather route:", error);
    return NextResponse.json(
      { error: "Failed to process your request" },
      { status: 500 }
    );
  }
}

// Function to get weather data (with caching)
async function getWeatherData(location) {
  const cacheKey = `${location.city},${location.country}`;
  const now = Date.now();
  
  // Check if we have cached data that's still valid
  if (weatherCache[cacheKey] && weatherCache[cacheKey].timestamp > now - CACHE_DURATION) {
    console.log(`Using cached weather data for ${location.city}, ${location.country}`);
    return weatherCache[cacheKey].data;
  }
  
  console.log(`Fetching weather data for ${location.city}, ${location.country} using OpenWeatherMap API`);
  
  // Step 1: Get coordinates for the location
  const geocodingApiKey = process.env.OPENWEATHER_API_KEY;
  
  // Debug - Log the first and last characters of the API key
  if (geocodingApiKey) {
    const firstChar = geocodingApiKey.substring(0, 1);
    const lastChar = geocodingApiKey.substring(geocodingApiKey.length - 1);
    const keyLength = geocodingApiKey.length;
    console.log(`API Key check: ${firstChar}...${lastChar} (${keyLength} chars)`);
  } else {
    console.error("API Key is missing! Check your .env.local file");
    throw new Error("Missing OpenWeatherMap API key");
  }
  
  const geocodingUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location.city)},${encodeURIComponent(location.country)}&limit=1&appid=${geocodingApiKey}`;
  
  console.log(`Making geocoding request to: ${geocodingUrl.replace(geocodingApiKey, 'API_KEY')}`);
  
  const geocodingResponse = await axios.get(geocodingUrl);
  if (!geocodingResponse.data || geocodingResponse.data.length === 0) {
    throw new Error(`Could not find coordinates for ${location.city}, ${location.country}`);
  }
  
  const { lat, lon } = geocodingResponse.data[0];
  console.log(`Found coordinates for ${location.city}: lat=${lat}, lon=${lon}`);
  
  // Step 2: Get comprehensive weather data
  const weatherApiKey = process.env.OPENWEATHER_API_KEY;
  const weatherUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=imperial&appid=${weatherApiKey}`;
  
  console.log(`Making weather data request to: ${weatherUrl.replace(weatherApiKey, 'API_KEY')}`);
  
  const weatherResponse = await axios.get(weatherUrl);
  const data = weatherResponse.data;
  
  // Add location info to the weather data
  data.location = location;
  
  // Log some info about the data we received
  console.log(`Got comprehensive weather data for ${location.city}, ${location.country}`);
  console.log(`Current conditions: ${data.current.weather[0].main}, Temperature: ${data.current.temp}°F`);
  console.log(`Has forecast data: ${!!data.daily}`);
  console.log(`Has hourly forecast data: ${!!data.hourly}`);
  console.log(`Has alerts: ${!!(data.alerts && data.alerts.length > 0)}`);
  
  // Cache the data
  weatherCache[cacheKey] = {
    timestamp: now,
    data: data
  };
  
  return data;
}

// Function to identify the intent of a weather question
function identifyQuestionIntent(question, weatherData) {
  const lowerQuestion = question.toLowerCase();
  
  // Check for UV index questions
  if (lowerQuestion.includes('uv index') || lowerQuestion.includes('ultraviolet') || 
      (lowerQuestion.includes('sunscreen') && !lowerQuestion.includes('need sunscreen'))) {
    console.log("Direct classification: explanation (UV index)");
    return 'explanation';
  }
  
  // Check for air quality questions
  if (lowerQuestion.includes('air quality') || lowerQuestion.includes('aqi') || 
      lowerQuestion.includes('pollution')) {
    return 'explanation';
  }
  
  // Check for forecast questions
  if (lowerQuestion.includes('forecast') || lowerQuestion.includes('tomorrow') || 
      lowerQuestion.includes('next week') || lowerQuestion.includes('this week') ||
      lowerQuestion.includes('upcoming') || lowerQuestion.includes('future') ||
      lowerQuestion.includes('later') || lowerQuestion.includes('tonight')) {
    return 'forecast';
  }
  
  // Check for current condition questions
  if (lowerQuestion.includes('current') || lowerQuestion.includes('now') ||
      lowerQuestion.includes('temperature') || lowerQuestion.includes('hot') ||
      lowerQuestion.includes('cold') || lowerQuestion.includes('warm') ||
      lowerQuestion.includes('cool') || lowerQuestion.includes('humidity') ||
      lowerQuestion.includes('pressure') || lowerQuestion.includes('wind') ||
      lowerQuestion.includes('feels like') || lowerQuestion.includes('real feel')) {
    return 'current_conditions';
  }
  
  // Check for clothing questions
  if (lowerQuestion.includes('wear') || lowerQuestion.includes('dress') ||
      lowerQuestion.includes('clothes') || lowerQuestion.includes('jacket') ||
      lowerQuestion.includes('coat') || lowerQuestion.includes('layers') ||
      lowerQuestion.includes('sunscreen') || lowerQuestion.includes('hat') ||
      lowerQuestion.includes('umbrella') || lowerQuestion.includes('rain gear')) {
    return 'clothing';
  }
  
  // Check for activity questions
  if (lowerQuestion.includes('activity') || lowerQuestion.includes('exercise') ||
      lowerQuestion.includes('outdoor') || lowerQuestion.includes('picnic') ||
      lowerQuestion.includes('hike') || lowerQuestion.includes('run') ||
      lowerQuestion.includes('walk') || lowerQuestion.includes('bike') ||
      lowerQuestion.includes('swimming') || lowerQuestion.includes('beach')) {
    return 'activity';
  }
  
  // Check for safety questions
  if (lowerQuestion.includes('safe') || lowerQuestion.includes('danger') ||
      lowerQuestion.includes('warning') || lowerQuestion.includes('alert') ||
      lowerQuestion.includes('storm') || lowerQuestion.includes('tornado') ||
      lowerQuestion.includes('hurricane') || lowerQuestion.includes('flood') ||
      lowerQuestion.includes('lightning') || lowerQuestion.includes('thunder')) {
    return 'safety';
  }
  
  // Check for astronomy questions
  if (lowerQuestion.includes('sunrise') || lowerQuestion.includes('sunset') ||
      lowerQuestion.includes('moon') || lowerQuestion.includes('star') ||
      lowerQuestion.includes('night sky') || lowerQuestion.includes('astronomy')) {
    return 'astronomy';
  }
  
  // Check for travel questions
  if (lowerQuestion.includes('travel') || lowerQuestion.includes('trip') ||
      lowerQuestion.includes('drive') || lowerQuestion.includes('fly') ||
      lowerQuestion.includes('flight') || lowerQuestion.includes('road') ||
      lowerQuestion.includes('traffic')) {
    return 'travel';
  }
  
  // Check for comparison questions
  if (lowerQuestion.includes('compare') || lowerQuestion.includes('difference') ||
      lowerQuestion.includes('vs') || lowerQuestion.includes('versus') ||
      lowerQuestion.includes('than') || lowerQuestion.includes('compared to')) {
    return 'comparison';
  }
  
  // Check for alerts
  if (lowerQuestion.includes('alert') || lowerQuestion.includes('warning') ||
      lowerQuestion.includes('watch') || lowerQuestion.includes('advisory')) {
    return 'alerts';
  }
  
  // Default to current conditions if no specific intent is found
  return 'current_conditions';
}

// Extract relevant weather data based on intent
function extractRelevantWeatherData(weatherData, intent) {
  const data = {
    current: {
      temperature: weatherData.current.temp,
      conditions: weatherData.current.weather[0].description,
      feelsLike: weatherData.current.feels_like,
      humidity: weatherData.current.humidity,
      wind: {
        speed: weatherData.current.wind_speed,
        direction: weatherData.current.wind_deg
      }
    },
    details: {},
    location: `${weatherData.location.city}, ${weatherData.location.country}`
  };
  
  // Always include UV Index if available
  if (weatherData.current.uvi !== undefined) {
    data.details["UV Index"] = weatherData.current.uvi;
    data.uvIndex = weatherData.current.uvi;
  }
  
  // Add more data based on intent
  switch (intent) {
    case 'forecast':
      data.daily = weatherData.daily.map(day => ({
        date: new Date(day.dt * 1000).toLocaleDateString(),
        tempHigh: day.temp.max,
        tempLow: day.temp.min,
        conditions: day.weather[0].description
      }));
      data.hourly = weatherData.hourly.slice(0, 24).map(hour => ({
        time: new Date(hour.dt * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        temp: hour.temp,
        conditions: hour.weather[0].description,
        precipitation: hour.pop * 100
      }));
      break;
      
    case 'current_conditions':
      data.details["Visibility"] = `${weatherData.current.visibility / 1000} mi`;
      data.details["Pressure"] = `${weatherData.current.pressure} hPa`;
      data.details["UV Index"] = weatherData.current.uvi;
      data.details["Dew Point"] = `${weatherData.current.dew_point}°F`;
      data.details["Cloud Cover"] = `${weatherData.current.clouds}%`;
      break;
      
    case 'clothing':
      // Add UV index prominently for clothing/sunscreen questions
      data.details["UV Index"] = weatherData.current.uvi;
      data.uvIndex = weatherData.current.uvi;
      data.details["Cloud Cover"] = `${weatherData.current.clouds}%`;
      data.details["Rain Chance"] = weatherData.hourly[0].pop * 100 + "%";
      break;
      
    case 'activity':
      data.details["UV Index"] = weatherData.current.uvi;
      data.details["Cloud Cover"] = `${weatherData.current.clouds}%`;
      data.details["Rain Chance"] = weatherData.hourly[0].pop * 100 + "%";
      data.hourly = weatherData.hourly.slice(0, 12).map(hour => ({
        time: new Date(hour.dt * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        temp: hour.temp,
        conditions: hour.weather[0].description,
        precipitation: hour.pop * 100
      }));
      break;
      
    case 'safety':
      if (weatherData.alerts && weatherData.alerts.length > 0) {
        data.alerts = weatherData.alerts.map(alert => ({
          event: alert.event,
          description: alert.description,
          start: new Date(alert.start * 1000).toLocaleString(),
          end: new Date(alert.end * 1000).toLocaleString()
        }));
      } else {
        data.alerts = [];
      }
      break;
      
    case 'astronomy':
      if (weatherData.daily && weatherData.daily.length > 0) {
        const today = weatherData.daily[0];
        data.astronomy = {
          sunrise: new Date(today.sunrise * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          sunset: new Date(today.sunset * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          moonPhase: today.moon_phase
        };
      }
      break;
      
    case 'travel':
      data.details["Visibility"] = `${weatherData.current.visibility / 1000} mi`;
      data.details["Wind"] = `${weatherData.current.wind_speed} mph`;
      if (weatherData.alerts && weatherData.alerts.length > 0) {
        data.alerts = weatherData.alerts.map(alert => ({
          event: alert.event,
          description: alert.description
        }));
      }
      break;
      
    case 'comparison':
      // For comparison, we provide current and forecast data
      data.daily = weatherData.daily.slice(0, 3).map(day => ({
        date: new Date(day.dt * 1000).toLocaleDateString(),
        tempHigh: day.temp.max,
        tempLow: day.temp.min,
        conditions: day.weather[0].description,
        humidity: day.humidity,
        windSpeed: day.wind_speed
      }));
      break;
      
    case 'alerts':
      if (weatherData.alerts && weatherData.alerts.length > 0) {
        data.alerts = weatherData.alerts.map(alert => ({
          event: alert.event,
          description: alert.description,
          start: new Date(alert.start * 1000).toLocaleString(),
          end: new Date(alert.end * 1000).toLocaleString()
        }));
      } else {
        data.alerts = [];
      }
      break;
      
    case 'explanation':
      data.details["Air Quality"] = weatherData.current.aqi ? getAQIDescription(weatherData.current.aqi) : "Not available";
      data.details["UV Index"] = weatherData.current.uvi;
      break;
  }
  
  return data;
}

// Format weather data for display in the prompt
function formatWeatherDataForPrompt(data, intent) {
  let output = "";
  
  // Add current weather conditions
  output += "CURRENT WEATHER:\n";
  output += `Temperature: ${data.current.temperature}°F\n`;
  output += `Conditions: ${data.current.conditions}\n`;
  output += `Feels Like: ${data.current.feelsLike}°F\n`;
  output += `Humidity: ${data.current.humidity}%\n`;
  output += `Wind: ${data.current.wind.speed} mph from ${getWindDirection(data.current.wind.direction)}\n`;
  
  // Add any additional details
  if (Object.keys(data.details).length > 0) {
    for (const [key, value] of Object.entries(data.details)) {
      output += `${key}: ${value}\n`;
    }
  }
  
  // Add specialized data based on intent
  if (intent === 'forecast' || intent === 'comparison') {
    if (data.daily) {
      output += "\nDAILY FORECAST:\n";
      data.daily.forEach(day => {
        output += `${day.date}: High ${day.tempHigh}°F, Low ${day.tempLow}°F, ${day.conditions}\n`;
      });
    }
    
    if (intent === 'forecast' && data.hourly) {
      output += "\nHOURLY FORECAST (next 12 hours):\n";
      data.hourly.slice(0, 12).forEach(hour => {
        output += `${hour.time}: ${hour.temp}°F, ${hour.conditions}, ${hour.precipitation}% chance of precipitation\n`;
      });
    }
  }
  
  if (intent === 'activity' && data.hourly) {
    output += "\nUPCOMING HOURS:\n";
    data.hourly.slice(0, 6).forEach(hour => {
      output += `${hour.time}: ${hour.temp}°F, ${hour.conditions}, ${hour.precipitation}% chance of precipitation\n`;
    });
  }
  
  if (intent === 'safety' || intent === 'alerts') {
    if (data.alerts && data.alerts.length > 0) {
      output += "\nWEATHER ALERTS:\n";
      data.alerts.forEach(alert => {
        output += `${alert.event}: ${alert.description.substring(0, 200)}...\n`;
        output += `Valid: ${alert.start} to ${alert.end}\n\n`;
      });
    } else {
      output += "\nNo weather alerts currently in effect.\n";
    }
  }
  
  if (intent === 'astronomy' && data.astronomy) {
    output += "\nASTRONOMY INFO:\n";
    output += `Sunrise: ${data.astronomy.sunrise}\n`;
    output += `Sunset: ${data.astronomy.sunset}\n`;
    output += `Moon Phase: ${getMoonPhaseDescription(data.astronomy.moonPhase)}\n`;
  }
  
  if (intent === 'explanation') {
    output += "\nREFERENCE DATA FOR EXPLANATIONS:\n";
    
    if (data.details["Air Quality"]) {
      output += `Current Air Quality: ${data.details["Air Quality"]}\n`;
    }
    
    if (data.details["UV Index"]) {
      output += `Current UV Index: ${data.details["UV Index"]}\n`;
    }
    
    // Add explanations for reference
    output += `AQI Scale: 0-50 (Good), 51-100 (Moderate), 101-150 (Unhealthy for Sensitive Groups), 151-200 (Unhealthy), 201-300 (Very Unhealthy), 301+ (Hazardous)\n`;
    output += `UV Index Scale: 0-2 (Low), 3-5 (Moderate), 6-7 (High), 8-10 (Very High), 11+ (Extreme)\n`;
  }
  
  return output;
}

// Create system prompt for different question intents
function createSystemPromptForIntent(intent, weatherData) {
  // Create appropriate system prompts based on intent
  if (intent === 'forecast') {
    return `You're providing weather forecast information.
Focus on the forecast data and highlight weather patterns over the requested time period.
Be concise yet thorough in explaining temperature trends, precipitation chances, and conditions.`;
  }
  
  if (intent === 'current_conditions') {
    return `You're providing current weather conditions information.
Focus on the current temperature, conditions, and how it feels outside right now.
Include relevant details like humidity, wind, and visibility if they're significant.`;
  }
  
  if (intent === 'comparison') {
    return `You're comparing weather conditions.
Focus on effectively comparing the elements the user is asking about.
Highlight meaningful differences or similarities in the weather patterns.`;
  }
  
  if (intent === 'clothing') {
    // Add the UV index information
    const uvIndex = weatherData.details?.["UV Index"] || weatherData.uvIndex || "Not available";
    
    return `You're currently focused on providing clothing recommendations based on the weather.
Consider these key factors:
- Temperature: ${weatherData.current.temperature}°F (feels like ${weatherData.current.feelsLike}°F)
- Conditions: ${weatherData.current.conditions}
- Humidity: ${weatherData.current.humidity}%
- Wind: ${weatherData.current.wind.speed} mph
- UV Index: ${uvIndex}

For UV protection specifically:
- UV Index 0-2: No protection needed
- UV Index 3-5: Some protection recommended (hat, sunglasses)
- UV Index 6-7: Protection required (sunscreen SPF 30+, hat, sunglasses)
- UV Index 8-10: Extra protection needed (sunscreen SPF 50+, stay in shade during midday)
- UV Index 11+: Extreme protection required (minimize outdoor activities)

Provide practical clothing advice that keeps the person comfortable, protected, and appropriate for the weather conditions.`;
  }
  
  if (intent === 'activity') {
    return `You're providing recommendations about suitable outdoor activities based on the weather.
Consider the current conditions, forecast, and any potential weather hazards.
Suggest specific activities that would be enjoyable and safe in the current weather.`;
  }
  
  if (intent === 'safety') {
    return `You're providing weather safety advice.
Focus on potential weather hazards and appropriate safety measures.
Be clear and direct about any precautions that should be taken.`;
  }
  
  if (intent === 'astronomy') {
    return `You're providing astronomy-related weather information.
Focus on conditions for skygazing, sunrise/sunset times, moon phases, or other celestial observations.
Consider cloud cover, visibility, and light pollution in your response.`;
  }
  
  if (intent === 'travel') {
    return `You're providing weather advice related to travel.
Focus on how weather might impact travel plans, road conditions, or transportation.
Offer practical advice for dealing with the weather while traveling.`;
  }
  
  if (intent === 'alerts') {
    return `You're providing information about weather alerts or warnings.
Focus on communicating any active weather alerts, their severity, and recommended precautions.
If no alerts are active, reassure the user about the current weather safety.`;
  }
  
  if (intent === 'explanation') {
    return `You're providing a detailed explanation about weather concepts.
For UV Index explanation requests:
- Explain what the UV Index is (a measure of UV radiation strength)
- Describe the scale (0-11+)
- Describe health risks at different levels
- Provide specific protection recommendations for each level
- Connect the current UV Index value (${weatherData.details["UV Index"] || weatherData.uvIndex || "Not available"}) to what it means for the user
- Include time of day considerations (UV peaks at solar noon)
- Mention that UV can be present even on cloudy days

For AQI explanation requests:
- Explain what the Air Quality Index measures
- Describe the AQI scale and categories
- Explain health implications of different AQI levels
- Connect to current AQI level if available
- Suggest protective measures for poor air quality

For other weather concepts, provide clear, educational explanations that help the user understand the science behind the weather.`;
  }
  
  // Default system prompt for general questions
  return `You are a helpful weather assistant providing information about the weather in ${weatherData.location}.
Based on the weather data provided, answer the user's question accurately and helpfully.
If you don't have certain information, acknowledge that limitation but provide what you do know.`;
}

// Adjust max_tokens based on the type of response needed
const getMaxTokensForIntent = (intent) => {
  switch (intent) {
    case 'current_conditions':
      return 300;  // Simple current weather needs less tokens
    case 'forecast':
      return 600;  // Forecast needs more tokens for multiple days
    case 'explanation':
      return 800;  // Detailed explanations need more tokens
    default:
      return 500;  // Default balanced value
  }
};

// Analyze weather data with LLM
async function analyzeWeatherWithLLM(question, location, weatherData, chatHistory = []) {
  console.log("🔍 Analyzing question:", question);
  
  // Get intent of the question
  const intent = identifyQuestionIntent(question, weatherData);
  console.log("🎯 Identified intent:", intent);
  
  // Check if UV index is available and log it
  if (weatherData?.current?.uvi !== undefined) {
    console.log("☀️ UV Index data available:", weatherData.current.uvi);
  }
  
  // Extract relevant data based on intent
  const data = extractRelevantWeatherData(weatherData, intent);
  
  // Format data for display in prompt
  const structuredData = formatWeatherDataForPrompt(data, intent);
  console.log("📊 Structured data sample:", structuredData.substring(0, 200) + "...");
  
  // Get formatted chat history
  let formattedHistory = "";
  if (chatHistory && chatHistory.length > 0) {
    formattedHistory = chatHistory.map(entry => 
      `${entry.role === 'user' ? 'Human' : 'Assistant'}: ${entry.content}`
    ).join("\n");
  }
  
  // Create the system prompt with the weather data
  const systemPrompt = createSystemPromptForIntent(intent, data);
  
  // Create the human message with all the weather context
  const userPrompt = `${formattedHistory ? formattedHistory + "\n\n" : ""}
I need information about the weather in ${location.city}, ${location.country}. My question is: "${question}"

${structuredData}`;

  try {
    console.log("Using LLM to analyze weather with identified intent:", intent);
    
    // Add timeout to axios request
    const apiResponse = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800  // Dynamic token allocation
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000'
        },
        // Add timeout configuration
        timeout: 60000 // 60 seconds timeout
      }
    );
    
    // Add error checking and logging to debug the response
    if (!apiResponse.data) {
      console.error("Empty response from OpenRouter API");
      return createFallbackAnswer(question, data, intent);
    }
    
    console.log("API Response structure:", JSON.stringify(apiResponse.data).substring(0, 300));
    
    // Check if the choices array exists and has at least one element
    if (!apiResponse.data.choices || !apiResponse.data.choices.length) {
      console.error("No choices in API response:", apiResponse.data);
      return createFallbackAnswer(question, data, intent);
    }
    
    const answer = apiResponse.data.choices[0].message.content;
    console.log("LLM response received:", answer.substring(0, 100) + "...");
    return answer;
  } catch (error) {
    // Improve error handling
    if (error.code === 'ECONNABORTED') {
      console.error("Request timed out");
      return "I apologize, but the request timed out. Please try again.";
    }
    
    if (error.response?.status === 504) {
      console.error("Gateway timeout");
      return "The server took too long to respond. Please try again.";
    }
    
    console.error("Error getting LLM response:", error.message);
    
    // If error contains response data, log it for debugging
    if (error.response) {
      console.error("API error details:", error.response.data);
    }
    
    return createFallbackAnswer(question, data, intent);
  }
}

// Create fallback answer when LLM fails
function createFallbackAnswer(question, data, intent) {
  // Create a simple fallback based on intent and available data
  if (intent === 'current_conditions') {
    return `Currently in ${data.location}, it's ${data.current.temperature}°F with ${data.current.conditions}. It feels like ${data.current.feelsLike}°F with ${data.current.humidity}% humidity and wind at ${data.current.wind.speed} mph.`;
  }
  
  if (intent === 'forecast') {
    let response = `The current temperature in ${data.location} is ${data.current.temperature}°F with ${data.current.conditions}.`;
    
    if (data.daily && data.daily.length > 0) {
      response += ` The forecast shows: ${data.daily[0].date}: High ${data.daily[0].tempHigh}°F, Low ${data.daily[0].tempLow}°F, ${data.daily[0].conditions}.`;
    }
    
    return response;
  }
  
  if (intent === 'clothing') {
    const temp = data.current.temperature;
    let clothing = "";
    
    if (temp > 85) {
      clothing = "light, breathable clothing like shorts and t-shirts";
    } else if (temp > 70) {
      clothing = "comfortable clothing like light pants or shorts and a t-shirt";
    } else if (temp > 55) {
      clothing = "layers such as a light jacket or sweater";
    } else if (temp > 40) {
      clothing = "a warm jacket, gloves, and a hat";
    } else {
      clothing = "a heavy winter coat, layers, gloves, and a warm hat";
    }
    
    if (data.current.conditions.includes("rain")) {
      clothing += " and bring an umbrella or raincoat";
    }
    
    if (data.uvIndex && data.uvIndex > 5) {
      clothing += ". Don't forget sunscreen and sunglasses as the UV index is high";
    }
    
    return `Based on the current weather in ${data.location} (${data.current.temperature}°F, ${data.current.conditions}), I recommend wearing ${clothing}.`;
  }
  
  // Generic fallback for other intents
  return `Currently in ${data.location}, it's ${data.current.temperature}°F with ${data.current.conditions}. I'm sorry, but I couldn't provide more specific information about your question.`;
}

// Helper function to get moon phase description
function getMoonPhaseDescription(phase) {
  if (phase === 0 || phase === 1) return "New Moon";
  if (phase < 0.25) return "Waxing Crescent";
  if (phase === 0.25) return "First Quarter";
  if (phase < 0.5) return "Waxing Gibbous";
  if (phase === 0.5) return "Full Moon";
  if (phase < 0.75) return "Waning Gibbous";
  if (phase === 0.75) return "Last Quarter";
  if (phase < 1) return "Waning Crescent";
  return "Unknown";
}

// Helper function to get AQI description
function getAQIDescription(aqi) {
  const levels = [
    "Good",
    "Moderate",
    "Unhealthy for Sensitive Groups",
    "Unhealthy",
    "Very Unhealthy",
    "Hazardous"
  ];
  
  // AQI is typically 1-5 in OpenWeatherMap
  if (aqi >= 1 && aqi <= 5) {
    return levels[aqi - 1];
  }
  
  // Handle standard US AQI values
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

// ... rest of your code ... 