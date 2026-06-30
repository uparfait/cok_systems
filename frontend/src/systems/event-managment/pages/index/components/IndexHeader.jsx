import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import RequiresAccountToLogin from "../../../ui-components/RequiresAccountToLogin";
import LeftLogo from '../../../assets/logo.png';

const NavigationLinks = [
  { DisplayName: "Live", Link: "/" },
  { DisplayName: "Upcoming", Link: "/upcoming" },
  { DisplayName: "Booking", Link: "/book-a-room/options" },
  {DisplayName: "My Tasks", Link: "/my-tasks" },
];

export default function IndexHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname; // Accurately tracks route updates without reloads
  const navigate = useNavigate();

  const HandleLoginButtonClicked = () => {

    navigate('/login');
  }

  return (
    <>
      {/* Outer Wrapper Header */}
      <header className="navigation-header   fixed top-0 left-0 z-50 flex h-full w-full items-center justify-between  ">
        
        {/* LEFT: Logo Container */}
        <div className="flex translate-x-[50px] items-center justify-start h-full w-[100px]  justify-center items-center ">
          <Link to="/" className="cursor-pointer  h-full w-full flex items-center justify-center">
            <img src={LeftLogo} alt="Logo" className="h-full w-full object-contain" />
          </Link>
        </div>

<nav className="hidden md:flex items-center gap-8 relative h-full">
          {NavigationLinks.map((link) => {
            const isActive = currentPath === link.Link;
            return (
              <Link
                key={link.Link}
                to={link.Link}
                className="relative py-2 h-full flex justify-center items-center text-sm tracking-[4px]    transition-opacity duration-200 group"
              >
                {/* Text Layout: Dynamic Gradient Hover and Active States */}
                <span className={`inline-block transition-all duration-300 ${
                  isActive 
                    ? "bg-gradient-to-r from-violet-600 via-pink-600 to-amber-500 bg-clip-text text-transparent bg-[size:200%_auto] animate-gradient" 
                    : "text-black group-hover:bg-gradient-to-r group-hover:from-violet-600 group-hover:via-pink-600 group-hover:to-amber-500 group-hover:bg-clip-text group-hover:text-transparent bg-[size:200%_auto] group-hover:animate-gradient"
                }`}>
                  {link.DisplayName}
                </span>

                {/* Desktop Framer Motion Sliding Underline */}
                {isActive && (
                  <motion.div
                    layoutId="desktopActiveUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-600 to-amber-500 rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}

        
        </nav>

        {/* RIGHT: Action & Mobile Icon Toggle */}
        <div className="flex w-max items-center justify-end h-full">
          <div className="hidden md:block">
            <RequiresAccountToLogin onClicked={HandleLoginButtonClicked}/>
          </div>

          {/* Mobile Pure CSS Animated Burger Icon Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex flex-col justify-center pr-[30px] items-center w-8 h-8 gap-[5px] md:hidden focus:outline-none cursor-pointer z-50"
            aria-label="Toggle Menu"
          >
            <span 
              className={`w-6 h-[2px] bg-black rounded-full transition-all duration-300 origin-center ${
                isOpen ? "rotate-45 translate-y-[3.5px]" : ""
              }`} 
            />
            <span 
              className={`w-6 h-[2px] bg-black rounded-full transition-all duration-200 ${
                isOpen ? "opacity-0 scale-0" : ""
              }`} 
            />
            <span 
              className={`w-6 h-[2px] bg-black rounded-full transition-all duration-300 origin-center ${
                isOpen ? "-rotate-45 -translate-y-[10.5px]" : ""
              }`} 
            />
          </button>
        </div>
      </header>

      {/* MOBILE & TABLET DRAWER: Right-to-Left Slide */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 220 }}
            className="fixed inset-0 z-40 flex flex-col justify-between pt-24 pb-12 px-8 w-screen h-screen md:hidden bg-white border-l border-zinc-200/40"
          >
            {/* Center aligned navigation links container matching the small text brand style */}
            <nav className="flex flex-col items-center justify-center gap-8 my-auto w-full">
              {NavigationLinks.map((link, index) => {
                const isActive = currentPath === link.Link;
                return (
                  <div key={link.Link} className="relative flex flex-col items-center w-fit py-2">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, ease: "easeOut" }}
                    >
                      <Link
                        to={link.Link}
                        className={`inline-block text-sm tracking-[4px]    py-1 transition-all duration-300 ${
                          isActive 
                            ? "bg-gradient-to-r from-violet-600 via-pink-600 to-amber-500 bg-clip-text text-transparent bg-[size:200%_auto] animate-gradient" 
                            : "text-black"
                        }`}
                        onClick={() => setIsOpen(false)}
                      >
                        {link.DisplayName}
                      </Link>
                    </motion.div>
                    
                    {/* Full width sliding bottom border indicator matching text width */}
                    {isActive && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ delay: 0.15, duration: 0.35 }}
                        className="absolute bottom-0 h-[2px] bg-gradient-to-r from-violet-600 to-amber-500 rounded-full"
                      />
                    )}
                  </div>
                );
              })}
            </nav>

      

            {/* Bottom Section for the login CTA inside mobile view */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="w-full flex justify-center pt-4 border-t border-zinc-200/60"
            >
              <RequiresAccountToLogin onClicked={HandleLoginButtonClicked}/>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
}