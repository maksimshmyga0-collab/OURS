import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';

interface PhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhoto: (photoUrl: string) => void;
  title?: string;
  subtitle?: string;
}

export const PhotoPickerModal: React.FC<PhotoPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectPhoto,
  title = 'Добавить фото',
  subtitle = 'Снимок для вашего общего момента',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          onSelectPhoto(result);
          onClose();
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#000000]/60 backdrop-blur-[6px] animate-in fade-in duration-200 ease-out"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#111111] border border-[#EBE3E5] dark:border-[#242024] rounded-t-[32px] sm:rounded-[28px] p-6 pb-8 shadow-[0_-4px_32px_rgba(0,0,0,0.14)] max-h-[85vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-4 sm:zoom-in-[0.98] duration-250 ease-out transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with dismiss */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-[#343033] dark:text-white">
              {title}
            </h3>
            <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F5EFF1] dark:bg-[#1E1C1E] hover:bg-[#EFE7E9] dark:hover:bg-[#252225] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5] transition-all hover:text-[#343033] dark:hover:text-white active:scale-95 cursor-pointer border border-transparent dark:border-[#242024]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Hidden native inputs: Camera & File picker */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/jpg, image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Clean Empty State Preview Frame */}
        <div className="w-full aspect-[4/3] rounded-[24px] border-2 border-dashed border-[#E5D7DA] dark:border-[#2E282E] bg-[#FAF5F7] dark:bg-[#161416] flex flex-col items-center justify-center p-6 text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#20181B] border border-[#EED7DC] dark:border-[#382329] flex items-center justify-center text-[#E98787] mb-3 shadow-2xs">
            <Camera size={26} />
          </div>
          <h4 className="text-sm font-semibold text-[#343033] dark:text-white">
            Ваш кадр для этого момента
          </h4>
          <p className="text-xs text-[#777277] dark:text-[#B8B2B5] max-w-[240px] mt-1 leading-relaxed">
            Сделайте живое фото на камеру или выберите готовое из галереи
          </p>
        </div>

        {/* Action Buttons: Camera & Device Gallery */}
        <div className="space-y-2.5">
          {/* 1. Camera Capture Button */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="w-full min-h-[50px] rounded-[20px] bg-[#E98787] hover:bg-[#DE7777] active:bg-[#D56868] text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer shadow-xs"
          >
            <Camera size={18} />
            <span>Сделать снимок</span>
          </button>

          {/* 2. Choose from Device / Gallery */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full min-h-[50px] rounded-[20px] bg-[#FAF0F2] dark:bg-[#1C1719] hover:bg-[#F6E6E9] dark:hover:bg-[#231C1F] text-[#343033] dark:text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer border border-[#EED7DC] dark:border-[#35252A]"
          >
            <ImageIcon size={18} className="text-[#E98787]" />
            <span>Выбрать из галереи устройства</span>
          </button>
        </div>
      </div>
    </div>
  );
};
