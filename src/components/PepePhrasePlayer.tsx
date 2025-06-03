import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SPRITE_CONFIG, ANIMATION_CONFIG } from '../config/sprites';
import { PEPE_PHRASES, getAllPhrases } from '../config/phrases';
import { Play, Pause, SkipForward, SkipBack, Shuffle, Filter, Volume2 } from 'lucide-react';

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
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  
  // Phrase player state
  const [phrases, setPhrases] = useState<string[]>([]);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
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
        setSelectedVoice(voiceInfos[0].voice);
      }
    };

    loadVoices();
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }

    // Initialize with all phrases
    setPhrases(getAllPhrases());
    
    // Start blinking
    scheduleNextBlink();

    return () => {
      if (blinkTimeoutRef.current) {
        clearTimeout(blinkTimeoutRef.current);
      }
    };
  }, []);

  // Filter phrases based on category
  useEffect(() => {
    let filteredPhrases: string[] = [];
    
    if (selectedCategory === 'all') {
      filteredPhrases = getAllPhrases();
    } else {
      const category = PEPE_PHRASES[selectedCategory as keyof typeof PEPE_PHRASES];
      if (category) {
        if (selectedSubcategory === 'all') {
          Object.values(category.phrases).forEach(phraseGroup => {
            filteredPhrases.push(...phraseGroup);
          });
        } else if (category.phrases[selectedSubcategory]) {
          filteredPhrases = [...category.phrases[selectedSubcategory]];
        }
      }
    }
    
    if (isShuffled) {
      filteredPhrases = [...filteredPhrases].sort(() => Math.random() - 0.5);
    }
    
    setPhrases(filteredPhrases);
    setCurrentPhraseIndex(0);
  }, [selectedCategory, selectedSubcategory, isShuffled]);

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

  // Blinking logic
  const scheduleNextBlink = () => {
    const nextBlinkIn = Math.random() * 
      (ANIMATION_CONFIG.blinkInterval.max - ANIMATION_CONFIG.blinkInterval.min) + 
      ANIMATION_CONFIG.blinkInterval.min;
    
    blinkTimeoutRef.current = window.setTimeout(() => {
      if (!isSpeaking) {
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
      
      // Auto-advance to next phrase
      if (currentPhraseIndex < phrases.length - 1) {
        setTimeout(() => {
          nextPhrase();
        }, 1000);
      }
      
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
    const words = chunkText.split(/\s+/);
    const sequence = SPRITE_CONFIG.sequences.sequence1;
    
    // Calculate syllables for this chunk
    const syllableData = words.map(word => ({
      word: word.replace(/[^\w]/g, ''),
      syllables: countSyllables(word.replace(/[^\w]/g, ''))
    }));
    
    const totalSyllables = syllableData.reduce((sum, data) => sum + data.syllables, 0);
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

  // Play current phrase with chunking system
  const playPhrase = (phraseText?: string) => {
    const textToSpeak = phraseText || phrases[currentPhraseIndex];
    if (!textToSpeak) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();
    
    // Preprocess text to prevent reading punctuation aloud
    let processedText = textToSpeak;
    processedText = processedText.replace(/\.\s*$/g, ''); // Remove trailing period
    processedText = processedText.replace(/\.\s+([A-Z])/g, ' $1'); // Remove periods before new sentences
    
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

  // Player controls
  const togglePlayPause = () => {
    if (isSpeaking) {
      // Stop everything when clicking during speech
      stopSpeaking();
    } else {
      // Start playing current phrase
      playPhrase();
    }
  };

  const stopSpeaking = () => {
    // Stop speech synthesis
    synthRef.current.cancel();
    
    // Stop queue processing
    isProcessingQueueRef.current = false;
    
    // Reset state
    setIsSpeaking(false);
    setCurrentFrame(SPRITE_CONFIG.sequences.sequence1[0]);
    
    // Cancel animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // Clear queue
    speechQueueRef.current = [];
    currentChunkIndexRef.current = 0;
  };

  const nextPhrase = () => {
    stopSpeaking();
    const nextIndex = (currentPhraseIndex + 1) % phrases.length;
    setCurrentPhraseIndex(nextIndex);
    setTimeout(() => playPhrase(phrases[nextIndex]), 100);
  };

  const previousPhrase = () => {
    stopSpeaking();
    const prevIndex = currentPhraseIndex === 0 ? phrases.length - 1 : currentPhraseIndex - 1;
    setCurrentPhraseIndex(prevIndex);
    setTimeout(() => playPhrase(phrases[prevIndex]), 100);
  };

  const toggleShuffle = () => {
    setIsShuffled(!isShuffled);
  };

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-900/50 backdrop-blur-xl border border-purple-500/20 rounded-3xl shadow-2xl shadow-purple-500/10 p-8">
          <h1 className="text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
            🐸 Pepe Phrase Player
          </h1>
          
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left: Pepe Display */}
            <div className="space-y-6">
              <motion.div
                className="relative w-80 h-80 mx-auto"
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
                  className="relative w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-2xl p-8"
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
                    className="absolute inset-0 w-full h-full object-contain"
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
              <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-2xl p-6">
                <div className="text-center">
                  <p className="text-sm text-gray-400 mb-2">
                    Phrase {currentPhraseIndex + 1} of {phrases.length}
                  </p>
                  <p className="text-lg font-medium text-gray-100 min-h-[60px]">
                    "{phrases[currentPhraseIndex] || 'Select a category to play phrases'}"
                  </p>
                </div>
              </div>

              {/* Chunk Progress */}
              {isSpeaking && totalChunks > 0 && (
                <div className="bg-blue-500/10 backdrop-blur border border-blue-500/20 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-400">Speaking Chunk</span>
                    <span className="text-sm text-blue-300">{currentChunkIndex} of {totalChunks}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(currentChunkIndex / totalChunks) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Player Controls */}
              <div className="flex justify-center items-center gap-4">
                <button
                  onClick={previousPhrase}
                  className="p-3 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 transition-all duration-200 hover:scale-105"
                  disabled={phrases.length === 0}
                >
                  <SkipBack size={24} />
                </button>
                
                <button
                  onClick={togglePlayPause}
                  className="p-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all duration-200 hover:scale-105 shadow-lg shadow-purple-500/25"
                  disabled={phrases.length === 0}
                >
                  {isSpeaking ? <StopCircle size={28} /> : <Play size={28} />}
                </button>
                
                <button
                  onClick={nextPhrase}
                  className="p-3 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 transition-all duration-200 hover:scale-105"
                  disabled={phrases.length === 0}
                >
                  <SkipForward size={24} />
                </button>
                
                <button
                  onClick={toggleShuffle}
                  className={`p-3 rounded-full border transition-all duration-200 hover:scale-105 ${
                    isShuffled 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-transparent shadow-lg shadow-purple-500/25' 
                      : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
                  }`}
                >
                  <Shuffle size={24} />
                </button>
              </div>

              {/* Speech Controls */}
              <div className="space-y-3 bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-1">
                    <Volume2 size={16} />
                    Speed: {speechRate.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Pitch: {speechPitch.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speechPitch}
                    onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Volume: {Math.round(speechVolume * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={speechVolume}
                    onChange={(e) => setSpeechVolume(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Right: Categories and Voice Selection */}
            <div className="space-y-6">
              {/* Category Selection */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-lg mb-4">Phrase Categories</h3>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setSelectedSubcategory('all');
                    }}
                    className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                  >
                    <option value="all">All Phrases</option>
                    {Object.entries(PEPE_PHRASES).map(([key, category]) => (
                      <option key={key} value={key}>
                        {category.title}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCategory !== 'all' && PEPE_PHRASES[selectedCategory as keyof typeof PEPE_PHRASES] && (
                  <div className="space-y-2 mt-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Subcategory
                    </label>
                    <select
                      value={selectedSubcategory}
                      onChange={(e) => setSelectedSubcategory(e.target.value)}
                      className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                    >
                      <option value="all">All Subcategories</option>
                      {Object.keys(PEPE_PHRASES[selectedCategory as keyof typeof PEPE_PHRASES].phrases).map(key => (
                        <option key={key} value={key}>
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mt-4 text-sm text-gray-600">
                  {phrases.length} phrases loaded
                </div>
              </div>

              {/* Voice Selection with Filters */}
              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Voice Selection</h3>
                  <button
                    onClick={() => setShowVoiceFilters(!showVoiceFilters)}
                    className="p-2 rounded-lg bg-white hover:bg-gray-100 transition-colors"
                  >
                    <Filter size={20} />
                  </button>
                </div>

                {/* Voice Filters */}
                {showVoiceFilters && (
                  <div className="space-y-3 mb-4 p-4 bg-white rounded-lg">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Gender
                        </label>
                        <select
                          value={genderFilter}
                          onChange={(e) => setGenderFilter(e.target.value as any)}
                          className="w-full p-2 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="all">All</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Country
                        </label>
                        <select
                          value={countryFilter}
                          onChange={(e) => setCountryFilter(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="all">All</option>
                          {getUniqueCountries().map(country => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      {getFilteredVoices().length} voices match filters
                    </div>
                  </div>
                )}

                {/* Voice List */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {getFilteredVoices().map((voiceInfo) => (
                    <label
                      key={voiceInfo.voice.name}
                      className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedVoice?.name === voiceInfo.voice.name
                          ? 'bg-green-100 border-2 border-green-500'
                          : 'bg-white hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <input
                        type="radio"
                        name="voice"
                        checked={selectedVoice?.name === voiceInfo.voice.name}
                        onChange={() => setSelectedVoice(voiceInfo.voice)}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {voiceInfo.voice.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {voiceInfo.gender !== 'unknown' && (
                            <span className="capitalize">{voiceInfo.gender} • </span>
                          )}
                          {voiceInfo.country} ({voiceInfo.language})
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Quick Voice Presets */}
              <div className="bg-blue-50 rounded-xl p-4">
                <h4 className="font-medium text-sm mb-2">Quick Voice Presets</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const maleVoices = voices.filter(v => v.gender === 'male');
                      if (maleVoices.length > 0) {
                        setSelectedVoice(maleVoices[0].voice);
                        setGenderFilter('male');
                      }
                    }}
                    className="p-2 text-sm bg-white rounded-lg hover:bg-gray-100"
                  >
                    🎩 Male Voice
                  </button>
                  <button
                    onClick={() => {
                      const femaleVoices = voices.filter(v => v.gender === 'female');
                      if (femaleVoices.length > 0) {
                        setSelectedVoice(femaleVoices[0].voice);
                        setGenderFilter('female');
                      }
                    }}
                    className="p-2 text-sm bg-white rounded-lg hover:bg-gray-100"
                  >
                    👗 Female Voice
                  </button>
                  <button
                    onClick={() => {
                      const usVoices = voices.filter(v => v.country === 'United States');
                      if (usVoices.length > 0) {
                        setSelectedVoice(usVoices[0].voice);
                        setCountryFilter('United States');
                      }
                    }}
                    className="p-2 text-sm bg-white rounded-lg hover:bg-gray-100"
                  >
                    🇺🇸 US English
                  </button>
                  <button
                    onClick={() => {
                      const ukVoices = voices.filter(v => v.country === 'United Kingdom');
                      if (ukVoices.length > 0) {
                        setSelectedVoice(ukVoices[0].voice);
                        setCountryFilter('United Kingdom');
                      }
                    }}
                    className="p-2 text-sm bg-white rounded-lg hover:bg-gray-100"
                  >
                    🇬🇧 UK English
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
