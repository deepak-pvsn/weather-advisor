export async function isOllamaRunning() {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
    });
    
    if (response.ok) {
      const data = await response.json();
      // Check if phi2 model is available
      return data.models && data.models.some(model => model.name.includes('phi2'));
    }
    return false;
  } catch (error) {
    console.error('Error checking Ollama status:', error);
    return false;
  }
} 