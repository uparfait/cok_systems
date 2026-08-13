import React from "react";
import BaseMediaField from "./base/BaseMediaField.jsx";

/**
 * Photo capture or upload field.
 */
export default function ImageField(props) {
  return <BaseMediaField {...props} accept="image/*" capture="environment" previewKind="image" />;
}
