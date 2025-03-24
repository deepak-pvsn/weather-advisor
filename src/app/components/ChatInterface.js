import '../weather-advisor.css';
import { useState, useEffect, useRef } from 'react';

// Add this style block at the top of your file
// const styles = {
//   weatherMessage: `
//     .weather-message strong {
//       font-weight: 600;
//       color: #333;
//     }
//     .weather-message br + strong,
//     .weather-message br + br + strong {
//       display: inline-block;
//       margin-top: 0.5rem;
//       font-weight: 700;
//       color: #1e40af;
//     }
//     .weather-message {
//       line-height: 1.5;
//     }
//   `
// };

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

    const currentTypingMessage = messages[messages.length - 1];
    
    if (typingIndex < currentTypingMessage.content.length) {
      // Determine if we're typing plain text or HTML
      const isHTML = currentTypingMessage.content.includes('<');
      
      if (isHTML) {
        // For HTML content, increment more characters at once for tags
        let newIndex = typingIndex;
        let inTag = false;
        
        // Look ahead from current position to find tag boundaries
        for (let i = typingIndex; i < Math.min(typingIndex + 10, currentTypingMessage.content.length); i++) {
          newIndex = i;
          const char = currentTypingMessage.content[i];
          
          if (char === '<') inTag = true;
          if (char === '>') {
            inTag = false;
            newIndex = i + 1; // Include the closing bracket
            break;
          }
          
          // If not in a tag, only increment by a few characters at most
          if (!inTag && i >= typingIndex + 3) break;
        }
        
        const timeout = setTimeout(() => {
          setTypingText(currentTypingMessage.content.substring(0, newIndex));
          setTypingIndex(newIndex);
        }, 15);
        
        return () => clearTimeout(timeout);
      } else {
        // Regular character-by-character typing for plain text
        const timeout = setTimeout(() => {
          setTypingText(currentTypingMessage.content.substring(0, typingIndex + 1));
          setTypingIndex(typingIndex + 1);
        }, 15);
        
        return () => clearTimeout(timeout);
      }
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
      
      // Format the LLM response for better display
      const formattedContent = formatLLMResponse(data.answer || 'Sorry, I couldn\'t get weather information at this time.');
      
      // Add the assistant's response to the chat
      const assistantMessage = { 
        role: 'assistant', 
        content: formattedContent,
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

  // Function to format LLM responses for better display
  const formatLLMResponse = (text) => {
    if (!text) return '';
    
    // Convert the text to plain HTML with minimal formatting
    // First, normalize line breaks
    text = text.replace(/\r\n/g, '\n');
    
    // Create a cleaner version of the text
    let cleanText = '';
    
    // Split by double newlines (paragraphs)
    const paragraphs = text.split(/\n\n+/);
    
    paragraphs.forEach((paragraph) => {
      if (!paragraph.trim()) return;
      
      // Check if this paragraph is a title/header (often ends with ":")
      const isTitleLine = /^[A-Z][^:.!?]*:/.test(paragraph.trim());
      
      if (isTitleLine) {
        // It's a title/header - make it bold with spacing
        cleanText += `<div style="font-weight: 700; color: #1e40af; margin-top: 12px; margin-bottom: 4px;">${paragraph}</div>`;
      } else if (paragraph.includes('*') || paragraph.includes('-') || /^\d+\./.test(paragraph.trim())) {
        // It's a list - handle various list formats
        
        // Handle bullet points with consistent formatting
        let listHTML = paragraph
          .replace(/\n\* /g, '<br>• ')
          .replace(/\n- /g, '<br>• ')
          .replace(/^\* /gm, '• ')
          .replace(/^- /gm, '• ');
        
        // Handle numbered lists
        listHTML = listHTML.replace(/(\d+\.) /g, '<span style="font-weight: 600;">$1</span> ');
        
        cleanText += `<div style="margin-bottom: 8px;">${listHTML}</div>`;
      } else {
        // Regular paragraph
        const processedParagraph = paragraph
          .replace(/\n/g, '<br>')
          .replace(/\*\*(.*?)\*\*/g, '<span style="font-weight: 700;">$1</span>');
        
        cleanText += `<div style="margin-bottom: 8px;">${processedParagraph}</div>`;
      }
    });
    
    // Make further adjustments for nested structures
    cleanText = cleanText
      // Format sections like "Temperature:" with special styling
      .replace(/([A-Z][a-z]+):/g, '<span style="font-weight: 700; color: #1e40af;">$1:</span>')
      // Convert remaining newlines to breaks
      .replace(/\n/g, '<br>');
    
    // Wrap everything in a container with specific styling that overrides globals
    return `<div style="font-family: Arial, sans-serif; color: #333333; line-height: 1.6;">${cleanText}</div>`;
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

  // Add this function to your component
  const handleSuggestionClick = (suggestion) => {
    if (loading) return;
    
    setInput(suggestion);
    // Automatically send after a short delay
    setTimeout(() => {
      const event = { preventDefault: () => {} };
      handleSendMessage(event);
    }, 100);
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div>
          <h2 className="header-title">Weather Advisor</h2>
          {locationData && (
            <div className="header-location">
              <span className="mr-1">📍</span>
              <span>{locationData.city}, {locationData.country}</span>
            </div>
          )}
        </div>
        
        <div className="header-controls">
          <button 
            onClick={handleClearConversation}
            className="header-button"
            title="Clear conversation"
          >
            Clear Chat
          </button>
          
          <button
            className="header-button"
            onClick={() => {/* Handle location change */}}
          >
            Change
          </button>
        </div>
      </div>
      
      <div className="messages-container">
        {messages.map((message, index) => {
          if (index === 0 && message.role === 'assistant' && !message.content.includes('Hi!')) {
            // Initial weather summary
            return (
              <div key={index} className="weather-summary">
                {message.content}
              </div>
            );
          }
          
          if (message.role === 'user') {
            return (
              <div key={index} className="user-message-container">
                <div className="user-message">
                  {message.content}
                </div>
              </div>
            );
          }
          
          return (
            <div key={index} className="assistant-message-container">
              <div className="assistant-message">
                {isTyping && index === messages.length - 1 ? (
                  <div dangerouslySetInnerHTML={{ __html: typingText }} />
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: message.content }} />
                )}
              </div>
            </div>
          );
        })}
        
        {loading && (
          <div className="assistant-message-container">
            <div className="assistant-message">
              <div className="loading-dots">
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messageEndRef} />
      </div>
      
      <div className="suggestion-pills">
        <div className="suggestion-pill" onClick={() => handleSuggestionClick("Will I need my sunglasses today?")}>
          Need sunglasses?
        </div>
        <div className="suggestion-pill" onClick={() => handleSuggestionClick("Is it safe for hiking today?")}>
          Safe for hiking?
        </div>
        <div className="suggestion-pill" onClick={() => handleSuggestionClick("What should I wear today?")}>
          What to wear?
        </div>
      </div>
      
      <div className="input-container">
        <form onSubmit={handleSendMessage}>
          <div className="input-wrapper">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about weather or get advice..."
              className="chat-input"
              disabled={loading}
            />
            <button
              type="submit"
              className="send-button"
              disabled={loading || !input.trim()}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}