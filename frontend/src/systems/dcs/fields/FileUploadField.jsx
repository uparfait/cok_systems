import React from "react";
import BaseMediaField from "./base/BaseMediaField.jsx";
import { build_accept_attribute } from "./fileTypeGroups.js";

/**
 * Any document/file upload field.
 */
export default function FileUploadField(props) {
  const { field } = props;
  const accept = build_accept_attribute(field.allowed_file_type_groups) || ((field.accepted_types || []).length > 0 ? field.accepted_types.join(",") : undefined);
  return <BaseMediaField {...props} accept={accept} />;
}
