import { useState } from 'react';
import { FiEdit2, FiCheck, FiX } from 'react-icons/fi';

export default function EditableCell({ 
  value, field, roomId, type = 'text', saving, onSave 
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const startEditing = () => {
    setEditValue(value !== undefined && value !== null ? String(value) : '');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditValue('');
  };

  const handleSave = async () => {
    const success = await onSave(roomId, field, editValue);
    if (success) {
      setEditing(false);
      setEditValue('');
    }
  };

  if (editing) {
    if (field === 'isActive') {
      return (
        <div className="flex items-center gap-1">
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full px-2 py-1 border-2 border-[#056daa] text-xs font-bold uppercase bg-white focus:outline-none"
            autoFocus
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button onClick={handleSave} disabled={saving} className="p-1 text-green-600 hover:text-green-700" title="Save">
            <FiCheck className="w-4 h-4" />
          </button>
          <button onClick={cancelEditing} className="p-1 text-red-600 hover:text-red-700" title="Cancel">
            <FiX className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <input
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full px-2 py-1 border-2 border-[#056daa] text-sm focus:outline-none"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') cancelEditing();
          }}
          min={type === 'number' ? '1' : undefined}
        />
        <button onClick={handleSave} disabled={saving} className="p-1 text-green-600 hover:text-green-700" title="Save">
          <FiCheck className="w-4 h-4" />
        </button>
        <button onClick={cancelEditing} className="p-1 text-red-600 hover:text-red-700" title="Cancel">
          <FiX className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (field === 'isActive') {
    return (
      <div className="group/inline flex items-center gap-2 cursor-pointer" >
        <span className={`inline-block px-3 py-1 text-xs font-bold uppercase border-2 ${
          value ? 'bg-[#056daa] text-white border-[#056daa]' : 'bg-white text-gray-400 border-gray-300'
        }`}>
          {value ? 'Active' : 'Inactive'}
        </span>

      </div>
    );
  }

  return (
    <div className="group/inline flex items-center gap-2 cursor-pointer min-w-[60px]" >
      <span className="text-sm">{value || '___'}</span>
     
    </div>
  );
}