import React from "react";
import BaseTextLikeField from "./base/BaseTextLikeField.jsx";

/**
 * Time-only entry field.
 */
export default function TimeField(props) {
  return <BaseTextLikeField {...props} inputType="time" />;
}
