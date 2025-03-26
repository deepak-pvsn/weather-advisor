'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import './globals.css';

// This loading component will be used during server rendering
function Loading() {
  return <div className="min-h-screen bg-black"></div>;
}

// Export the main component directly without NoSSR or dynamic imports
export default function Page() {
  // State variables
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
  const [isMounted, setIsMounted] = useState(false);

  // Hydration fix: Only render content after component is mounted on client
  useEffect(() => {
    setIsMounted(true);
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
  function handleLocationInputChange(e) {
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
  }

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
        content: `Hi! I\'m your Weather Advisor. Ask me anything about weather or for advice based on current conditions.` 
      }
    ]);
    
    setWeatherSummary({
      message: `Hi! I\'m your Weather Advisor. Ask me anything about weather or for advice based on current conditions.`
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

  // First, add a function to format the chat messages with better styling
  const formatMessage = (content) => {
    // Early return if content is empty or undefined
    if (!content) return <p>No information available</p>;
    
    // Check if this is a weather or advice response
    const isInfoResponse = content.includes('°F') || 
                          content.includes('Temperature') || 
                          content.includes('weather') || 
                          content.includes('air quality') ||
                          content.includes('AQI') ||
                          content.includes('humidity');
    
    if (isInfoResponse) {
      // THOROUGH cleanup of all formatting characters that might appear
      content = content
        // Remove formatting characters
        .replace(/###/g, '')
        .replace(/---/g, '')
        .replace(/\*\*/g, '')
        .replace(/:\*\*/g, ':')
        .replace(/\*:/g, ':')
        
        // Remove emojis
        .replace(/\s+🌡️/g, ' ')
        .replace(/\s+🔥/g, ' ')
        .replace(/🥵/g, '')
        .replace(/🐕/g, '')
        .replace(/🐈/g, '')
        .replace(/📱/g, '')
        .replace(/👕/g, '')
        .replace(/💧/g, '')
        .replace(/🌀/g, '')
        .replace(/🌧️/g, '')
        .replace(/☀️/g, '')
        .replace(/⚠️/g, '')
        
        // The critical part - handle starred text like *This is bold*
        // Pattern to find all text between asterisks
        .replace(/\*([^*]+)\*/g, '$1');
      
      // Now separate the content into logical sections
      const sections = [];
      let currentSection = { title: null, content: [] };
      
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      
      lines.forEach((line) => {
        // Check if this is a header/section title
        if (line.match(/^[A-Z].*:/) || // Starts with capital and has colon
            line.includes('Air Quality') ||
            line.includes('AQI Overview') ||
            line.includes('Weather Alert') ||
            line.includes('If air quality')) {
          
          // If we already have content in the current section, push it to sections
          if (currentSection.title && currentSection.content.length > 0) {
            sections.push({ ...currentSection });
          }
          
          // Start a new section
          currentSection = {
            title: line,
            content: []
          };
        } else {
          // This is content for the current section
          currentSection.content.push(line);
        }
      });
      
      // Don't forget to add the last section
      if (currentSection.title && currentSection.content.length > 0) {
        sections.push({ ...currentSection });
      }
      
      // Now render all sections in a clean, unified container
      return (
        <div className="bg-white border border-blue-100 rounded-lg p-5">
          {sections.map((section, idx) => (
            <div key={idx} className="mb-6 last:mb-0">
              {/* Section title */}
              <h3 className="text-blue-600 font-bold text-lg border-b border-blue-100 pb-2 mb-3">
                {section.title}
              </h3>
              
              {/* Section content */}
              <div className="space-y-3 ml-1">
                {section.content.map((line, lineIdx) => {
                  // Check for subheadings (like "Key Drivers", "Seasonal Context", etc.)
                  if (line.includes('Key Drivers') || 
                      line.includes('Seasonal Context') || 
                      line.includes('What\'s Next') ||
                      line.match(/^[A-Z][a-z]+([ ][A-Z][a-z]+){1,3}:$/) || // Captures patterns like "Something Something:"
                      line.match(/^[A-Z][a-z]+ [A-Z][a-z]+:$/)) {  // Captures patterns like "Something Something:"
                    return (
                      <div key={lineIdx} className="mt-4 mb-2">
                        <h4 className="text-blue-800 font-semibold text-base bg-blue-50 py-1 px-2 rounded-md">{line}</h4>
                      </div>
                    );
                  }
                  
                  // Check for bullet points (lines starting with -)
                  if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
                    const bulletContent = line.replace(/^[\s-•]+/, '');
                    return (
                      <div key={lineIdx} className="flex items-start">
                        <span className="text-blue-500 mr-2 mt-1">•</span>
                        <span className="text-gray-700">{bulletContent}</span>
                      </div>
                    );
                  }
                  
                  // Check for numbered items (like "1. Item")
                  if (line.match(/^\d+\./)) {
                    const parts = line.split(/^(\d+\.\s*)/);
                    return (
                      <div key={lineIdx} className="flex items-start">
                        <span className="text-blue-600 font-medium mr-2">{parts[1]}</span>
                        <span className="text-gray-700">{parts[2] || ''}</span>
                      </div>
                    );
                  }
                  
                  // Special handling for colored AQI levels
                  if (line.includes('0-50') && line.includes('Good')) {
                    return (
                      <div key={lineIdx} className="flex items-center my-1">
                        <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                        <span className="text-gray-700">{line}</span>
                      </div>
                    );
                  }
                  
                  if (line.includes('51-100') && line.includes('Moderate')) {
                    return (
                      <div key={lineIdx} className="flex items-center my-1">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                        <span className="text-gray-700">{line}</span>
                      </div>
                    );
                  }
                  
                  if (line.includes('101-150') && line.includes('Unhealthy')) {
                    return (
                      <div key={lineIdx} className="flex items-center my-1">
                        <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
                        <span className="text-gray-700">{line}</span>
                      </div>
                    );
                  }
                  
                  if (line.includes('151+') && line.includes('Hazardous')) {
                    return (
                      <div key={lineIdx} className="flex items-center my-1">
                        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                        <span className="text-gray-700">{line}</span>
                      </div>
                    );
                  }
                  
                  // Regular paragraph
                  return <p key={lineIdx} className="text-gray-700">{line}</p>;
                })}
              </div>
            </div>
          ))}
          
          {/* If there are no sections, just display the content directly */}
          {sections.length === 0 && (
            <p className="text-gray-700">{content}</p>
          )}
        </div>
      );
    }
    
    // For non-weather responses (like general text)
    return (
      <div className="bg-white border border-blue-100 rounded-lg p-5">
        <div className="space-y-2">
          {content.split('\n')
            .filter(line => line.trim().length > 0)
            .map((line, i) => {
              // Remove all formatting characters including asterisks
              const cleanLine = line
                .replace(/###/g, '')
                .replace(/---/g, '')
                .replace(/\*([^*]+)\*/g, '$1');
              
              return <p key={i} className="text-gray-700">{cleanLine}</p>;
            })}
        </div>
      </div>
    );
  };

  // Show loading state until component is mounted on client
  if (!isMounted) {
    return <Loading />;
  }

  // Welcome screen when no location is selected (matches first image)
  if (!location) {
    return (
      <div className="flex min-h-screen bg-gradient-to-b from-blue-500 to-blue-700 items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 transform transition-all hover:scale-[1.01]">
          {/* Logo and Header */}
          <div className="flex flex-col items-center mb-4">
            <div className="bg-blue-600 p-4 rounded-full mb-4 shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-center text-blue-700 mb-1">
              Weather Advisor
            </h1>
            <div className="w-16 h-1 bg-blue-600 rounded-full mb-2"></div>
          </div>
          
          {/* Tagline - Enhanced colors and reduced spacing */}
          <div className="flex justify-center items-center w-full mb-8">
            <div className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full flex items-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a1.993 1.993 0 00-.114-.035l1.063-1.063A3 3 0 009 8.172z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold">AI Powered Weather Assistant</span>
            </div>
          </div>
          
          {/* Location Prompt - Improved color and styling */}
          <h2 className="text-2xl text-gray-800 text-center mb-6 font-medium">
            Where are you located?
          </h2>
          
          {/* Location Input with Icon */}
          <div className="relative w-full mb-6">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={locationInput}
              onChange={handleLocationInputChange}
              onKeyPress={handleKeyPress}
              placeholder="e.g., New York, London, Tokyo"
              className="w-full p-4 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-gray-700"
              autoComplete="off"
              style={{ color: '#374151' }}
            />
            
            {/* Location suggestions dropdown with improved styling */}
            {locationSuggestions.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-2 overflow-hidden">
                {locationSuggestions.map((suggestion, index) => (
                  <div 
                    key={index}
                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex items-center"
                    onClick={() => handleSelectSuggestion(suggestion)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span className="text-gray-700">{suggestion.formatted}</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Loading indicator with animation */}
            {isLoadingSuggestions && locationInput.length >= 3 && locationSuggestions.length === 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-2 p-4">
                <div className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 text-blue-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-gray-600">Finding locations...</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Get Started Button with Animation */}
          <button
            onClick={handleGetStarted}
            disabled={!locationInput.trim()}
            className={`w-full p-4 rounded-lg flex items-center justify-center transition-all duration-300 transform ${
              !locationInput.trim() 
                ? 'bg-blue-300 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5'
            } text-white font-medium`}
          >
            <span>Get Started</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          
          {/* Info Text with Icon */}
          <div className="mt-6 bg-blue-50 rounded-lg p-3 flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-blue-800 text-sm">
              This information is stored locally on your device and helps us provide accurate weather advice for your location.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main chat interface once location is selected
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Fixed header with visible icon and buttons */}
      <header className="bg-blue-500 text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          {/* Improved cloud icon with stronger contrast */}
          <div className="bg-white p-1.5 rounded-full mr-3 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-white">Weather Advisor</h1>
            {/* Add location display */}
            <span className="text-xs text-blue-100 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {location.city}, {location.country}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Fixed buttons with contrasting background */}
          <button 
            onClick={clearChat}
            className="bg-white text-blue-600 hover:bg-blue-50 px-4 py-1.5 text-sm font-medium rounded-full shadow-sm transition-colors cursor-pointer"
          >
            Clear Chat
          </button>
          
          <button 
            onClick={changeLocation}
            className="bg-white text-blue-600 hover:bg-blue-50 px-4 py-1.5 text-sm font-medium rounded-full shadow-sm transition-colors cursor-pointer"
          >
            Change Location
          </button>
        </div>
      </header>

      {/* Chat container */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-5">
          {/* Enhanced weather summary card */}
          {weatherSummary && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-start">
                <div className="bg-blue-600 rounded-lg p-3 mr-4 text-white shadow">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-blue-800 font-bold mb-2 text-lg">Welcome</h3>
                  <p className="text-gray-700 leading-relaxed">{weatherSummary.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced chat messages with better formatting */}
          {chatHistory.map((message, index) => (
            message.role !== 'system' && (
              <div 
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in-up`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div 
                  className={`
                    p-4 max-w-[80%] shadow-md
                    ${message.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tl-xl rounded-tr-xl rounded-bl-none rounded-br-xl' 
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none rounded-tr-xl rounded-bl-xl rounded-br-xl'
                    }
                  `}
                >
                  {message.role === 'user' ? (
                    <div>
                      <div className="text-white font-medium mb-1">{message.content}</div>
                      <div className="text-xs text-blue-200 text-right">
                        {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  ) : (
                    formatMessage(message.content)
                  )}
                </div>
              </div>
            )
          ))}

          {/* Enhanced loading indicator */}
          {isLoading && (
            <div className="flex justify-start mb-4 animate-fade-in">
              <div className="bg-white border border-gray-200 rounded-tl-none rounded-tr-xl rounded-bl-xl rounded-br-xl p-4 shadow-md max-w-[80%]">
                <div className="flex space-x-2 items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced suggestion section with improved spacing */}
      <div className="bg-blue-50 border-t border-blue-100 py-4">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">
            Suggested Questions
          </p>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 pt-1">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuestion(q);
                  setTimeout(() => sendQuestion(), 100);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm whitespace-nowrap shadow transition-all duration-200 hover:shadow-md cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced input area */}
      <div className="bg-gray-50 border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all duration-300">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about weather or get advice..."
              className="flex-1 py-3 px-4 bg-white border-none focus:outline-none text-gray-700"
            />
            <button
              onClick={sendQuestion}
              disabled={isLoading || !question.trim()}
              className={`px-4 flex items-center justify-center ${
                isLoading || !question.trim() 
                  ? 'bg-blue-300 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
              } text-white transition-colors duration-200`}
              aria-label="Send message"
            >
              {/* Replaced with arrow pointing right */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 