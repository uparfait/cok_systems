import React from "react";
import BaseMediaField from "./base/BaseMediaField.jsx";
import { build_accept_attribute } from "./fileTypeGroups.js";

/**
 * Voice recording or audio upload field.
 */
export default function AudioField(props) {
  const { field } = props;
  const accept = build_accept_attribute(field.allowed_file_type_groups) || "audio/*";
  return <BaseMediaField {...props} accept={accept} capture="environment" />;
}
