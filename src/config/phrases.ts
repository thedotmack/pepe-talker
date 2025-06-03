export const PEPE_PHRASES = {
  achievement: {
    title: "🎉 Achievement Unlocked",
    phrases: {
      firstTime: [
        "Feels good man! First taste of that sweet, sweet profit!",
        "Look at you go! Baby steps into the trading thunderdome!",
        "Welcome to the club, anon. Your journey into madness begins...",
        "WAGMI! We're all gonna make it... eventually!"
      ],
      milestones: [
        "Now THAT'S what I call diamond hands! 💎👋",
        "You magnificent bastard, you actually did it!",
        "Number go up! Brain make happy chemicals!",
        "This is the way. This is definitely the way."
      ]
    }
  },
  
  trading: {
    title: "📈 Trading Commentary",
    phrases: {
      wins: [
        "Buy high, sell higher! Wait, that's not how this works...",
        "Stonks only go up! (Please don't check my portfolio)",
        "You're basically Warren Buffett now. But greener.",
        "Moon mission successful! Next stop: Mars!"
      ],
      losses: [
        "It's not a loss until you sell! Right? RIGHT?!",
        "Looks like we're buying the dip... again... forever...",
        "This is fine. Everything is fine. *eye twitching*",
        "Red candles build character. Lots and lots of character."
      ]
    }
  },
  
  motivation: {
    title: "🎯 Encouragement & Motivation",
    phrases: {
      daily: [
        "Another day, another chance to lose money! Let's gooo!",
        "Markets open, hopium activated! Today's the day!",
        "Remember: scared money don't make money... but smart money doesn't lose it all",
        "Time to check those charts for the 47th time today!"
      ],
      volatility: [
        "Hold onto your butts! It's about to get spicy! 🌶️",
        "Just vibing through the chaos. This is normal.",
        "Zoom out! Unless it makes you feel worse, then don't."
      ]
    }
  },
  
  wisdom: {
    title: "🤔 Wisdom & Warnings",
    phrases: {
      risk: [
        "Only invest what you can afford to lose... so basically nothing?",
        "Diversification is for cowards. JK, please diversify.",
        "Don't put all your eggs in one basket. Unless it's a really good basket.",
        "Past performance doesn't guarantee future results, but YOLO!"
      ],
      meta: [
        "Why do we do this to ourselves? Oh right, the memes.",
        "Sir, this is a casino. Would you like some complimentary hopium?",
        "I'm not a financial advisor, I'm just a frog on the internet."
      ]
    }
  },
  
  flex: {
    title: "😎 Flex & Celebration",
    phrases: {
      portfolio: [
        "Look at Mr. Money Bags over here! Teach me your ways!",
        "From zero to hero! Well, from zero to slightly above zero!",
        "You're practically printing money! (In Monopoly dollars)",
        "Ladies and gentlemen... we got 'em! 💰"
      ]
    }
  },
  
  random: {
    title: "🧠 Random Pepe Wisdom",
    phrases: {
      general: [
        "Have you tried turning your portfolio off and on again?",
        "Instructions unclear, bought more memecoins",
        "This app is so good, it makes TikTok look productive!",
        "Achievement unlocked: Probably should have been working instead",
        "Error 404: Profits not found. Please try again later.",
        "Loading... Just kidding, I don't actually do anything useful"
      ]
    }
  },
  
  special: {
    title: "🎪 Special Occasions",
    phrases: {
      weekend: [
        "Weekend warrior mode activated! Sleep is for paper hands!",
        "Markets might be closed, but memes never sleep!"
      ],
      lateNight: [
        "3AM and still trading? You're my kind of degenerate!",
        "Night owl status confirmed. Vampires would be proud."
      ],
      features: [
        "Shiny new feature detected! Time to break something!",
        "Look at all these buttons I'll never understand!"
      ]
    }
  }
};

// Helper to get all phrases as a flat array
export function getAllPhrases(): string[] {
  const allPhrases: string[] = [];
  
  Object.values(PEPE_PHRASES).forEach(category => {
    Object.values(category.phrases).forEach(phraseGroup => {
      allPhrases.push(...phraseGroup);
    });
  });
  
  return allPhrases;
}

// Helper to get random phrase from a category
export function getRandomPhrase(categoryKey?: keyof typeof PEPE_PHRASES, subcategoryKey?: string): string {
  const phrases = getAllPhrases();
  
  if (categoryKey && PEPE_PHRASES[categoryKey]) {
    const category = PEPE_PHRASES[categoryKey];
    if (subcategoryKey && category.phrases[subcategoryKey]) {
      const subcategoryPhrases = category.phrases[subcategoryKey];
      return subcategoryPhrases[Math.floor(Math.random() * subcategoryPhrases.length)];
    }
    // Get all phrases from category
    const categoryPhrases: string[] = [];
    Object.values(category.phrases).forEach(phraseGroup => {
      categoryPhrases.push(...phraseGroup);
    });
    return categoryPhrases[Math.floor(Math.random() * categoryPhrases.length)];
  }
  
  return phrases[Math.floor(Math.random() * phrases.length)];
}
