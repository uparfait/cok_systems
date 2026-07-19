import { FiLoader } from 'react-icons/fi';

export default function SpiralLoader({ 
  color = "#056daa", 
}) {
  return (
    <div className="flex flex-col items-center justify-center">
      <FiLoader color={color} className="w-6 h-6 animate-spin" />
    </div>
  );
}