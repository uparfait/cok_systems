import React, { useRef, useEffect, useState } from "react";
import { get_field_text } from "./fieldText.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 160;

/**
 * Handwritten signature capture on an HTML5 canvas, stored as a PNG data
 * URL exactly like the other media answers.
 */
export default function SignatureField({ field, language, mode, value, onChange, error, ruleValidMessage }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));
  const wrapper_ref = useRef(null);
  const canvas_ref = useRef(null);
  const [is_drawing, setIsDrawing] = useState(false);
  const fills_container = !!field.section_layout;

  const redraw = () => {
    const canvas = canvas_ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.src = value;
    }
  };

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Placed inside a Section: the section's own layout box determines this
  // canvas's actual drawing resolution, so it fills that box exactly
  // instead of drawing at a fixed 400x160 and leaving empty space around
  // it (or getting visually stretched/distorted by CSS instead).
  useEffect(() => {
    if (!fills_container) return undefined;
    const wrapper = wrapper_ref.current;
    const canvas = canvas_ref.current;
    if (!wrapper || !canvas) return undefined;

    const resize_canvas = () => {
      const rect = wrapper.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (canvas.width === Math.round(rect.width) && canvas.height === Math.round(rect.height)) return;
      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);
      redraw();
    };

    resize_canvas();
    const observer = new ResizeObserver(resize_canvas);
    observer.observe(wrapper);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fills_container]);

  const get_position = (event) => {
    const canvas = canvas_ref.current;
    const rect = canvas.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };

  const start_drawing = (event) => {
    if (is_builder) return;
    setIsDrawing(true);
    const context = canvas_ref.current.getContext("2d");
    const position = get_position(event);
    context.beginPath();
    context.moveTo(position.x, position.y);
  };

  const draw = (event) => {
    if (!is_drawing || is_builder) return;
    const context = canvas_ref.current.getContext("2d");
    const position = get_position(event);
    context.lineTo(position.x, position.y);
    context.strokeStyle = "#333333";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.stroke();
  };

  const stop_drawing = () => {
    if (!is_drawing) return;
    setIsDrawing(false);
    if (onChange) onChange(canvas_ref.current.toDataURL("image/png"));
  };

  const clear_signature = () => {
    const canvas = canvas_ref.current;
    const context = canvas.getContext("2d");
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (onChange) onChange(null);
  };

  return (
    <div className={fills_container ? "w-full h-full flex flex-col" : "w-full"}>
      <label className="cok-auth-label" title={help_text || undefined}>
        {label}
        {field.mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
      </label>
      <div ref={wrapper_ref} className={fills_container ? "flex-1 min-h-0" : undefined}>
        <canvas
          ref={canvas_ref}
          width={fills_container ? undefined : DEFAULT_WIDTH}
          height={fills_container ? undefined : DEFAULT_HEIGHT}
          className={fills_container ? "w-full h-full border" : "w-full border"}
          title={help_text || undefined}
          style={{ borderColor: "#E0E0E0", touchAction: "none", display: "block" }}
          onMouseDown={start_drawing}
          onMouseMove={draw}
          onMouseUp={stop_drawing}
          onMouseLeave={stop_drawing}
          onTouchStart={start_drawing}
          onTouchMove={draw}
          onTouchEnd={stop_drawing}
        />
      </div>
      <div className="mt-2">
        <DcsButtonOutline disabled={is_builder} onClick={clear_signature}>
          {translate("DCS_RENDERER_SIGNATURE_CLEAR")}
        </DcsButtonOutline>
      </div>
      {error && (
        <p className="mt-1 text-xs" style={{ color: "#E74C3C", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {error}
        </p>
      )}
      {!error && value && valid_message && (
        <p className="mt-1 text-xs" style={{ color: "#4CAF50", fontFamily: "'Montserrat', sans-serif" }}>
          {valid_message}
        </p>
      )}
    </div>
  );
}
