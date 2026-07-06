import React, { useState, useEffect, useRef } from "react";
import { FiSearch } from "react-icons/fi";

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
      <div className="w-full px-3 py-2 border border-[#D9E1EA] text-sm bg-gray-100 text-gray-500 cursor-not-allowed flex items-center">
        {icon && <span className="mr-2">{icon}</span>}
        <span>{placeholder}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full z-[50]">
      <div className="w-full px-3 py-2 border border-[#D9E1EA] text-sm bg-white cursor-text" onClick={() => !isOpen && inputRef.current?.focus()}>
        <div className="flex items-center">
          {icon && <span className="mr-2 text-[#0284C7]"><FiSearch className="w-4 h-4" /></span>}
          <input ref={inputRef} type="text" value={isOpen ? searchTerm : displayText} onChange={handleInputChange} onFocus={() => setIsOpen(true)} placeholder={value ? "" : placeholder} className="flex-1 outline-none bg-transparent text-[#2C3E50] placeholder-gray-400 text-xs w-full" disabled={disabled} />
        </div>
      </div>
      {isOpen && (
        <div className="absolute z-[100] w-full mt-1 bg-white border-2 border-[#0284C7] shadow-lg max-h-56 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-500 text-center italic">{emptyMessage}</div>
          ) : (
            filteredOptions.map((option) => (
              <div key={option.id} onClick={() => handleSelect(option.id)} className={`px-3 py-2 cursor-pointer hover:bg-[#e8f4fe] text-xs border-b border-gray-100 ${option.id === value ? "bg-[#0284C7] text-white font-medium" : "text-gray-700 hover:bg-blue-50"}`}>
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