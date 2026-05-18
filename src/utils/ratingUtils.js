/**
 * Get the CSS class name for a rating color based on the rating value
 * @param {number|string} rating - The rating value
 * @returns {string|null} - The CSS class name ('low', 'medium', 'high') or null
 */
export const getRatingColor = (rating) => {
  if (!rating) return null
  const numRating = parseFloat(rating)
  if (isNaN(numRating)) return null

  if (numRating >= 0.1 && numRating <= 5.0) {
    return 'low'
  }
  if (numRating >= 5.1 && numRating <= 7.0) {
    return 'medium'
  }
  if (numRating >= 7.1 && numRating <= 10.0) {
    return 'high'
  }
  return null
}

/**
 * Rating color definitions for CSS
 */
export const RATING_COLORS = {
  low: '#ff6b6b',
  medium: '#ffd93d',
  high: '#51cf66'
}
