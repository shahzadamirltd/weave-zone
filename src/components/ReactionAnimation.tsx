import { useEffect, useState } from "react";
import { EMOJI_REACTIONS, EmojiType } from "@/services/notificationService";

interface ReactionAnimationProps {
  emoji: EmojiType;
  onComplete?: () => void;
}

export function ReactionAnimation({ emoji, onComplete }: ReactionAnimationProps) {
  const [mounted, setMounted] = useState(true);
  const emojiData = EMOJI_REACTIONS[emoji];

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(false);
      onComplete?.();
    }, 1500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div className="animate-reaction-burst">
        <span className="text-8xl animate-bounce-scale">
          {emojiData.emoji}
        </span>
      </div>
    </div>
  );
}
