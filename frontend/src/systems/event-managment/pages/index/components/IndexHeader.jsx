import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const NavigationLinks = [
  { DisplayName: "Live", Link: "/" },
  { DisplayName: "Upcoming", Link: "/upcoming" },
  { DisplayName: "Booking", Link: "/book-a-room/options" },
  { DisplayName: "My Tasks", Link: "/my-tasks" },
];

const visibleCount = 3;
const PRIMARY = '#056daa';
const PRIMARY_DARK = '#045d94';

export default function IndexHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const navigate = useNavigate();

  const HandleLoginButtonClicked = () => {
    navigate('/login');
  };

  const visibleLinks = NavigationLinks.slice(0, visibleCount);
  const moreLinks = NavigationLinks.slice(visibleCount);

  const isLinkActive = (link) => {

    //console.log(currentPath.split("/")[1] === link.Link.split('/')[1])
    
    if (link.Link === "/") return currentPath === "/";
    return  (currentPath.split("/")[1] === link.Link.split('/')[1]);

  };

  const linkBaseStyle = {
    fontFamily: "'Montserrat', sans-serif",
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    textDecoration: 'none',
    transition: 'color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    background: 'none',
    border: 'none',
  };

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-[9999] bg-white" style={{ boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)', height: '80px' }}>
        <div className=" mx-auto h-full flex items-center justify-between px-[20px]  md:px-[75px] ">
          {/* LEFT: Logo + Text */}
          <Link to="/" className="flex items-center gap-4 h-full" style={{ textDecoration: 'none' }}>
            <img src="/LOGO_COK.png" alt="CoK Logo" style={{ height: '71px', width: 'auto' }} />
            <span className="text-black" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 620, fontSize: '18px',  letterSpacing: '-0.5px' }}>
              KIGALI CITY
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center" style={{ height: '100%', gap: '32px' }}>
            {visibleLinks.map((link) => {
              const active = isLinkActive(link);
              return (
                <Link
                  key={link.Link}
                  to={link.Link}
                  className="h-full flex items-center relative group"
                  style={{
                    ...linkBaseStyle,
                    color: active ? PRIMARY : '#00000080',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.color = PRIMARY;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.color = '#00000080';
                  }}
                >
                  {link.DisplayName}
                  {active && (
                    <div className="absolute bottom-0 left-0 right-0" style={{ height: '2px', backgroundColor: PRIMARY }} />
                  )}
                </Link>
              );
            })}

            {moreLinks.length > 0 && (
              <div 
                className="relative h-full flex items-center"
                onMouseEnter={() => setMoreOpen(true)}
                onMouseLeave={() => setMoreOpen(false)}
              >
                <button
                  className="h-full flex items-center group"
                  style={{
                    ...linkBaseStyle,
                    color: '#00000080',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = PRIMARY;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#00000080';
                  }}
                >
                  More
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ marginTop: '2px', marginLeft: '4px' }}>
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                <AnimatePresence>
                  {moreOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full left-0"
                      style={{
                        minWidth: '200px',
                        backgroundColor: 'white',
                        boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)',
                        border: '1px solid #E0E0E0',
                        padding: '8px 0',
                      }}
                    >
                      {moreLinks.map((link) => (
                        <Link
                          key={link.Link}
                          to={link.Link}
                          className="block px-6 py-3"
                          style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#00000080',
                            textDecoration: 'none',
                            transition: 'background-color 0.2s ease, color 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = `rgba(0, 0, 0, 0.01)`;
                            e.currentTarget.style.color = PRIMARY;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#00000080';
                          }}
                        >
                          {link.DisplayName}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </nav>

          {/* Right: Login + Mobile Toggle */}
          <div className="flex items-center h-full gap-4">
            <div className="hidden md:block">
              <button
                onClick={HandleLoginButtonClicked}
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  border: 'none',
                  borderRadius: 0,
                  padding: '0.9rem 1.5rem',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                }}
                className="cok-btn-primary"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = PRIMARY_DARK;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = PRIMARY;
                }}
              >
                Login
              </button>
            </div>

            <div className="md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative flex items-center justify-center"
                style={{ width: 40, height: 40, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                aria-label={isOpen ? 'Close Menu' : 'Open Menu'}
              >
                <span 
                  className="absolute"
                  style={{ 
                    width: 20,
                    height: 2,
                    backgroundColor: isOpen ? PRIMARY : '#333333',
                    top: isOpen ? 19 : 11,
                    left: 10,
                    transform: isOpen ? 'rotate(45deg)' : 'none',
                    transformOrigin: 'center',
                    transition: 'all 0.3s ease'
                  }} 
                />
                <span 
                  className="absolute"
                  style={{ 
                    width: 20,
                    height: 2,
                    backgroundColor: isOpen ? PRIMARY : '#333333',
                    top: 19,
                    left: 10,
                    opacity: isOpen ? 0 : 1,
                    transition: 'all 0.3s ease'
                  }} 
                />
                <span 
                  className="absolute"
                  style={{ 
                    width: 20,
                    height: 2,
                    backgroundColor: isOpen ? PRIMARY : '#333333',
                    top: isOpen ? 19 : 27,
                    left: 10,
                    transform: isOpen ? 'rotate(-45deg)' : 'none',
                    transformOrigin: 'center',
                    transition: 'all 0.3s ease'
                  }} 
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 220 }}
            className="fixed inset-0 z-[9998] flex flex-col justify-between pt-24 pb-12 px-8 w-screen h-screen md:hidden"
            style={{ backgroundColor: '#F7F9FB' }}
          >
            <nav className="flex flex-col items-center justify-center gap-8 my-auto w-full">
              {NavigationLinks.map((link, index) => {
                const active = isLinkActive(link);
                return (
                  <div key={link.Link} className="relative flex flex-col items-center w-fit py-2">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, ease: "easeOut" }}
                    >
                      <Link
                        to={link.Link}
                        className="inline-block text-sm tracking-[4px] py-1 transition-all duration-300"
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontSize: '14px',
                          fontWeight: 600,
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                          color: active ? PRIMARY : '#00000080',
                          textDecoration: 'none',
                        }}
                        onClick={() => setIsOpen(false)}
                      >
                        {link.DisplayName}
                      </Link>
                    </motion.div>
                    
                    {active && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ delay: 0.15, duration: 0.35 }}
                        className="absolute bottom-0"
                        style={{ height: '2px', backgroundColor: PRIMARY }}
                      />
                    )}
                  </div>
                );
              })}
            </nav>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="w-full flex justify-center pt-4"
              style={{ borderTop: '1px solid #E0E0E0' }}
            >
              <button
                onClick={HandleLoginButtonClicked}
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: '#FFFFFF',
                  backgroundColor: PRIMARY,
                  border: 'none',
                  borderRadius: 0,
                  padding: '0.9rem 2rem',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = PRIMARY_DARK;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = PRIMARY;
                }}
              >
                Login
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
