import React from "react";
import BaseTextLikeField from "./base/BaseTextLikeField.jsx";

/**
 * Email address entry field with native format validation.
 */
export default function EmailField(props) {
  return <BaseTextLikeField {...props} inputType="email" />;
}
