import React from "react";
import BaseMediaField from "./base/BaseMediaField.jsx";

/**
 * Video recording or upload field.
 */
export default function VideoField(props) {
  return <BaseMediaField {...props} accept="video/*" capture="environment" />;
}
