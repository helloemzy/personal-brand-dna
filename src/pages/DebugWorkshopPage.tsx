import React from 'react';
import { useAppSelector } from '../hooks/redux';
import { clearCorruptedWorkshopState } from '../utils/workshopStateHelper';

const DebugWorkshopPage: React.FC = () => {
  const workshopState = useAppSelector(state => state.workshop);
  
  const handleClearWorkshopState = () => {
    if (window.confirm('This will clear all workshop data. Are you sure?')) {
      clearCorruptedWorkshopState();
      window.location.href = '/brand-house';
    }
  };
  
  const handleEnableDebugging = () => {
    localStorage.setItem('workshop_debug', 'true');
    alert('Workshop debugging enabled. Open the browser console and try the workshop again.');
  };
  
  const handleDisableDebugging = () => {
    localStorage.removeItem('workshop_debug');
    alert('Workshop debugging disabled.');
  };
  
  const getLocalStorageSize = () => {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    return (total / 1024).toFixed(2);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Workshop Debug Panel</h1>
        
        {/* Current State */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Workshop State</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
            {JSON.stringify(workshopState, null, 2)}
          </pre>
        </div>
        
        {/* Debug Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Debug Actions</h2>
          <div className="space-y-4">
            <button
              onClick={handleClearWorkshopState}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Clear Workshop State
            </button>
            
            <button
              onClick={handleEnableDebugging}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ml-4"
            >
              Enable Console Debugging
            </button>
            
            <button
              onClick={handleDisableDebugging}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 ml-4"
            >
              Disable Console Debugging
            </button>
          </div>
        </div>
        
        {/* Storage Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Storage Information</h2>
          <p>Total localStorage size: {getLocalStorageSize()} KB</p>
          <div className="mt-4">
            <h3 className="font-semibold">Workshop-related keys:</h3>
            <ul className="mt-2 space-y-1">
              {Object.keys(localStorage)
                .filter(key => key.includes('workshop') || key.includes('persist'))
                .map(key => (
                  <li key={key} className="text-sm text-gray-600">
                    {key}: {(localStorage[key].length / 1024).toFixed(2)} KB
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugWorkshopPage;