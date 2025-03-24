// Create reusable loading indicators
export function ThreeDotsLoader() {
  return (
    <div className="flex space-x-2 p-3 bg-gray-200 rounded-lg inline-flex">
      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75"></div>
      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></div>
    </div>
  );
}

export function PulseLoader() {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="w-8 h-8 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
    </div>
  );
}

export function WeatherIconLoader() {
  return (
    <div className="flex items-center justify-center py-3">
      <div className="relative w-12 h-12">
        {/* Sun */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 bg-yellow-400 rounded-full animate-pulse"></div>
        </div>
        {/* Cloud */}
        <div className="absolute bottom-0 right-0">
          <div className="w-8 h-5 bg-gray-300 rounded-full animate-bounce delay-300"></div>
        </div>
      </div>
    </div>
  );
} 