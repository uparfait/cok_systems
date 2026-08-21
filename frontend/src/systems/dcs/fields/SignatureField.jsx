import React, { useRef, useEffect, useState } from "react";
import { get_field_text } from "./fieldText.js";
import { useMediaUpload } from "../renderer/MediaUploadContext.jsx";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 160;
const UPLOAD_DEBOUNCE_MS = 800;

/**
 * Handwritten signature capture on an HTML5 canvas, exported as a PNG blob
 * and uploaded to disk storage exactly like every other media answer -
 * never embedded as a base64 string. Each stroke updates the local canvas
 * instantly (drawing itself needs no network); the actual upload is
 * debounced so a multi-stroke signature triggers one upload shortly after
 * the respondent stops drawing, not one per stroke.
 */
export default function SignatureField({ field, language, mode, value, onChange, error, ruleValidMessage }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const media_upload = useMediaUpload();
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));
  const wrapper_ref = useRef(null);
  const canvas_ref = useRef(null);
  const upload_timer_ref = useRef(null);
  // Tracks whichever URL is currently live on disk (as opposed to a still-
  // local pending_file) so a later stroke's re-upload - or an explicit
  // Clear - knows exactly what to delete before it uploads/discards the
  // replacement, without relying on `value` still being that same shape by
  // the time the debounced upload actually fires.
  const last_uploaded_url_ref = useRef(null);
  const [is_drawing, setIsDrawing] = useState(false);
  const [is_uploading, setIsUploading] = useState(false);
  const [upload_percent, setUploadPercent] = useState(0);
  const [is_deleting_old, setIsDeletingOld] = useState(false);
  const fills_container = !!field.section_layout;
  const is_pending_upload = !!value && typeof value === "object" && value.status === "pending_upload";

  useEffect(() => {
    if (value && typeof value === "object" && value.url) last_uploaded_url_ref.current = value.url;
  }, [value]);

  const get_display_src = () => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (value.url) return value.url;
    return null;
  };

  const redraw = () => {
    const canvas = canvas_ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const src = get_display_src();
    if (src) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.src = src;
    } else if (is_pending_upload && value.pending_file) {
      const object_url = URL.createObjectURL(value.pending_file);
      const image = new Image();
      image.onload = () => {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(object_url);
      };
      image.src = object_url;
    }
  };

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { if (upload_timer_ref.current) clearTimeout(upload_timer_ref.current); }, []);

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

  // The canvas's own drawing resolution (canvas.width/height, the
  // coordinate space every draw call uses) is not necessarily the same as
  // its rendered CSS size (rect.width/height, e.g. stretched by "w-full").
  // Using the raw CSS-pixel offset directly as a drawing coordinate only
  // lined up with the cursor when those two happened to match; otherwise
  // the stroke was drawn scaled and offset from wherever was actually
  // clicked. Scaling the offset by the canvas-to-CSS ratio keeps the ink
  // exactly under the pointer regardless of how the canvas is stretched.
  const get_position = (event) => {
    const canvas = canvas_ref.current;
    const rect = canvas.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    const scale_x = canvas.width / rect.width;
    const scale_y = canvas.height / rect.height;
    return { x: (point.clientX - rect.left) * scale_x, y: (point.clientY - rect.top) * scale_y };
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

  const upload_signature = async (file) => {
    if (!media_upload.is_online) return;
    const previous_url = last_uploaded_url_ref.current;
    if (previous_url) {
      setIsDeletingOld(true);
      await media_upload.delete_file(previous_url);
      last_uploaded_url_ref.current = null;
      setIsDeletingOld(false);
    }
    setIsUploading(true);
    setUploadPercent(0);
    try {
      const uploaded = await media_upload.upload_file(field.id, file, setUploadPercent);
      onChange({ name: uploaded.name, type: uploaded.type, size: uploaded.size, url: uploaded.url });
    } catch (upload_error) {
      // Left as pending_upload - the background sync loop retries it once
      // the queue processes this record, and the next stroke's debounce
      // will also naturally retry if the respondent keeps drawing.
    } finally {
      setIsUploading(false);
    }
  };

  const stop_drawing = () => {
    if (!is_drawing) return;
    setIsDrawing(false);
    if (!onChange) return;

    canvas_ref.current.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "signature.png", { type: "image/png" });
      onChange({ name: "signature.png", type: "image/png", size: file.size, pending_file: file, status: "pending_upload" });
      if (upload_timer_ref.current) clearTimeout(upload_timer_ref.current);
      upload_timer_ref.current = setTimeout(() => upload_signature(file), UPLOAD_DEBOUNCE_MS);
    }, "image/png");
  };

  const clear_signature = async () => {
    if (upload_timer_ref.current) clearTimeout(upload_timer_ref.current);
    if (last_uploaded_url_ref.current) {
      setIsDeletingOld(true);
      await media_upload.delete_file(last_uploaded_url_ref.current);
      last_uploaded_url_ref.current = null;
      setIsDeletingOld(false);
    }
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
      <div className="mt-2 flex items-center gap-3 flex-wrap">
        <DcsButtonOutline disabled={is_builder || is_uploading || is_deleting_old} onClick={clear_signature}>
          {translate("DCS_RENDERER_SIGNATURE_CLEAR")}
        </DcsButtonOutline>
        {is_deleting_old && (
          <span className="text-xs" style={{ color: "#9E9E9E" }}>
            {translate("DCS_WAITING_GENERIC")}
          </span>
        )}
        {is_uploading && (
          <span className="text-xs" style={{ color: "#056daa" }}>
            {translate("DCS_UPLOADING_PERCENT", { percent: upload_percent })}
          </span>
        )}
        {is_pending_upload && !is_uploading && !is_deleting_old && (
          <span className="text-xs font-semibold px-2 py-0.5" style={{ color: "#FFFFFF", backgroundColor: "#F5A623" }}>
            {translate("DCS_UPLOAD_PENDING_OFFLINE")}
          </span>
        )}
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
