import React from "react";
import BaseMediaField from "./base/BaseMediaField.jsx";
import { build_accept_attribute } from "./fileTypeGroups.js";

/**
 * Photo capture or upload field.
 */
export default function ImageField(props) {
  const { field } = props;
  const accept = build_accept_attribute(field.allowed_file_type_groups) || "image/*";
  return <BaseMediaField {...props} accept={accept} capture="environment" />;
}
