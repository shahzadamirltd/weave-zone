import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EMOJI_REACTIONS, EmojiType } from "@/services/notificationService";
import { Smile } from "lucide-react";

interface EmojiReactionPickerProps {
  onSelect: (emoji: EmojiType) => void;
  currentEmoji?: string;
}

export function EmojiReactionPicker({ onSelect, currentEmoji }: EmojiReactionPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: EmojiType) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 px-2 gap-1 ${currentEmoji ? 'text-primary' : ''}`}
        >
          {currentEmoji ? (
            <span className="text-lg">{currentEmoji}</span>
          ) : (
            <Smile className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex gap-1">
          {Object.entries(EMOJI_REACTIONS).map(([emoji, data]) => (
            <Button
              key={emoji}
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 hover:bg-accent/50 transition-all active:scale-90"
              onClick={() => handleSelect(emoji as EmojiType)}
              title={data.label}
            >
              <span className="text-2xl">{data.emoji}</span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
