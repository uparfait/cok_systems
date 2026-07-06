import { Outlet, useNavigate, Link } from "react-router-dom";
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
    <div className="w-[1126px] max-w-full mx-auto text-center h-screen flex flex-col box-border  items-center">
      {/* Navigation */}

      <div className="fixed z-[1000] pt-[10px]  left-1/2 -translate-x-1/2 h-16 backdrop-blur-md w-full max-w-[1126px] min-[1126px]:w-[90%]  flex items-center justify-center">
       <IndexHeader />
      </div>

      {/* Pages */}

<div className="w-full  relative flex flex-col items-center p-4">
         <div className="w-full h-[100px] justify-center items-center relative h-[150px]  bg-transparent">
             <span className="w-4 h-4 bg-red-500 rounded-full inline-block mr-2"></span>
             <span className="w-4 h-4 bg-blue-500 rounded-full inline-block mr-2"></span>
             <span className="w-4 h-4 bg-green-500 rounded-full inline-block"></span>
         </div>
          <Outlet context={{LiveEventsData, setLiveEventsData, UpcomingEventsData, setUpcomingEventsData, activeEvent, setActiveEvent}} />
       </div>

       <Link 
         to="/feedback" 
         className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
         title="View Your Service History & Feedback"
       >
         <FiMessageSquare className="w-5 h-5" />
         <span className="text-sm font-medium hidden sm:inline">Feedback</span>
       </Link>
     </div>
  );
}
