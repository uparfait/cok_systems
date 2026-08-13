import React from "react";
import BaseTextLikeField from "./base/BaseTextLikeField.jsx";

/**
 * Web link entry field with native protocol validation.
 */
export default function UrlField(props) {
  return <BaseTextLikeField {...props} inputType="url" />;
}
