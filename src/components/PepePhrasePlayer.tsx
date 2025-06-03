import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SPRITE_CONFIG, ANIMATION_CONFIG } from '../config/sprites';
import { PEPE_PHRASES, getAllPhrases } from '../config/phrases';
import { Play, Pause, Filter, Volume2, Mic, MicOff, MessageSquare } from 'lucide-react';

interface VoiceInfo {
  voice: SpeechSynthesisVoice;
  gender: 'male' | 'female' | 'unknown';
  country: string;
  language: string;
}

export default function PepePhrasePlayer() {
  // State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(SPRITE_CONFIG.sequences.sequence1[0]);
  const [isBlinking, setIsBlinking] = useState(false);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speechRate, setSpeechRate] = useState(1);
  const [speechPitch, setSpeechPitch] = useState(1);
  const [speechVolume, setSpeechVolume] = useState(1);
  const [currentPhrase, setCurrentPhrase] = useState<string>('');
  const [activePhraseButton, setActivePhraseButton] = useState<string | null>(null);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  
  // Category state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  
  // Voice filter state
  const [showVoiceFilters, setShowVoiceFilters] = useState(false);
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  
  // Refs
  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const animationRef = useRef<number | null>(null);
  const blinkTimeoutRef = useRef<number | null>(null);
  const speechQueueRef = useRef<Array<{ text: string; pauseAfter: number; startTime?: number; endTime?: number }>>([]);
  const currentChunkIndexRef = useRef(0);
  const isProcessingQueueRef = useRef(false);

  // Parse voice info
  const parseVoiceInfo = (voice: SpeechSynthesisVoice): VoiceInfo => {
    const name = voice.name.toLowerCase();
    const lang = voice.lang;
    
    // Determine gender from voice name
    let gender: 'male' | 'female' | 'unknown' = 'unknown';
    if (name.includes('female') || name.includes('woman') || 
        name.includes('samantha') || name.includes('victoria') ||
        name.includes('karen') || name.includes('moira') ||
        name.includes('tessa') || name.includes('fiona') ||
        name.includes('catherine') || name.includes('allison') ||
        name.includes('susan') || name.includes('zoe')) {
      gender = 'female';
    } else if (name.includes('male') || name.includes('man') ||
               name.includes('daniel') || name.includes('thomas') ||
               name.includes('alex') || name.includes('fred') ||
               name.includes('ralph') || name.includes('albert') ||
               name.includes('bruce') || name.includes('junior')) {
      gender = 'male';
    }
    
    // Extract country from language code
    const langParts = lang.split('-');
    const countryCode = langParts[1] || langParts[0];
    const countryNames: { [key: string]: string } = {
      'US': 'United States',
      'GB': 'United Kingdom',
      'AU': 'Australia',
      'CA': 'Canada',
      'IN': 'India',
      'ZA': 'South Africa',
      'IE': 'Ireland',
      'NZ': 'New Zealand',
      'FR': 'France',
      'DE': 'Germany',
      'ES': 'Spain',
      'IT': 'Italy',
      'JP': 'Japan',
      'KR': 'Korea',
      'CN': 'China',
      'RU': 'Russia',
      'BR': 'Brazil',
      'MX': 'Mexico',
      'PT': 'Portugal',
      'NL': 'Netherlands',
      'SE': 'Sweden',
      'NO': 'Norway',
      'DK': 'Denmark',
      'FI': 'Finland'
    };
    
    const country = countryNames[countryCode] || countryCode;
    
    return {
      voice,
      gender,
      country,
      language: lang
    };
  };

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = synthRef.current.getVoices();
      const voiceInfos = availableVoices.map(parseVoiceInfo);
      setVoices(voiceInfos);
      
      if (voiceInfos.length > 0 && !selectedVoice) {
        // Try to find Daniel from United Kingdom
        const danielVoice = voiceInfos.find(v => 
          v.voice.name.toLowerCase().includes('daniel') && 
          (v.country === 'United Kingdom' || v.language.includes('GB'))
        );
        
        if (danielVoice) {
          setSelectedVoice(danielVoice.voice);
        } else {
          // Fallback to first available voice
          setSelectedVoice(voiceInfos[0].voice);
        }
      }
    };

    loadVoices();
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }
    
    // Start blinking
    scheduleNextBlink();

    return () => {
      if (blinkTimeoutRef.current) {
        clearTimeout(blinkTimeoutRef.current);
      }
    };
  }, []);

  // Get filtered voices
  const getFilteredVoices = () => {
    return voices.filter(voiceInfo => {
      if (genderFilter !== 'all' && voiceInfo.gender !== genderFilter) {
        return false;
      }
      if (countryFilter !== 'all' && voiceInfo.country !== countryFilter) {
        return false;
      }
      return true;
    });
  };

  // Get unique countries
  const getUniqueCountries = () => {
    const countries = new Set(voices.map(v => v.country));
    return Array.from(countries).sort();
  };

  // Get phrases for current category
  const getCurrentPhrases = (): string[] => {
    if (selectedCategory === 'all') {
      return getAllPhrases();
    }
    
    const category = PEPE_PHRASES[selectedCategory as keyof typeof PEPE_PHRASES];
    if (!category) return [];
    
    if (selectedSubcategory === 'all') {
      const allPhrases: string[] = [];
      Object.values(category.phrases).forEach(phraseGroup => {
        allPhrases.push(...phraseGroup);
      });
      return allPhrases;
    }
    
    return category.phrases[selectedSubcategory] || [];
  };

  // Blinking logic
  const scheduleNextBlink = () => {
    const nextBlinkIn = Math.random() * 
      (ANIMATION_CONFIG.blinkInterval.max - ANIMATION_CONFIG.blinkInterval.min) + 
      ANIMATION_CONFIG.blinkInterval.min;
    
    blinkTimeoutRef.current = window.setTimeout(() => {
      // Only blink if not speaking and on the default frame
      if (!isSpeaking && currentFrame === SPRITE_CONFIG.sequences.sequence1[0]) {
        performBlink();
      }
      scheduleNextBlink();
    }, nextBlinkIn);
  };

  const performBlink = () => {
    setIsBlinking(true);
    setTimeout(() => {
      setIsBlinking(false);
    }, ANIMATION_CONFIG.blinkDuration);
  };

  // Count syllables for timing calculations
  const countSyllables = (word: string): number => {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;
    
    const vowelGroups = word.match(/[aeiouy]+/g) || [];
    let count = vowelGroups.length;
    
    if (word.endsWith('e') && count > 1) count--;
    
    return Math.max(1, count);
  };

  // Create speech chunks for sequential playback
  const createSpeechChunks = (text: string): Array<{ text: string; pauseAfter: number }> => {
    const chunks: Array<{ text: string; pauseAfter: number }> = [];
    
    // Split by punctuation while preserving it
    const segments = text.split(/([.!?;:,])/).filter(s => s.trim());
    
    let currentChunk = '';
    let wordCount = 0;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const trimmed = segment.trim();
      
      if (/^[.!?;:,]$/.test(trimmed)) {
        // Add punctuation to current chunk
        currentChunk = currentChunk.trim() + trimmed;
        
        // Determine pause duration based on punctuation
        let pauseDuration = 0;
        switch (trimmed) {
          case ',':
            pauseDuration = 300; // Short pause
            break;
          case ';':
          case ':':
            pauseDuration = 500; // Medium pause
            break;
          case '.':
          case '!':
          case '?':
            pauseDuration = 700; // Long pause
            break;
        }
        
        // Push current chunk
        if (currentChunk.trim()) {
          chunks.push({ text: currentChunk.trim(), pauseAfter: pauseDuration });
          currentChunk = '';
          wordCount = 0;
        }
      } else {
        // Add words to current chunk
        const words = segment.split(/\s+/).filter(w => w);
        
        for (const word of words) {
          currentChunk += (currentChunk ? ' ' : '') + word;
          wordCount++;
          
          // Create chunk every 3-5 words if no punctuation
          if (wordCount >= 4 && i < segments.length - 2) {
            chunks.push({ text: currentChunk.trim(), pauseAfter: 150 }); // Natural breath pause
            currentChunk = '';
            wordCount = 0;
          }
        }
      }
    }
    
    // Handle remaining text
    if (currentChunk.trim()) {
      chunks.push({ text: currentChunk.trim(), pauseAfter: 0 });
    }
    
    return chunks;
  };

  // Process speech queue - speak chunks sequentially
  const processNextChunk = () => {
    if (!isProcessingQueueRef.current || currentChunkIndexRef.current >= speechQueueRef.current.length) {
      // Queue finished
      setIsSpeaking(false);
      setCurrentFrame(SPRITE_CONFIG.sequences.sequence1[0]);
      isProcessingQueueRef.current = false;
      setCurrentChunkIndex(0);
      setTotalChunks(0);
      setActivePhraseButton(null);
      return;
    }

    const chunk = speechQueueRef.current[currentChunkIndexRef.current];
    setCurrentChunkIndex(currentChunkIndexRef.current + 1);
    
    // Create utterance for this chunk
    // Remove punctuation that might be read aloud (periods, commas, etc.)
    let spokenText = chunk.text;
    // Remove periods at the end of sentences
    spokenText = spokenText.replace(/\.$/, '');
    // Replace other punctuation with slight pauses (space)
    spokenText = spokenText.replace(/[,;:!?]/g, ' ');
    // Clean up multiple spaces
    spokenText = spokenText.replace(/\s+/g, ' ').trim();
    
    const chunkUtterance = new SpeechSynthesisUtterance(spokenText);
    
    if (selectedVoice) {
      chunkUtterance.voice = selectedVoice;
    }
    chunkUtterance.rate = speechRate;
    chunkUtterance.pitch = speechPitch;
    chunkUtterance.volume = speechVolume;
    
    // Track timing
    chunk.startTime = Date.now();
    
    chunkUtterance.onstart = () => {
      // Animate this specific chunk
      animateChunk(chunk.text);
    };
    
    chunkUtterance.onend = () => {
      chunk.endTime = Date.now();
      currentChunkIndexRef.current++;
      
      // Add pause if needed
      if (chunk.pauseAfter > 0) {
        // Close mouth during pause
        setCurrentFrame(SPRITE_CONFIG.sequences.sequence1[0]);
        
        setTimeout(() => {
          processNextChunk();
        }, chunk.pauseAfter / speechRate); // Adjust pause by speech rate
      } else {
        // Process next chunk immediately
        processNextChunk();
      }
    };
    
    chunkUtterance.onerror = () => {
      console.error('Speech error for chunk:', chunk.text);
      // Continue with next chunk
      currentChunkIndexRef.current++;
      processNextChunk();
    };
    
    synthRef.current.speak(chunkUtterance);
  };

  // Animate a specific chunk with precise timing
  const animateChunk = (chunkText: string) => {
    // Remove punctuation from chunk text for animation
    const animationText = chunkText.replace(/[.!?;:,]/g, '').trim();
    
    // If only punctuation remains, don't animate
    if (!animationText) return;
    
    const words = animationText.split(/\s+/);
    const sequence = SPRITE_CONFIG.sequences.sequence1;
    
    // Calculate syllables for this chunk
    const syllableData = words
      .map(word => {
        const cleanWord = word.replace(/[^\w]/g, '');
        return {
          word: cleanWord,
          syllables: cleanWord ? countSyllables(cleanWord) : 0
        };
      })
      .filter(data => data.word.length > 0); // Filter out empty words
    
    const totalSyllables = syllableData.reduce((sum, data) => sum + data.syllables, 0);
    
    // If no syllables to animate, return early
    if (totalSyllables === 0) return;
    
    const estimatedDuration = (totalSyllables * 150) / speechRate; // ~150ms per syllable
    
    // Create animation timeline for this chunk
    const timeline: { time: number; frame: string }[] = [];
    let currentTime = 0;
    
    syllableData.forEach((data, wordIndex) => {
      const wordDuration = (data.syllables / totalSyllables) * estimatedDuration;
      const syllableDuration = wordDuration / data.syllables;
      
      for (let i = 0; i < data.syllables; i++) {
        const syllableStart = currentTime + (i * syllableDuration);
        
        // Natural mouth movement pattern
        timeline.push(
          { time: syllableStart, frame: sequence[1] }, // Open
          { time: syllableStart + syllableDuration * 0.3, frame: sequence[3] }, // Peak
          { time: syllableStart + syllableDuration * 0.7, frame: sequence[1] }, // Closing
        );
        
        if (i === data.syllables - 1) {
          timeline.push({ time: syllableStart + syllableDuration, frame: sequence[0] }); // Closed
        }
      }
      
      currentTime += wordDuration;
      
      // Small pause between words
      if (wordIndex < words.length - 1) {
        currentTime += 50 / speechRate;
      }
    });
    
    // Animate based on timeline
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      
      // Find current position in timeline
      let currentEvent = null;
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i].time <= elapsed) {
          currentEvent = timeline[i];
          break;
        }
      }
      
      if (currentEvent) {
        setCurrentFrame(currentEvent.frame);
      }
      
      if (elapsed < estimatedDuration && isProcessingQueueRef.current) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animate);
  };

  // Play phrase with chunking system
  const playPhrase = (phrase: string) => {
    // Cancel any ongoing speech
    synthRef.current.cancel();
    
    // Preprocess text to prevent reading punctuation aloud and remove emojis
    let processedText = phrase;
    
    // Remove emojis and other Unicode symbols
    processedText = processedText.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    
    // Remove other common emojis that might be missed
    processedText = processedText.replace(/[🐸🎯💎🚀✨⚡️🔥💪🏻👀🎭🌟💰🏆🎨🎪🎮🌈☀️🌙⭐️]/g, '');
    
    // Clean up extra spaces
    processedText = processedText.replace(/\s+/g, ' ').trim();
    
    // Set current phrase and button state (with original text including emojis for display)
    setCurrentPhrase(phrase);
    setActivePhraseButton(phrase);
    
    // Reset state
    setIsSpeaking(true);
    const chunks = createSpeechChunks(processedText);
    speechQueueRef.current = chunks;
    currentChunkIndexRef.current = 0;
    isProcessingQueueRef.current = true;
    setTotalChunks(chunks.length);
    setCurrentChunkIndex(0);
    
    // Start processing chunks
    processNextChunk();
  };

  // Stop speaking
  const stopSpeaking = () => {
    // Stop speech synthesis
    synthRef.current.cancel();
    
    // Stop queue processing
    isProcessingQueueRef.current = false;
    
    // Reset state
    setIsSpeaking(false);
    setCurrentFrame(SPRITE_CONFIG.sequences.sequence1[0]);
    setActivePhraseButton(null);
    
    // Cancel animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // Clear queue
    speechQueueRef.current = [];
    currentChunkIndexRef.current = 0;
  };

  const phrases = getCurrentPhrases();

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with Pepe */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
            🐸 Pepe Soundboard
          </h1>
          
          {/* Centered Pepe */}
          <motion.div
            className="relative w-64 h-64 mx-auto mb-4"
            animate={{
              y: [0, -ANIMATION_CONFIG.floatAmplitude, 0],
            }}
            transition={{
              duration: ANIMATION_CONFIG.floatDuration / 1000,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <motion.div
              className="relative w-full h-full"
              animate={{
                scale: isSpeaking ? 1.05 : 1
              }}
              transition={{
                duration: 0.3
              }}
            >
              {/* Base frame */}
              <img
                src={SPRITE_CONFIG.basePath + currentFrame}
                alt="Pepe"
                className="w-full h-full object-contain"
              />
              
              {/* Blink overlay */}
              <AnimatePresence>
                {isBlinking && SPRITE_CONFIG.blinkOverlays[currentFrame as keyof typeof SPRITE_CONFIG.blinkOverlays] && (
                  <motion.img
                    src={SPRITE_CONFIG.basePath + SPRITE_CONFIG.blinkOverlays[currentFrame as keyof typeof SPRITE_CONFIG.blinkOverlays]}
                    alt="Eyes closed"
                    className="absolute inset-0 w-full h-full object-contain"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>

          {/* Current Phrase Display */}
          {currentPhrase && (
            <div className="max-w-md mx-auto bg-gray-800/50 backdrop-blur border border-gray-700 rounded-2xl p-4 mb-4">
              <div className="flex items-start gap-2">
                <div className={`mt-1 ${isSpeaking ? 'text-green-400' : 'text-gray-400'}`}>
                  {isSpeaking ? <Mic size={16} /> : <MicOff size={16} />}
                </div>
                <p className="text-sm text-gray-100 flex-1">
                  "{currentPhrase}"
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="bg-gray-900/50 backdrop-blur-xl border border-purple-500/20 rounded-3xl shadow-2xl shadow-purple-500/10 p-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left: Controls */}
            <div className="space-y-6">
              {/* Category Selection */}
              <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-sm text-gray-100">Categories</h3>
                
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedSubcategory('all');
                  }}
                  className="w-full p-2 bg-gray-900 border border-gray-600 rounded-lg focus:border-purple-500 focus:outline-none text-gray-100 text-sm"
                >
                  <option value="all">All Phrases</option>
                  {Object.entries(PEPE_PHRASES).map(([key, category]) => (
                    <option key={key} value={key}>
                      {category.title}
                    </option>
                  ))}
                </select>

                {selectedCategory !== 'all' && PEPE_PHRASES[selectedCategory as keyof typeof PEPE_PHRASES] && (
                  <select
                    value={selectedSubcategory}
                    onChange={(e) => setSelectedSubcategory(e.target.value)}
                    className="w-full p-2 bg-gray-900 border border-gray-600 rounded-lg focus:border-purple-500 focus:outline-none text-gray-100 text-sm"
                  >
                    <option value="all">All Subcategories</option>
                    {Object.keys(PEPE_PHRASES[selectedCategory as keyof typeof PEPE_PHRASES].phrases).map(key => (
                      <option key={key} value={key}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Speech Controls */}
              <div className="space-y-3 bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-4">
                <h3 className="font-semibold text-sm text-gray-100 mb-2">Voice Controls</h3>
                
                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-300 mb-1">
                    <Volume2 size={14} />
                    Speed: {speechRate.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Pitch: {speechPitch.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speechPitch}
                    onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Volume: {Math.round(speechVolume * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={speechVolume}
                    onChange={(e) => setSpeechVolume(parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1"
                  />
                </div>

                {/* Voice Selection */}
                <div className="pt-2 border-t border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-300">Voice</label>
                    <button
                      onClick={() => setShowVoiceFilters(!showVoiceFilters)}
                      className="p-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                    >
                      <Filter size={12} />
                    </button>
                  </div>
                  
                  {showVoiceFilters && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <select
                        value={genderFilter}
                        onChange={(e) => setGenderFilter(e.target.value as any)}
                        className="p-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-100"
                      >
                        <option value="all">All Genders</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                      
                      <select
                        value={countryFilter}
                        onChange={(e) => setCountryFilter(e.target.value)}
                        className="p-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-100"
                      >
                        <option value="all">All Countries</option>
                        {getUniqueCountries().map(country => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <select
                    value={selectedVoice?.name || ''}
                    onChange={(e) => {
                      const voice = voices.find(v => v.voice.name === e.target.value);
                      if (voice) setSelectedVoice(voice.voice);
                    }}
                    className="w-full p-2 bg-gray-900 border border-gray-600 rounded-lg text-xs text-gray-100"
                  >
                    {getFilteredVoices().map((voiceInfo) => (
                      <option key={voiceInfo.voice.name} value={voiceInfo.voice.name}>
                        {voiceInfo.voice.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Right: Phrase Buttons */}
            <div className="lg:col-span-2">
              <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg text-gray-100">
                    Phrases ({phrases.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCustomInput(!showCustomInput)}
                      className={`px-3 py-1 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                        showCustomInput
                          ? 'bg-purple-500 hover:bg-purple-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      }`}
                    >
                      <MessageSquare size={14} />
                      Custom
                    </button>
                    {isSpeaking && (
                      <button
                        onClick={stopSpeaking}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                      >
                        <Pause size={14} />
                        Stop
                      </button>
                    )}
                  </div>
                </div>

                {/* Custom Input */}
                {showCustomInput && (
                  <div className="mb-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customText.trim()) {
                            playPhrase(customText);
                          }
                        }}
                        placeholder="Type anything for Pepe to say..."
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:border-purple-500 focus:outline-none text-sm"
                      />
                      <button
                        onClick={() => {
                          if (customText.trim()) {
                            playPhrase(customText);
                          }
                        }}
                        disabled={!customText.trim() || isSpeaking}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-all flex items-center gap-2"
                      >
                        <Play size={14} />
                        Speak
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Phrase Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2">
                  {phrases.map((phrase, index) => (
                    <motion.button
                      key={`${selectedCategory}-${selectedSubcategory}-${index}`}
                      onClick={() => playPhrase(phrase)}
                      className={`p-3 rounded-lg border text-left transition-all duration-200 text-sm ${
                        activePhraseButton === phrase
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-transparent text-white shadow-lg shadow-purple-500/25'
                          : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-purple-500/50'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={isSpeaking && activePhraseButton !== phrase}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 ${activePhraseButton === phrase ? 'text-white' : 'text-gray-500'}`}>
                          <Play size={14} />
                        </div>
                        <span className="flex-1 line-clamp-2">
                          {phrase}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
                
                {phrases.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No phrases available for the selected category
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}