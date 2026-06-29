import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

export default function Request() {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Request Room</title>
        <meta name="description" content="Request a room for your event or meeting!" />
      </Helmet>
      <main className="w-full h-max min-h-screen pt-20 flex flex-col overflow-auto items-center justify-center bg-white px-4">
        <div className="text-center max-w-md">
          <button
            onClick={() => navigate('/book-a-room/options')}
            className="mb-6 px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-sm text-white bg-gradient-to-r from-violet-600 via-pink-600 to-amber-500 hover:opacity-90 transition-opacity duration-200 shadow-md"
          >
            Booking
          </button>
          <h1 className="text-3xl font-black uppercase tracking-[4px] text-zinc-950 mb-3 bg-gradient-to-r from-violet-600 via-pink-600 to-amber-500 bg-clip-text text-transparent bg-[size:200%_auto] animate-gradient">
            Request a Room
          </h1>
          <p className="text-sm tracking-wide text-zinc-500 font-medium leading-relaxed">
            Request a room for your event or meeting!
          </p>
        </div>
      </main>
    </>
  );
}