import React from 'react';
import { ReactionEmoji } from '../types';
import { ReactionIcon } from './ReactionIcon';

interface ReactionPickerProps {
  selectedReaction: ReactionEmoji | null;
  onSelectReaction: (emoji: ReactionEmoji) => void;
  disabled?: boolean;
}

const REACTIONS: ReactionEmoji[] = ['❤️', '😂', '🔥', '😢', '🥹'];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  selectedReaction,
  onSelectReaction,
  disabled = false,
}) => {
  return (
    <div className="w-full">
      <p className="text-xs font-medium text-[#777277] dark:text-[#B8B2B5] mb-3 text-center tracking-tight">
        {selectedReaction ? 'Твоя реакция на фото партнёра:' : 'Что скажешь на фото партнёра?'}
      </p>

      <div className="flex items-center justify-center gap-2.5 sm:gap-3 py-1">
        {REACTIONS.map((emoji) => {
          const isSelected = selectedReaction === emoji;
          return (
            <button
              key={emoji}
              type="button"
              disabled={disabled}
              onClick={() => onSelectReaction(emoji)}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-250 ease-out cursor-pointer active:scale-[0.92] select-none ${
                isSelected
                  ? 'bg-[#FAF0F2] dark:bg-[#2A161C] border-2 border-[#E98787] ring-2 ring-[#E98787]/20 scale-[1.06] shadow-xs animate-reaction-select'
                  : 'bg-white/85 dark:bg-[#1E1C1E] hover:bg-white dark:hover:bg-[#252225] border border-[#EBE3E5] dark:border-[#242024] shadow-2xs'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={`Реакция ${emoji}`}
            >
              <ReactionIcon reaction={emoji} size={26} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
