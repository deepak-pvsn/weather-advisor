export function ConnectionError({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center p-4 bg-red-50 border border-red-100 rounded-lg my-4">
      <svg className="w-12 h-12 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <h3 className="text-lg font-medium text-red-800">Connection Error</h3>
      <p className="text-sm text-red-600 text-center mt-1 mb-3">
        Unable to connect to weather service. Check your internet connection and try again.
      </p>
      <button 
        onClick={onRetry}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

export function LocationError({ onChangeLocation }) {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4 rounded shadow-sm">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700">
            We're having trouble with your location information.
          </p>
          <button 
            onClick={onChangeLocation}
            className="mt-2 text-sm font-medium text-yellow-700 hover:text-yellow-600 underline"
          >
            Update location
          </button>
        </div>
      </div>
    </div>
  );
}

export function OfflineMode() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center">
      <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <p className="text-sm text-blue-700">
        Running in offline mode. Responses are based on general weather patterns.
      </p>
    </div>
  );
} 