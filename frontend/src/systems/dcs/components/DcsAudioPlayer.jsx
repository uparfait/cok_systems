import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

function format_time(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export default function DcsAudioPlayer({ src, className }) {
  const { translate } = useDcsLanguage();
  const audio_ref = useRef(null);
  const [is_playing, setIsPlaying] = useState(false);
  const [current_time, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const toggle_play = () => {
    const audio = audio_ref.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  };

  const handle_seek = (event) => {
    const audio = audio_ref.current;
    const next_time = Number(event.target.value);
    if (audio) audio.currentTime = next_time;
    setCurrentTime(next_time);
  };

  return (
    <div className={className || "w-full"} style={{ border: "1px solid #E0E0E0", padding: "0.75rem 1rem", backgroundColor: "#FFFFFF" }}>
      <audio
        ref={audio_ref}
        src={src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.target.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.target.duration)}
        onEnded={() => setIsPlaying(false)}
        style={{ display: "none" }}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle_play}
          title={is_playing ? translate("DCS_BTN_PAUSE") : translate("DCS_BTN_PLAY")}
          className="flex-shrink-0 cursor-pointer flex items-center justify-center"
          style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #056daa" }}
        >
          {is_playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#056daa">
              <rect x="6" y="5" width="4" height="14" />
              <rect x="14" y="5" width="4" height="14" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#056daa">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current_time}
          onChange={handle_seek}
          className="w-full"
          style={{ accentColor: "#056daa" }}
        />
        <span className="text-xs flex-shrink-0" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
          {format_time(current_time)} / {format_time(duration)}
        </span>
      </div>
    </div>
  );
}
