'use client';

import { useState, useEffect } from 'react';

export default function TestGeocode() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('London');
  const [manualKey, setManualKey] = useState('');
  const [useManualKey, setUseManualKey] = useState(false);

  // Test API using the server route
  const testServerApi = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-geocode');
      const data = await response.json();
      setResults(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  // Direct test to the API
  const testDirectApi = async () => {
    setLoading(true);
    try {
      const key = useManualKey ? manualKey : process.env.NEXT_PUBLIC_OPENCAGE_API_KEY;
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${query}&key=${key}&limit=2`
      );
      const data = await response.json();
      setResults({
        success: response.ok,
        status: response.status,
        apiKeyExists: !!key,
        keyStartsWith: key ? key.substring(0, 4) + '...' : 'none',
        responseData: data
      });
      setError(null);
    } catch (err) {
      setError(err.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testServerApi();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">OpenCage API Test</h1>
      
      <div className="mb-6 p-4 bg-gray-100 rounded-lg border border-gray-200">
        <h2 className="text-lg font-medium mb-2 text-gray-900">Server Test</h2>
        <button 
          onClick={testServerApi}
          className="bg-blue-600 text-white px-4 py-2 rounded mr-2 hover:bg-blue-700"
        >
          Test with Server API
        </button>
        
        <h2 className="text-lg font-medium mt-4 mb-2 text-gray-900">Direct API Test</h2>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search query"
            className="border p-2 rounded flex-grow text-gray-900"
          />
          <button 
            onClick={testDirectApi}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Test Direct API
          </button>
        </div>
        
        <div className="mt-4">
          <label className="flex items-center mb-2 text-gray-900">
            <input
              type="checkbox"
              checked={useManualKey}
              onChange={() => setUseManualKey(!useManualKey)}
              className="mr-2"
            />
            Use manual API key
          </label>
          
          {useManualKey && (
            <input
              type="text"
              value={manualKey}
              onChange={(e) => setManualKey(e.target.value)}
              placeholder="Enter OpenCage API key"
              className="border p-2 rounded w-full mb-2 text-gray-900"
            />
          )}
        </div>
      </div>
      
      {loading && <p className="text-blue-600">Loading...</p>}
      
      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg mb-4 border border-red-200">
          <h3 className="font-bold">Error:</h3>
          <p>{error}</p>
        </div>
      )}
      
      {results && (
        <div className="border rounded-lg p-4 border-gray-300">
          <h3 className="font-bold mb-2 text-gray-900">Results:</h3>
          <div className="bg-gray-100 p-4 rounded overflow-auto max-h-96 border border-gray-200">
            <pre className="text-gray-800">{JSON.stringify(results, null, 2)}</pre>
          </div>
        </div>
      )}
      
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 text-blue-800">
        <h3 className="font-medium mb-2">Environment Variables Check:</h3>
        <p>NEXT_PUBLIC_OPENCAGE_API_KEY: {process.env.NEXT_PUBLIC_OPENCAGE_API_KEY ? 'Exists (starts with ' + process.env.NEXT_PUBLIC_OPENCAGE_API_KEY.substring(0, 3) + '...)' : 'Not found'}</p>
      </div>
    </div>
  );
} 