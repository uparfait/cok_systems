import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

export default function BookingOptions() {
  const navigate = useNavigate();
  const [trackingId, setTrackingId] = useState('');

  function handleTrack(e) {
    e.preventDefault();
    if (trackingId.trim()) {
      navigate(`/book-a-room/track?code=${encodeURIComponent(trackingId.trim())}`);
    }
  }

  return (
    <>
      <Helmet>
        <title>Booking</title>
        <meta name="description" content="Manage your room booking." />
      </Helmet>

      <main className="w-full h-max min-h-screen flex flex-col items-center   px-4 py-10">
        <div className="w-full max-w-lg">

          {/* Header */}
          <div className="text-center mb-8">
            
            <p className="text-sm tracking-wide text-zinc-500 font-medium">
              What would you like to do?
            </p>
          </div>

          <div className="flex flex-col gap-4">

            {/* Top row */}
            <div className="flex gap-4 items-stretch">

              
       

              {/* Track Your Booking */}
              <div className="flex-1 px-6 py-5 fffff-2xl bg-white border-2 border-zinc-200 flex flex-col">
                
                <p className="text-sm font-black uppercase tracking-widest text-zinc-800 mb-1">
                  Track Your Booking
                </p>
                <p className="text-xs text-zinc-400 font-medium leading-relaxed mb-3">
                  Enter your Booking ID to check status.
                </p>
                <form onSubmit={handleTrack} className="flex items-center gap-2 mt-auto">
                  <input
                    type="text"
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                    placeholder="Enter your booking id"
                    className="flex-1 min-w-0 px-3 text-center py-2 fffff-full border-2 border-zinc-200 bg-zinc-50 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3 py-2 fffff-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors duration-200 whitespace-nowrap shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                    Track
                  </button>
                </form>
              </div>

            </div>

            {/* Book Now — full width */}
            <button
              onClick={() => navigate('/book-a-room/new')}
              className="w-full flex items-center justify-between px-6 py-5 fffff-2xl bg-white border-2 border-zinc-200 hover:border-violet-400 hover:shadow-lg transition-all duration-200 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 fffff-xl bg-pink-100 group-hover:bg-pink-200 flex items-center justify-center transition-colors duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-black uppercase tracking-widest text-zinc-800 group-hover:text-violet-600 transition-colors duration-200 mb-0.5">
                   New Request
                  </p>
                  <p className="text-xs text-zinc-400 font-medium">
                    Reserve a room for your upcoming event or meeting.
                  </p>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-zinc-300 group-hover:text-violet-400 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

          </div>
        </div>
      </main>
    </>
  );
}
