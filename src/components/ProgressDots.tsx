import React from 'react';

interface ProgressDotsProps {
  total: number;
  completed: number;
  activeOrder?: number;
}

export const ProgressDots: React.FC<ProgressDotsProps> = ({
  total = 3,
  completed = 0,
  activeOrder,
}) => {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${completed} из ${total} моментов`}>
      {Array.from({ length: total }).map((_, idx) => {
        const order = idx + 1;
        const isDone = order <= completed;
        const isCurrent = order === activeOrder;

        return (
          <span
            key={idx}
            className={`transition-all duration-300 rounded-full ${
              isDone
                ? 'w-2.5 h-2.5 bg-[#E98787]'
                : isCurrent
                ? 'w-4 h-2.5 bg-[#EFC1CB] dark:bg-[#A86474] rounded-full'
                : 'w-2.5 h-2.5 bg-[#CEC5C8]/50 dark:bg-[#383238]'
            }`}
          />
        );
      })}
    </div>
  );
};
