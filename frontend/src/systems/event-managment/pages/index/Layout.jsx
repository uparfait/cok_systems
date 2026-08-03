import { Outlet, useNavigate } from "react-router-dom";
import IndexHeader from "./components/IndexHeader";
import { useEffect, useState } from "react";
import { FiMessageSquare } from "react-icons/fi";

export default function Layout() {

  const [LiveEventsData, setLiveEventsData] = useState([]);
  const [UpcomingEventsData, setUpcomingEventsData] = useState([]);
  const [count, setCount] = useState(1)
  const [activeEvent, setActiveEvent] = useState({});
  const navigate = useNavigate();

  useEffect(()=> {

    //   <Link to={`/event/${event.eventSpecialId}/details`} className="relative w-max  h-max">

    if(activeEvent?.eventSpecialId) {
      navigate(`/event/${activeEvent?.eventSpecialId}/details`)
    }

  }, [activeEvent]);

useEffect(() => {


  // 1. Create the interval
  const ReloadData = setInterval(() => {
    if (typeof window !== 'undefined' && typeof window.ACTIVE_FUNCTION === 'function') {
      window.ACTIVE_FUNCTION();
      
      // Use the functional state updater so you don't rely on a stale closure
      setCount((prevCount) => {
        console.log(`Executing Function: ${window['ACTIVE_FUNCTION'].name}\nOverall Count: ${prevCount + 1}`)
        return prevCount + 1;
      });
    }
    // Re-calling after 10 seconds.
  }, 10000);

  // 2. CRITICAL: Clear the interval when dependencies change or component unmounts
  return () => clearInterval(ReloadData);

// Added count to dependencies so the log/state updates perfectly reflect reality
}, [LiveEventsData, UpcomingEventsData, count]);



  return (
    <div className="w-full text-center min-h-screen h-max flex flex-col box-border items-center">
      {/* Navigation */}

      <div className="fixed z-[1000] pt-[10px]  left-1/2 -translate-x-1/2 h-16  w-full   flex items-center justify-center">
       <IndexHeader />
      </div>

      {/* Pages */}

<div className="w-full bg-transparent relative flex flex-col pt-13 h-max items-center pb-[50px]">
          <Outlet context={{LiveEventsData, setLiveEventsData, UpcomingEventsData, setUpcomingEventsData, activeEvent, setActiveEvent}} />
       </div>

        <button
          onClick={() => navigate("/feedback")}
          className="fixed bottom-10 right-6 z-50 flex items-center gap-2 cursor-pointer bg-[#056daa] text-white px-4 py-3 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
          title="Submit Feedback"
        >
          <FiMessageSquare className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Feedback</span>
        </button>


       {/* fotter */}

      <footer style={{
          backgroundColor: '#078ece',
          padding: '0px 20px 0 20px',
          color: '#FFFFFF',
          width: '100%',
          marginTop: 'auto'
        }}>
          
        
          
          <div style={{
            backgroundColor: '#2980B9',
            padding: '2rem 0 1rem',
            textAlign: 'center',
            marginLeft: '-20px',
            marginRight: '-20px'
          }}>
            <p style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: '14px',
              color: '#FFFFFF',
              margin: 0
            }}>&copy; {new Date().getFullYear()} <a href="#" style={{ color: '#FFFFFF', fontWeight: 600, textDecoration: 'none' }}>City of Kigali</a>. All Rights Reserved.</p>
          </div>
        </footer>
     </div>
  );
}
