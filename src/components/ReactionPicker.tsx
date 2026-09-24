import React from 'react';
import { ReactionEmoji } from '../types';

interface ReactionPickerProps {
  selectedReaction: ReactionEmoji | null;
  onSelectReaction: (emoji: ReactionEmoji) => void;
  disabled?: boolean;
}

const REACTIONS: ReactionEmoji[] = ['❤️', '🥹', '😂', '😍', '🫶'];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  selectedReaction,
  onSelectReaction,
  disabled = false,
}) => {
  return (
    <div className="w-full">
      <p className="text-xs font-medium text-[#777277] mb-3 text-center tracking-tight">
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
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all duration-200 ease-out cursor-pointer active:scale-95 select-none ${
                isSelected
                  ? 'bg-[#FAF0F2] border-2 border-[#E98787] scale-[1.04] shadow-xs'
                  : 'bg-white/85 hover:bg-white border border-[#EBE3E5] shadow-2xs'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={`Реакция ${emoji}`}
            >
              <span>{emoji}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
