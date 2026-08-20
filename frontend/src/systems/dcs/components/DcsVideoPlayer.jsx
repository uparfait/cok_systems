import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

function format_time(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export default function DcsVideoPlayer({ src, className }) {
  const { translate } = useDcsLanguage();
  const video_ref = useRef(null);
  const [is_playing, setIsPlaying] = useState(false);
  const [current_time, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

  const enter_fullscreen = () => {
    const video = video_ref.current;
    if (video && video.requestFullscreen) video.requestFullscreen();
  };

  return (
    <div className={className || "w-full"}>
      <video
        ref={video_ref}
        src={src}
        className="w-full"
        style={{ maxHeight: 480, backgroundColor: "#000000", display: "block" }}
        onClick={toggle_play}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.target.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.target.duration)}
        onEnded={() => setIsPlaying(false)}
      />
      <div className="flex items-center gap-3 mt-2">
        <button type="button" onClick={toggle_play} className="cok-btn-outlined flex-shrink-0" style={{ padding: "0.4rem 0.8rem" }}>
          {is_playing ? translate("DCS_BTN_PAUSE") : translate("DCS_BTN_PLAY")}
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
        <button type="button" onClick={enter_fullscreen} className="cok-btn-outlined flex-shrink-0" style={{ padding: "0.4rem 0.8rem" }}>
          {translate("DCS_BTN_FULLSCREEN")}
        </button>
      </div>
    </div>
  );
}
