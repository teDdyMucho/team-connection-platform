
/**
 * Formats a time difference in milliseconds to a string in the format "HH:MM:SS"
 * @param diff Time difference in milliseconds
 * @returns Formatted time string
 */
export const formatTime = (diff: number): string => {
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return (hours < 10 ? "0" + hours : hours) + ":" +
         (minutes < 10 ? "0" + minutes : minutes) + ":" +
         (seconds < 10 ? "0" + seconds : seconds);
};
