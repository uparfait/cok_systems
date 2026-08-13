import React from "react";
import BaseTextLikeField from "./base/BaseTextLikeField.jsx";

/**
 * Phone number entry field.
 */
export default function PhoneField(props) {
  return <BaseTextLikeField {...props} inputType="tel" />;
}
