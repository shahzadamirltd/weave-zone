// Notification service with sound
const NOTIFICATION_SOUND_URL = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T3q8lSAAAAAAD/+xDEAAP8AMAIACTAIAAANIMAAARHxoXmQiAAP8eshaFpAQgBx/+xDEEgI8AMAAACTAIAAANIMAAARHxoXmQiAAP8eshaFpAQgBx";

let audioContext: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;

// Initialize audio context and load sound
export const initNotificationSound = async () => {
  try {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a longer, more pleasant notification sound
    const sampleRate = audioContext.sampleRate;
    const duration = 0.5; // 500ms - longer sound
    const bufferSize = sampleRate * duration;
    
    audioBuffer = audioContext.createBuffer(1, bufferSize, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    
    // Generate a smooth three-tone ascending notification sound
    for (let i = 0; i < bufferSize; i++) {
      const t = i / sampleRate;
      const progress = i / bufferSize;
      
      // Three ascending tones
      const frequency1 = 523; // C5
      const frequency2 = 659; // E5
      const frequency3 = 784; // G5
      
      // Smooth envelope
      const attack = 0.1;
      const release = 0.3;
      let envelope = 1;
      
      if (progress < attack) {
        envelope = progress / attack;
      } else if (progress > 1 - release) {
        envelope = (1 - progress) / release;
      }
      
      // Mix the three tones with smooth transitions
      let signal = 0;
      if (progress < 0.33) {
        signal = Math.sin(2 * Math.PI * frequency1 * t);
      } else if (progress < 0.66) {
        const fade = (progress - 0.33) / 0.33;
        signal = Math.sin(2 * Math.PI * frequency1 * t) * (1 - fade) + 
                Math.sin(2 * Math.PI * frequency2 * t) * fade;
      } else {
        const fade = (progress - 0.66) / 0.34;
        signal = Math.sin(2 * Math.PI * frequency2 * t) * (1 - fade) + 
                Math.sin(2 * Math.PI * frequency3 * t) * fade;
      }
      
      channelData[i] = signal * envelope * 0.25;
    }
  } catch (error) {
    console.error("Failed to initialize notification sound:", error);
  }
};

// Play notification sound
export const playNotificationSound = async () => {
  try {
    if (!audioContext || !audioBuffer) {
      await initNotificationSound();
    }
    
    if (audioContext && audioBuffer) {
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start(0);
    }
  } catch (error) {
    console.error("Failed to play notification sound:", error);
  }
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};

// Show browser notification with sound
export const showNotification = async (title: string, body: string, icon?: string) => {
  const hasPermission = await requestNotificationPermission();
  
  if (hasPermission) {
    new Notification(title, {
      body,
      icon: icon || "/favicon.ico",
      badge: "/favicon.ico",
    });
  }
  
  // Play sound regardless of notification permission
  await playNotificationSound();
};

// Emoji reaction meanings
export const EMOJI_REACTIONS = {
  "❤️": { emoji: "❤️", meaning: "loved your", label: "Love" },
  "😂": { emoji: "😂", meaning: "laughed at your", label: "Funny" },
  "😮": { emoji: "😮", meaning: "was amazed by your", label: "Wow" },
  "😢": { emoji: "😢", meaning: "felt sad about your", label: "Sad" },
  "😡": { emoji: "😡", meaning: "is angry at your", label: "Angry" },
  "👍": { emoji: "👍", meaning: "liked your", label: "Like" },
  "🎉": { emoji: "🎉", meaning: "celebrated your", label: "Celebrate" },
};

export type EmojiType = keyof typeof EMOJI_REACTIONS;

// Get notification message for emoji reaction
export const getEmojiNotificationMessage = (emoji: EmojiType, username: string, contentType: "post" | "comment") => {
  const reaction = EMOJI_REACTIONS[emoji];
  return `${username} ${reaction.meaning} ${contentType}`;
};
