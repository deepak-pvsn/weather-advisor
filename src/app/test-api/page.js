'use client';

import { useState } from 'react';

export default function TestAPI() {
  const [query, setQuery] = useState('Saint Louis, MO');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const testLocationAPI = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const response = await fetch(`/api/locations?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      setResults(data);
      
      if (!response.ok) {
        setError(`API returned ${response.status}: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">API Test Page</h1>
      
      <div className="mb-8 p-4 bg-white rounded shadow">
        <h2 className="text-xl font-bold mb-2">Test Location API</h2>
        <div className="flex mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 p-2 border rounded-l"
            placeholder="Enter location to search"
          />
          <button
            onClick={testLocationAPI}
            disabled={loading}
            className="bg-blue-500 text-white p-2 rounded-r hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : 'Test'}
          </button>
        </div>
        
        {error && (
          <div className="p-3 bg-red-100 text-red-800 rounded mb-4">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        {results && (
          <div>
            <h3 className="font-bold mb-2">Results:</h3>
            <div className="p-3 bg-gray-100 rounded overflow-auto max-h-96">
              <pre className="text-sm">{JSON.stringify(results, null, 2)}</pre>
            </div>
            
            {results.results && results.results.length > 0 ? (
              <div className="mt-4">
                <h3 className="font-bold mb-2">Found {results.results.length} locations:</h3>
                <ul className="list-disc pl-5">
                  {results.results.map((result, index) => (
                    <li key={index} className="mb-2">
                      <div className="font-medium">{result.formatted}</div>
                      <div className="text-sm text-gray-600">
                        Coordinates: {result.geometry.lat}, {result.geometry.lng}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-4 text-red-500">No locations found</div>
            )}
          </div>
        )}
        
        <div className="mt-4 p-3 bg-blue-50 text-sm">
          <strong>Tips for testing:</strong>
          <ul className="list-disc pl-5 mt-2">
            <li>Try adding a country or state: "Saint Louis, MO, USA"</li>
            <li>Use the full state name: "Saint Louis, Missouri"</li>
            <li>Try alternative spellings: "St. Louis" or "St Louis"</li>
            <li>Add "city" to the query: "Saint Louis City"</li>
          </ul>
        </div>
      </div>
      
      <div className="mt-4 p-4 bg-gray-100 rounded shadow text-sm">
        <h3 className="font-bold mb-2">Debugging Information:</h3>
        <div>
          <p><strong>API Key Present:</strong> {process.env.NEXT_PUBLIC_OPENCAGE_API_KEY ? 'Yes' : 'No'}</p>
          <p><strong>API Key Length:</strong> {process.env.NEXT_PUBLIC_OPENCAGE_API_KEY?.length || 0} characters</p>
        </div>
      </div>
    </div>
  );
} 