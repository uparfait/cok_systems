import React, { useState, useEffect, useRef } from "react";
import { FiSearch } from "react-icons/fi";

const PRIMARY = "#056daa";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const GRAY_DISABLED = "#9E9E9E";
const BORDER = "#E0E0E0";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

interface SearchableSelectProps {
  options: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  emptyMessage?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options, value, onChange, placeholder, disabled = false, icon, emptyMessage = "No options found",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [displayText, setDisplayText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.id === value);

  useEffect(() => { setDisplayText(selectedOption ? selectedOption.name : ""); }, [selectedOption]);
  useEffect(() => { if (isOpen && inputRef.current) inputRef.current.focus(); }, [isOpen]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false); setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) => opt.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const handleSelect = (id: string) => { onChange(id); setIsOpen(false); setSearchTerm(""); };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const val = e.target.value; setSearchTerm(val); if (!isOpen) setIsOpen(true); };

  if (disabled) {
    return (
      <div className="w-full px-3 py-2 cursor-not-allowed cok-auth-input" style={{ fontFamily: fontHeading, fontSize: 14 }}>
        {icon && <span className="mr-2">{icon}</span>}
        <span>{placeholder}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full z-[50]">
      <div className="w-full px-3 py-2 cursor-text cok-auth-input" style={{ fontFamily: fontHeading, fontSize: 14 }} onClick={() => !isOpen && inputRef.current?.focus()}>
        <div className="flex items-center">
          {icon && <span className="mr-2" style={{ color: PRIMARY }}><FiSearch className="w-4 h-4" /></span>}
          <input ref={inputRef} type="text" value={isOpen ? searchTerm : displayText} onChange={handleInputChange} onFocus={() => setIsOpen(true)} placeholder={value ? "" : placeholder} className="flex-1 outline-none bg-transparent placeholder-gray-400 w-full" style={{ fontFamily: fontHeading, fontSize: 14, color: NEUTRAL_DARK }} disabled={disabled} />
        </div>
      </div>
      {isOpen && (
        <div className="absolute z-[100] w-full mt-1 bg-white border border-[#E0E0E0] max-h-56 overflow-y-auto" style={{ boxShadow: CARD_SHADOW }}>
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-3 text-xs text-[#9E9E9E] text-center italic">{emptyMessage}</div>
          ) : (
            filteredOptions.map((option) => (
              <div key={option.id} onClick={() => handleSelect(option.id)} className={`px-3 py-2 cursor-pointer text-xs border-b border-[#E0E0E0] cok-primary-bg-hoverable ${option.id === value ? "cok-bg-primary text-white font-medium" : "text-[#333333]"}`}>
                {option.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
