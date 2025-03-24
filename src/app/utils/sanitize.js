/**
 * Sanitizes user input to prevent XSS attacks
 * @param {string} input - The user input to sanitize
 * @returns {string} - The sanitized input
 */
export function sanitizeInput(input) {
  if (!input) return '';
  
  // Convert to string if not already
  const str = String(input);
  
  // Replace potentially dangerous characters
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim();
}

/**
 * Validates location data to ensure it contains required fields
 * @param {Object} location - The location object to validate
 * @returns {boolean} - Whether the location is valid
 */
export function validateLocation(location) {
  if (!location) return false;
  
  // Check that required fields exist and are not empty
  return (
    location.city && 
    typeof location.city === 'string' &&
    location.lat !== undefined &&
    location.lng !== undefined
  );
} 