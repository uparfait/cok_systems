import React from "react";
import BaseMediaField from "./base/BaseMediaField.jsx";

/**
 * Any document/file upload field.
 */
export default function FileUploadField(props) {
  const { field } = props;
  const accept = (field.accepted_types || []).length > 0 ? field.accepted_types.join(",") : undefined;
  return <BaseMediaField {...props} accept={accept} previewKind="file" />;
}
