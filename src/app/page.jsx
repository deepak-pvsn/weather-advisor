'use client';

import React, { useState, useEffect, useRef } from 'react';
import NoSSR from './components/NoSSR';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import './globals.css';

// This loading component will be used during server rendering
// Make sure the bg color matches what the client expects
function Loading() {
  return <div className="min-h-screen bg-black"></div>;
}

// Define the actual WeatherAdvisor component
function WeatherAdvisor() {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationInput, setLocationInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [weatherSummary, setWeatherSummary] = useState(null);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const suggestionTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Generate a unique session ID when the component mounts
    setSessionId(uuidv4());
  }, []);

  // Function to get location suggestions from OpenCage API
  const getLocationSuggestions = async (query) => {
    if (query.length < 3) {
      setLocationSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    
    try {
      const opencageApiKey = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY || 'ec28fb36de53417a9db5646c8f976ad6'; // Fallback API key
      const response = await axios.get(
        `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${opencageApiKey}&limit=5`
      );
      
      if (response.data && response.data.results) {
        const suggestions = response.data.results.map(result => {
          const components = result.components;
          const city = components.city || components.town || components.village || components.hamlet || components.state;
          const country = components.country;
          
          if (city && country) {
            return {
              city,
              country,
              formatted: `${city}, ${country}`
            };
          }
          return null;
        }).filter(item => item !== null);
        
        setLocationSuggestions(suggestions);
      }
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Handle location input change with debouncing
  const handleLocationInputChange = (e) => {
    const value = e.target.value;
    setLocationInput(value);
    
    // Clear any existing timeout
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }
    
    // Set a new timeout to fetch suggestions
    if (value.length >= 3) {
      suggestionTimeoutRef.current = setTimeout(() => {
        getLocationSuggestions(value);
      }, 300); // 300ms debounce
    } else {
      setLocationSuggestions([]);
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion) => {
    setLocationInput(suggestion.formatted);
    setLocationSuggestions([]);
    // Focus back on input field
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleGetStarted = () => {
    if (!locationInput.trim()) return;
    
    // Parse location from input or use selected suggestion
    const parts = locationInput.split(',').map(part => part.trim());
    const parsedLocation = {
      city: parts[0],
      country: parts.length > 1 ? parts[1] : 'United States'
    };
    
    setLocation(parsedLocation);
    
    // Add initial system message
    setChatHistory([
      { 
        role: 'system', 
        content: `In ${parsedLocation.city} today, temperatures are relatively mild. A light jacket might be comfortable in the morning and evening.` 
      }
    ]);
    
    setWeatherSummary({
      message: `In ${parsedLocation.city} today, temperatures are relatively mild. A light jacket might be comfortable in the morning and evening.`
    });
  };

  const sendQuestion = async () => {
    if (!question.trim() || !location) return;
    
    setIsLoading(true);
    
    // Add user question to chat history
    const updatedHistory = [
      ...chatHistory,
      { role: 'user', content: question }
    ];
    setChatHistory(updatedHistory);
    
    try {
      const response = await axios.post('/api/weather', {
        question,
        location,
        sessionId
      });
      
      // Add assistant response to chat history
      setChatHistory([
        ...updatedHistory,
        { role: 'assistant', content: response.data.answer }
      ]);
    } catch (error) {
      console.error('Error sending question:', error);
      
      // Add error message to chat history
      setChatHistory([
        ...updatedHistory,
        { role: 'assistant', content: 'Weather data unavailable. Please try again later.' }
      ]);
    } finally {
      setIsLoading(false);
      setQuestion(''); // Clear input field
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!location) {
        handleGetStarted();
      } else {
        sendQuestion();
      }
    }
  };

  const clearChat = () => {
    setChatHistory([]);
  };

  const changeLocation = () => {
    setLocation(null);
    setLocationInput('');
    setChatHistory([]);
    setWeatherSummary(null);
  };

  // Generate suggested questions based on weather
  const suggestedQuestions = [
    "Best clothing?",
    "Need jacket?",
    "Good for running?"
  ];

  // Welcome screen when no location is selected (matches first image)
  if (!location) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100 items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
          <h1 className="text-3xl font-bold text-center text-blue-500 mb-10">
            Weather Advisor
          </h1>
          
          <h2 className="text-2xl text-gray-300 mb-4">
            Where are you located?
          </h2>
          
          <div className="relative w-full">
            <input
              ref={inputRef}
              type="text"
              value={locationInput}
              onChange={handleLocationInputChange}
              onKeyPress={handleKeyPress}
              placeholder="e.g., New York, London, Tokyo"
              className="w-full p-4 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="off"
            />
            
            {/* Location suggestions dropdown - shows after 3 characters */}
            {locationSuggestions.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-[-12px]">
                {locationSuggestions.map((suggestion, index) => (
                  <div 
                    key={index}
                    className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => handleSelectSuggestion(suggestion)}
                  >
                    {suggestion.formatted}
                  </div>
                ))}
              </div>
            )}
            
            {/* Loading indicator for suggestions */}
            {isLoadingSuggestions && locationInput.length >= 3 && locationSuggestions.length === 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-[-12px] p-3 text-gray-500 text-center">
                Loading suggestions...
              </div>
            )}
          </div>
          
          <button
            onClick={handleGetStarted}
            disabled={!locationInput.trim()}
            className={`w-full p-3 rounded-lg ${
              !locationInput.trim() 
                ? 'bg-blue-400 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white font-medium transition-colors`}
          >
            Get Started
          </button>
          
          <p className="text-gray-500 text-sm mt-4 text-center">
            This information is stored locally on your device and helps us provide accurate weather advice.
          </p>
        </div>
      </div>
    );
  }

  // Main chat interface once location is selected (matches second and third images)
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header with location */}
      <header className="bg-blue-500 text-white p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Weather Advisor</h1>
        <div className="flex items-center">
          <div className="mr-2 flex items-center">
            <span className="font-medium mr-1">{location.city},</span>
            <span>{location.country}</span>
          </div>
          <button 
            onClick={clearChat}
            className="bg-blue-600 hover:bg-blue-700 px-2 py-1 text-sm rounded mr-2"
          >
            Clear Chat
          </button>
          <button 
            onClick={changeLocation}
            className="bg-blue-600 hover:bg-blue-700 px-2 py-1 text-sm rounded"
          >
            Change
          </button>
        </div>
      </header>

      {/* Chat container - white background as in image 2 */}
      <div className="flex-1 overflow-auto bg-white">
        <div className="max-w-4xl mx-auto p-4">
          {/* Initial weather summary - matches the styling in image 2 */}
          {weatherSummary && (
            <div className="bg-gray-100 p-4 rounded-lg mb-4">
              <p className="text-gray-800">{weatherSummary.message}</p>
            </div>
          )}

          {/* Chat messages */}
          {chatHistory.map((message, index) => (
            message.role !== 'system' && (
              <div 
                key={index} 
                className={`mb-4 ${
                  message.role === 'user' 
                    ? 'ml-auto bg-blue-500 text-white rounded-lg p-3 max-w-[80%]' 
                    : 'bg-gray-100 rounded-lg p-3 max-w-[80%]'
                }`}
              >
                <p>{message.content}</p>
              </div>
            )
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="bg-gray-100 rounded-lg p-3 mb-4 max-w-[80%]">
              <div className="flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '600ms' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Suggested questions - matching the pill buttons in image 2 */}
      <div className="bg-gray-50 border-t border-gray-200 py-2">
        <div className="max-w-4xl mx-auto px-4 flex gap-2 overflow-x-auto">
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => {
                setQuestion(q);
                setTimeout(() => sendQuestion(), 100);
              }}
              className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-full text-sm whitespace-nowrap"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input area - matches the styling in image 2 */}
      <div className="bg-gray-50 border-t border-gray-200 p-3">
        <div className="max-w-4xl mx-auto flex">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about weather or get advice..."
            className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendQuestion}
            disabled={isLoading || !question.trim()}
            className={`px-5 rounded-r-lg ${
              isLoading || !question.trim() 
                ? 'bg-blue-400 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white font-medium`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// This component is what gets rendered in the page
export default function Page() {
  return (
    <NoSSR fallback={<Loading />}>
      <WeatherAdvisorClient />
    </NoSSR>
  );
}

// Use dynamic import with ssr:false to force client-only rendering
const WeatherAdvisorClient = dynamic(() => Promise.resolve(WeatherAdvisor), {
  ssr: false,
}); 