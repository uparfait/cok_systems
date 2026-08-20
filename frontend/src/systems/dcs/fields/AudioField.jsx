import React from "react";
import BaseMediaField from "./base/BaseMediaField.jsx";

/**
 * Voice recording or audio upload field.
 */
export default function AudioField(props) {
  return <BaseMediaField {...props} accept="audio/*" capture="environment" />;
}
