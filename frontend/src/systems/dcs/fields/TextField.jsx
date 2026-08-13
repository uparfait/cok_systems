import React from "react";
import BaseTextLikeField from "./base/BaseTextLikeField.jsx";

/**
 * Free text entry field.
 */
export default function TextField(props) {
  const { field } = props;
  return (
    <BaseTextLikeField
      {...props}
      inputType="text"
      extraInputProps={{ maxLength: field.max_length || undefined, minLength: field.min_length || undefined }}
    />
  );
}
