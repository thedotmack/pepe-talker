import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SPRITE_CONFIG, ANIMATION_CONFIG } from '../config/sprites';

export default function PepeTalker() {
  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentFrame, setCurrentFrame] = useState('1-1.webp');
  const [isBlinking, setIsBlinking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speechRate, setSpeechRate] = useState(1);
  const [speechPitch, setSpeechPitch] = useState(1);
  const [speechVolume, setSpeechVolume] = useState(1);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);

  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const animationRef = useRef<number | null>(null);
  const blinkTimeoutRef = useRef<number | null>(null);
  const speechQueueRef = useRef<Array<{ text: string; pauseAfter: number; startTime?: number; endTime?: number }>>([]);
  const currentChunkIndexRef = useRef(0);
  const isProcessingQueueRef = useRef(false);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = synthRef.current.getVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0 && !selectedVoice) {
        setSelectedVoice(availableVoices[0]);
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
  
  // Analyze text for punctuation and create phrase segments
  const analyzeTextSegments = (text: string) => {
    // Split by major punctuation while preserving the punctuation
    const segments = text.split(/([.!?;:]|\s*,\s*)/).filter(segment => segment.trim().length > 0);
    
    const phraseSegments: Array<{
      text: string;
      words: string[];
      pauseType: 'none' | 'comma' | 'period' | 'exclamation' | 'question' | 'semicolon' | 'colon';
      pauseDuration: number; // multiplier for base pause
    }> = [];
    
    let currentText = '';
    
    segments.forEach(segment => {
      const trimmed = segment.trim();
      
      if (/^[.!?;:,]$/.test(trimmed)) {
        // This is punctuation - finalize the current phrase
        if (currentText.trim()) {
          const words = currentText.trim().split(/\s+/).filter(word => word.length > 0);
          let pauseType: any = 'none';
          let pauseDuration = 1.0;
          
          switch (trimmed) {
            case ',':
              pauseType = 'comma';
              pauseDuration = 1.5; // Short pause
              break;
            case '.':
              pauseType = 'period';
              pauseDuration = 3.0; // Long pause
              break;
            case '!':
              pauseType = 'exclamation';
              pauseDuration = 3.0; // Long pause
              break;
            case '?':
              pauseType = 'question';
              pauseDuration = 3.0; // Long pause
              break;
            case ';':
              pauseType = 'semicolon';
              pauseDuration = 2.0; // Medium pause
              break;
            case ':':
              pauseType = 'colon';
              pauseDuration = 2.0; // Medium pause
              break;
          }
          
          phraseSegments.push({
            text: currentText.trim(),
            words,
            pauseType,
            pauseDuration
          });
          
          currentText = '';
        }
      } else {
        // This is text content
        currentText += ' ' + segment;
      }
    });
    
    // Handle any remaining text without punctuation
    if (currentText.trim()) {
      const words = currentText.trim().split(/\s+/).filter(word => word.length > 0);
      phraseSegments.push({
        text: currentText.trim(),
        words,
        pauseType: 'none',
        pauseDuration: 0
      });
    }
    
    return phraseSegments;
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
  
  // Calculate estimated speech duration and create syllable-timed animation
  const animateSpeech = () => {
    const phraseSegments = analyzeTextSegments(text);
    const sequence = SPRITE_CONFIG.sequences.sequence1;
    
    // Calculate total syllables across all segments
    const allSyllableData = phraseSegments.flatMap(segment => 
      segment.words.map(word => ({
        word: word.replace(/[^\w]/g, ''), // Remove punctuation for syllable counting
        syllables: countSyllables(word.replace(/[^\w]/g, ''))
      }))
    );
    
    const totalSyllables = allSyllableData.reduce((sum, data) => sum + data.syllables, 0);
    const totalWords = allSyllableData.length;
    
    // Estimate base duration: average 150 words per minute, adjusted for speech rate
    const wordsPerMinute = 150 * speechRate;
    const baseDuration = (totalWords / wordsPerMinute) * 60 * 1000; // in milliseconds
    
    // Calculate total pause time needed
    const totalPauseMultiplier = phraseSegments.reduce((sum, segment) => sum + segment.pauseDuration, 0);
    const pauseTimeAllocation = Math.min(baseDuration * 0.3, totalPauseMultiplier * 200); // Max 30% for pauses
    
    const speechDuration = baseDuration - pauseTimeAllocation;
    
    // Create timeline with syllable-based mouth movements and punctuation pauses
    const timeline: { time: number; frame: string; type: 'syllable' | 'comma' | 'period' | 'exclamation' | 'question' | 'semicolon' | 'colon' }[] = [];
    let currentTime = 0;
    
    phraseSegments.forEach((segment) => {
      const segmentSyllables = segment.words.reduce((sum, word) => 
        sum + countSyllables(word.replace(/[^\w]/g, '')), 0
      );
      
      const segmentDuration = (segmentSyllables / totalSyllables) * speechDuration;
      
      // Process words in this segment
      segment.words.forEach((word, wordIndex) => {
        const cleanWord = word.replace(/[^\w]/g, '');
        const syllables = countSyllables(cleanWord);
        const wordDuration = (syllables / segmentSyllables) * segmentDuration;
        const syllableDuration = wordDuration / syllables;
      
        // Animate each syllable
        for (let i = 0; i < syllables; i++) {
          const syllableStart = currentTime + (i * syllableDuration);
          
          // Create natural mouth movement for each syllable
          // Attack phase - mouth opens
          timeline.push({
            time: syllableStart,
            frame: sequence[1], // slight open
            type: 'syllable'
          });
          
          // Peak phase - maximum opening (varies by syllable position)
          const peakIntensity = i === 0 ? 4 : (i === syllables - 1 ? 2 : 3); // First syllable more emphasis
          timeline.push({
            time: syllableStart + syllableDuration * 0.3,
            frame: sequence[peakIntensity],
            type: 'syllable'
          });
          
          // Release phase - mouth starts closing
          timeline.push({
            time: syllableStart + syllableDuration * 0.7,
            frame: sequence[1],
            type: 'syllable'
          });
          
          // End of syllable - close if last syllable of word
          if (i === syllables - 1) {
            timeline.push({
              time: syllableStart + syllableDuration,
              frame: sequence[0],
              type: 'syllable'
            });
          }
        }
        
        currentTime += wordDuration;
        
        // Add small pause between words within a segment
        if (wordIndex < segment.words.length - 1) {
          const wordPause = 50 / speechRate; // Small inter-word pause
          timeline.push({
            time: currentTime,
            frame: sequence[0], // closed
            type: 'syllable'
          });
          currentTime += wordPause;
        }
      });
      
      // Add punctuation-based pause after this segment
      if (segment.pauseType !== 'none') {
        const punctuationPause = (segment.pauseDuration * 200) / speechRate; // Base 200ms pause
        timeline.push({
          time: currentTime,
          frame: sequence[0], // closed mouth during pause
          type: segment.pauseType
        });
        currentTime += punctuationPause;
      }
    });
    
    // Animation loop with timeline following
    let timelineIndex = 0;
    const startTime = Date.now();
    
    const animate = () => {
      if (!synthRef.current.speaking) {
        setCurrentFrame(sequence[0]);
        return;
      }

      const elapsed = Date.now() - startTime;
      
      // Find current timeline position
      while (timelineIndex < timeline.length - 1 && 
             timeline[timelineIndex + 1].time <= elapsed) {
        timelineIndex++;
      }
      
      if (timelineIndex < timeline.length) {
        setCurrentFrame(timeline[timelineIndex].frame);
      }

      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };

  // Text-to-speech with chunked approach
  const speak = async () => {
    if (!text.trim()) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();
    
    // Preprocess text to prevent reading punctuation aloud
    let processedText = text;
    
    // Replace periods at end of sentences (followed by space and capital letter or end of text)
    processedText = processedText.replace(/\.\s*$/g, ''); // Remove trailing period
    processedText = processedText.replace(/\.\s+([A-Z])/g, ' $1'); // Remove periods before new sentences
    
    // Keep periods in abbreviations and decimals
    // This regex keeps periods that are part of abbreviations (e.g., Dr., Mr., etc.)
    // and decimal numbers (e.g., 3.14)
    
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-2xl w-full">
        {/* Pepe Display */}
        <motion.div
          className="relative w-80 h-80 mx-auto mb-8"
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

        {/* Controls */}
        <div className="space-y-4">
          {/* Text Input */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text for Pepe to speak..."
            className="w-full p-4 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
            rows={3}
          />

          {/* Chunk Progress */}
          {isSpeaking && totalChunks > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-700">Speaking Chunk</span>
                <span className="text-sm text-blue-600">{currentChunkIndex} of {totalChunks}</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentChunkIndex / totalChunks) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Animation Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-700 mb-2">Chunked Speech Synthesis</h3>
            <p className="text-sm text-gray-600">
              Breaks text into 3-5 word chunks for precise control. Each chunk is spoken separately with natural pauses:
            </p>
            <ul className="text-xs text-gray-500 mt-2 space-y-1">
              <li>• Commas: 300ms pause</li>
              <li>• Semicolons/Colons: 500ms pause</li>
              <li>• Periods/Exclamations/Questions: 700ms pause</li>
              <li>• Natural breathing: 150ms between chunks</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2">
              Perfect lip sync by controlling exactly when each phrase plays!
            </p>
          </div>

          {/* Speech Buttons */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={speak}
              disabled={isSpeaking || !text.trim()}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Speak
            </button>
            <button
              onClick={stopSpeaking}
              disabled={!isSpeaking}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Stop
            </button>
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Voice
            </label>
            <select
              value={selectedVoice?.name || ''}
              onChange={(e) => {
                const voice = voices.find(v => v.name === e.target.value);
                setSelectedVoice(voice || null);
              }}
              className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
            >
              {voices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          {/* Speech Controls */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Speed: {speechRate.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pitch: {speechPitch.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speechPitch}
                onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Volume: {Math.round(speechVolume * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={speechVolume}
                onChange={(e) => setSpeechVolume(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}