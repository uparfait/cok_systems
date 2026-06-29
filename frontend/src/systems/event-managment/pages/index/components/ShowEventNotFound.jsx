import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function ShowEventNotFound({ message = "This event has not started or does not exist." }) {
  const navigate = useNavigate()
  return (
 
   <div className="w-full h-max flex flex-col items-center text-center rounded-none">
      <div className="max-w-md text-center flex flex-col items-center rounded-none">
        <div className="w-[300px] h-[300px] flex items-center justify-center mb-4 rounded-none">
          {/* SVG illustration */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160">
            <ellipse cx="100" cy="140" rx="80" ry="15" fill="#e0e0e0" />
            <polygon points="30,40 30,120 70,120" fill="#1a1a1a" />
            <rect x="70" y="40" width="100" height="80" rx="4" fill="#ffffff" stroke="#000000" strokeWidth="2" />
            <rect x="70" y="30" width="100" height="15" rx="4" fill="#007bff" />
            <circle cx="85" cy="37" r="3" fill="#000000" />
            <circle cx="105" cy="37" r="3" fill="#000000" />
            <circle cx="125" cy="37" r="3" fill="#000000" />
            <g fill="#66b2ff">
              <rect x="80" y="50" width="20" height="20" />
              <rect x="105" y="50" width="20" height="20" />
              <rect x="130" y="50" width="20" height="20" />
              <rect x="80" y="75" width="20" height="20" />
              <rect x="105" y="75" width="20" height="20" />
              <rect x="130" y="75" width="20" height="20" />
              <rect x="80" y="100" width="20" height="20" />
              <rect x="105" y="100" width="20" height="20" />
              <rect x="130" y="100" width="20" height="20" />
            </g>
            <circle cx="150" cy="85" r="18" fill="#007bff" stroke="#000000" strokeWidth="2" />
            <rect x="165" y="95" width="25" height="6" rx="3" fill="#000000" transform="rotate(30 165 95)" />
            <circle cx="45" cy="60" r="15" fill="#007bff" />
            <line x1="38" y1="53" x2="52" y2="67" stroke="#ffffff" strokeWidth="3" />
            <line x1="52" y1="53" x2="38" y2="67" stroke="#ffffff" strokeWidth="3" />
          </svg>
        </div>
        <p className="text-sm text-zinc-500 mb-6 rounded-none">
          Nothing to show at this moment check again later.
        </p>
      </div>
    </div>
    
  );
}