import React from "react";
import BaseTextLikeField from "./base/BaseTextLikeField.jsx";

/**
 * Combined date and time entry field.
 */
export default function DateTimeField(props) {
  return <BaseTextLikeField {...props} inputType="datetime-local" />;
}
