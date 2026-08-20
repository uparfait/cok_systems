import React from "react";
import { split_text_into_link_segments } from "../fields/textLinkSegments.js";

export default function DcsLinkedText({ text, links }) {
  return split_text_into_link_segments(text, links).map((segment, index) =>
    segment.href ? (
      <a
        key={index}
        href={segment.href}
        target="_blank"
        rel="noreferrer"
        style={{ color: "#0645AD", textDecoration: "underline" }}
      >
        {segment.text}
      </a>
    ) : (
      <React.Fragment key={index}>{segment.text}</React.Fragment>
    ),
  );
}
