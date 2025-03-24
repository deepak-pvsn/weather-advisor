import { useState, useEffect, useRef } from 'react';

export default function ChatInterface({ locationData }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your Weather Advisor. Ask me anything about weather or for advice based on current conditions.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [typingIndex, setTypingIndex] = useState(0);
  const [sessionId, setSessionId] = useState('');
  const messageEndRef = useRef(null);

  // Initialize session ID on component mount using a simpler approach
  useEffect(() => {
    // Check if we have a stored session ID
    let storedSessionId = localStorage.getItem('weatherAdvisorSessionId');
    if (!storedSessionId) {
      // Generate a simple random ID instead of using uuid
      storedSessionId = 'session-' + Math.random().toString(36).substring(2, 15) + 
                        Math.random().toString(36).substring(2, 15);
      localStorage.setItem('weatherAdvisorSessionId', storedSessionId);
    }
    setSessionId(storedSessionId);
  }, []);

  // Scroll to bottom of messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingText]);

  // Simulate typing effect for assistant messages
  useEffect(() => {
    if (!isTyping) return;

    // Get the current message being typed
    const currentTypingMessage = messages[messages.length - 1];
    
    if (typingIndex < currentTypingMessage.content.length) {
      // Continue typing the current message
      const timeout = setTimeout(() => {
        setTypingText(currentTypingMessage.content.substring(0, typingIndex + 1));
        setTypingIndex(typingIndex + 1);
      }, 15); // Adjust speed as needed
      
      return () => clearTimeout(timeout);
    } else {
      // Typing complete
      setIsTyping(false);
      setTypingText('');
      setTypingIndex(0);
    }
  }, [isTyping, typingIndex, messages]);

  // Handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    // Check if location is available
    if (!locationData) {
      const newUserMessage = { role: 'user', content: input };
      const locationErrorMessage = { 
        role: 'assistant', 
        content: 'I need to know your location to provide accurate weather advice. Please set your location first.' 
      };
      
      setMessages([...messages, newUserMessage, locationErrorMessage]);
      setInput('');
      return;
    }
    
    // Add user message to the chat
    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    
    // Clear input and show loading state
    setInput('');
    setLoading(true);
    
    try {
      // Call the weather API with session ID for memory
      const response = await fetch('/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: input,
          location: locationData,
          sessionId: sessionId
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add the assistant's response to the chat
      const assistantMessage = { 
        role: 'assistant', 
        content: data.answer || 'Sorry, I couldn\'t get weather information at this time.',
        sources: data.sources || []
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Start typing effect
      setIsTyping(true);
      
    } catch (error) {
      console.error('Failed to get response:', error);
      
      // Add error message
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I had trouble connecting to the weather service. Please try again in a moment.' 
      }]);
      
      // Start typing effect for error message
      setIsTyping(true);
      
    } finally {
      setLoading(false);
    }
  };

  // Handle clearing the conversation
  const handleClearConversation = async () => {
    try {
      // Clear conversation memory
      await fetch('/api/clear-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      // Reset messages to just the welcome message
      setMessages([
        { role: 'assistant', content: 'Hi! I\'m your Weather Advisor. Ask me anything about weather or for advice based on current conditions.' }
      ]);
    } catch (error) {
      console.error('Failed to clear conversation:', error);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-md w-full mx-auto bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Weather Advisor</h2>
          {locationData && (
            <div className="text-sm flex items-center mt-1">
              <span className="mr-1">📍</span>
              <span>{locationData.city}, {locationData.country}</span>
            </div>
          )}
        </div>
        
        <button 
          onClick={handleClearConversation}
          className="text-xs bg-blue-700 hover:bg-blue-800 px-2 py-1 rounded"
          title="Clear conversation"
        >
          Clear Chat
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-500 text-white rounded-br-none' 
                  : 'bg-gray-200 text-gray-800 rounded-bl-none'
              }`}
            >
              {isTyping && index === messages.length - 1 && message.role === 'assistant' 
                ? typingText 
                : message.content}
              
              {message.sources && message.sources.length > 0 && (
                <div className="mt-2 text-xs italic opacity-70">
                  Source: {message.sources.join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-800 p-3 rounded-lg rounded-bl-none">
              <div className="flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messageEndRef} />
      </div>
      
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about weather or get advice..."
            className="flex-1 p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-r-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}