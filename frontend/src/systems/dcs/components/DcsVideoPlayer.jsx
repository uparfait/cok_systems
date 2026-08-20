import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

function format_time(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export default function DcsVideoPlayer({ src, className, fill }) {
  const { translate } = useDcsLanguage();
  const video_ref = useRef(null);
  const [is_playing, setIsPlaying] = useState(false);
  const [current_time, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [is_hovering, setIsHovering] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const toggle_play = () => {
    const video = video_ref.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const handle_seek = (event) => {
    const video = video_ref.current;
    const next_time = Number(event.target.value);
    if (video) video.currentTime = next_time;
    setCurrentTime(next_time);
  };

  const show_controls = is_hovering || !is_playing;

  return (
    <div
      className={fill ? "relative w-full h-full" : className || "relative w-full"}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <video
        ref={video_ref}
        src={src}
        className={fill ? "w-full h-full" : "w-full"}
        style={fill ? { objectFit: "contain", backgroundColor: "#000000", display: "block" } : { maxHeight: 480, backgroundColor: "#000000", display: "block" }}
        onClick={toggle_play}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.target.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.target.duration)}
        onEnded={() => setIsPlaying(false)}
      />
      {show_controls && (
        <div
          className="absolute left-0 right-0 bottom-0 flex items-center gap-3 px-3 py-2"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          <button
            type="button"
            onClick={toggle_play}
            title={is_playing ? translate("DCS_BTN_PAUSE") : translate("DCS_BTN_PLAY")}
            className="flex-shrink-0 cursor-pointer flex items-center justify-center"
            style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            {is_playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#FFFFFF">
                <rect x="6" y="5" width="4" height="14" />
                <rect x="14" y="5" width="4" height="14" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#FFFFFF">
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
            style={{ accentColor: "#FFFFFF" }}
          />
          <span className="text-xs flex-shrink-0" style={{ color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif" }}>
            {format_time(current_time)} / {format_time(duration)}
          </span>
        </div>
      )}
    </div>
  );
}
