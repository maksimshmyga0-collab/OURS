import React, { useRef } from 'react';
import { Upload, X, Sparkles } from 'lucide-react';
import { PRESET_PHOTOS } from '../services/samplePhotos';

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

  if (!isOpen) return null;


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Avoid storing huge base64 strings in Moment records
      if (typeof URL !== 'undefined' && URL.createObjectURL) {
        const objectUrl = URL.createObjectURL(file);
        onSelectPhoto(objectUrl);
        onClose();
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onSelectPhoto(event.target.result as string);
          onClose();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#343033]/30 backdrop-blur-[6px] animate-in fade-in duration-250 ease-out"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white border border-[#EBE3E5] rounded-t-[28px] sm:rounded-[24px] p-6 pb-8 shadow-[0_-4px_28px_rgba(0,0,0,0.08)] max-h-[85vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-4 sm:zoom-in-[0.98] duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with dismiss */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-[#343033]">
              {title}
            </h3>
            <p className="text-xs text-[#777277] mt-0.5">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F5EFF1] hover:bg-[#EFE7E9] flex items-center justify-center text-[#777277] transition-all hover:text-[#343033] active:scale-95 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Hidden native file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/jpg, image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Real file upload button */}
        <button
          type="button"
          onClick={handleTriggerFileInput}
          className="w-full min-h-[50px] rounded-[18px] bg-[#FAF0F2] hover:bg-[#F6E6E9] active:bg-[#F0DCE0] text-[#343033] font-semibold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer mb-5 border border-[#EED7DC]"
        >
          <Upload size={18} className="text-[#E98787]" />
          <span>Выбрать файл с устройства</span>
        </button>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#EBE3E5]" />
          </div>
          <span className="relative bg-white px-3 text-xs text-[#8A8488] font-medium flex items-center gap-1.5">
            <Sparkles size={12} className="text-[#E98787]" />
            или используйте тёплый пример
          </span>
        </div>

        {/* Preset photos grid */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {PRESET_PHOTOS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                onSelectPhoto(preset.url);
                onClose();
              }}
              className="flex flex-col items-center p-2 rounded-[18px] border border-[#EBE3E5] hover:border-[#E98787] hover:bg-[#FAF5F7] transition-all group cursor-pointer active:scale-98 text-left shadow-2xs"
            >
              <div className="w-full aspect-square rounded-[14px] overflow-hidden mb-2 bg-[#FAF1F3] border border-[#EBE3E5]">
                <img
                  src={preset.url}
                  alt={preset.title}
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-200"
                />
              </div>
              <span className="text-xs font-semibold text-[#343033] truncate w-full text-center">
                {preset.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
