import React from "react";
import BaseTextLikeField from "./base/BaseTextLikeField.jsx";

/**
 * Numeric entry field with min/max bounds.
 */
export default function NumberField(props) {
  const { field } = props;
  return (
    <BaseTextLikeField
      {...props}
      inputType="number"
      extraInputProps={{ min: field.min_value ?? undefined, max: field.max_value ?? undefined }}
    />
  );
}
