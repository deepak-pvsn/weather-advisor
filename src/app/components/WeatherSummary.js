export default function WeatherSummary({ location, data, onChangeLocation }) {
    // Using mock data for now
    const mockData = data || {
      temperature: 12,
      conditions: "Cloudy",
      description: "overcast clouds"
    };
  
    return (
      <div className="bg-blue-500 text-white p-4 rounded-t-lg flex justify-between items-center mb-1">
        <div>
          <h2 className="font-bold text-xl">{location}</h2>
          <p className="text-sm">{mockData.temperature}°C, {mockData.conditions}</p>
        </div>
        <button 
          onClick={onChangeLocation}
          className="text-sm bg-blue-600 px-3 py-1 rounded hover:bg-blue-700"
        >
          Change
        </button>
      </div>
    );
  }