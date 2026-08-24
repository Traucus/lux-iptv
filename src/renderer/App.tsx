import React from 'react';

/**
 * Main application component
 * TODO: Add routing, layout, and feature components
 */
function App(): React.ReactElement {
  return (
    <div className="min-h-screen bg-surface text-white">
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-display-lg font-bold text-primary-500">Lux IPTV</h1>
          <p className="text-gray-400">Cinematic IPTV Player</p>
          <div className="mt-8 px-6 py-3 bg-glass backdrop-blur-md rounded-lg border border-white/10 shadow-glass">
            <p className="text-sm text-gray-300">Application initialized successfully</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
