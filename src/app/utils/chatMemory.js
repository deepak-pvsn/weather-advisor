// Simple in-memory chat memory store without LangChain dependencies
const memoryStore = new Map();

// Get history for a session
export function getChatHistory(sessionId) {
  if (!memoryStore.has(sessionId)) {
    memoryStore.set(sessionId, []);
  }
  return memoryStore.get(sessionId);
}

// Save to memory
export function saveToMemory(sessionId, question, answer) {
  const history = getChatHistory(sessionId);
  history.push(
    { type: 'human', content: question },
    { type: 'ai', content: answer }
  );
  
  // Limit history size to prevent memory issues
  if (history.length > 20) {
    history.splice(0, 2); // Remove oldest Q&A pair
  }
  
  return history;
}

// Clear memory for a session
export function clearMemory(sessionId) {
  memoryStore.delete(sessionId);
} 