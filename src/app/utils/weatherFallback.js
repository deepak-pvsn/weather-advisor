// Fallback responses when the API is unavailable

export const getFallbackResponse = (question, location) => {
  question = question.toLowerCase();
  
  if (question.includes('umbrella') || question.includes('rain')) {
    return `For ${location}, I'd suggest checking the local forecast. If in doubt, bringing an umbrella is always a safe choice.`;
  }
  
  if (question.includes('jacket') || question.includes('coat')) {
    return `For ${location}, layering is usually a good approach. A light jacket might be useful for the morning and evening hours.`;
  }
  
  if (question.includes('sun') || question.includes('sunscreen')) {
    return `In ${location}, sunscreen is recommended for extended outdoor activities, even on cloudy days.`;
  }
  
  if (question.includes('run') || question.includes('exercise')) {
    return `For ${location}, early morning or evening is typically best for outdoor exercise to avoid peak temperatures and UV exposure.`;
  }
  
  return `The weather in ${location} is generally pleasant this time of year. Check a local weather app for the most current forecast.`;
}; 