import React from "react";
import BaseTextLikeField from "./base/BaseTextLikeField.jsx";

/**
 * Calendar date entry field.
 */
export default function DateField(props) {
  const { field } = props;
  return (
    <BaseTextLikeField
      {...props}
      inputType="date"
      extraInputProps={{ min: field.min_date || undefined, max: field.max_date || undefined }}
    />
  );
}
