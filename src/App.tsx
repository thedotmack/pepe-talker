import { useState } from 'react';
import PepeTalker from './components/PepeTalker';
import PepePhrasePlayer from './components/PepePhrasePlayer';
import { MessageSquare, PlayCircle } from 'lucide-react';

function App() {
  const [currentView, setCurrentView] = useState<'talker' | 'player'>('talker');

  return (
    <div className="min-h-screen bg-black">
      {/* Navigation */}
      <div className="bg-black/50 backdrop-blur-xl border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
              🐸 PepeTalker
            </h1>
            
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentView('talker')}
                className={`px-6 py-2.5 rounded-xl flex items-center gap-2 font-medium transition-all duration-300 ${
                  currentView === 'talker'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50 border border-gray-700'
                }`}
              >
                <MessageSquare size={20} />
                Text to Speech
              </button>
              
              <button
                onClick={() => setCurrentView('player')}
                className={`px-6 py-2.5 rounded-xl flex items-center gap-2 font-medium transition-all duration-300 ${
                  currentView === 'player'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50 border border-gray-700'
                }`}
              >
                <PlayCircle size={20} />
                Phrase Player
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {currentView === 'talker' ? <PepeTalker /> : <PepePhrasePlayer />}
    </div>
  );
}

export default App;
