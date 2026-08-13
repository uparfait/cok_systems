import React, { useRef, useEffect, useState } from "react";
import { get_field_text } from "./fieldText.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

/**
 * Handwritten signature capture on an HTML5 canvas, stored as a PNG data
 * URL exactly like the other media answers.
 */
export default function SignatureField({ field, language, mode, value, onChange, error }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const label = get_field_text(field.label, language);
  const canvas_ref = useRef(null);
  const [is_drawing, setIsDrawing] = useState(false);

  useEffect(() => {
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
  }, []);

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
    <div className="w-full">
      <label className="cok-auth-label">
        {label}
        {field.mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
      </label>
      <canvas
        ref={canvas_ref}
        width={400}
        height={160}
        className="w-full border"
        style={{ borderColor: "#E0E0E0", touchAction: "none" }}
        onMouseDown={start_drawing}
        onMouseMove={draw}
        onMouseUp={stop_drawing}
        onMouseLeave={stop_drawing}
        onTouchStart={start_drawing}
        onTouchMove={draw}
        onTouchEnd={stop_drawing}
      />
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
    </div>
  );
}
