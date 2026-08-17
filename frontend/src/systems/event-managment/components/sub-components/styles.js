export const editorStyles = `
  .tiptap-msword {
    font-family: Calibri, 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    color: #000;
    line-height: 1.5;
    text-align: left;
    min-height: 500px;
    height: auto;
  }
  .tiptap-msword p { margin: 0 0 8pt 0; text-align: left; }
  .tiptap-msword h1 { font-size: 20pt; color: #056daa; font-weight: 500; margin: 12pt 0 6pt; line-height: 1.2; font-family: 'Montserrat', Calibri, sans-serif; }
  .tiptap-msword h2 { font-size: 16pt; color: #056daa; font-weight: 500; margin: 10pt 0 4pt; line-height: 1.3; font-family: 'Montserrat', Calibri, sans-serif; }
  .tiptap-msword h3 { font-size: 13pt; color: #033b5c; font-weight: 600; margin: 8pt 0 4pt; line-height: 1.4; font-family: 'Montserrat', Calibri, sans-serif; }
  .tiptap-msword h4 { font-size: 11pt; color: #056daa; font-style: italic; margin: 8pt 0 4pt; line-height: 1.5; }
  .tiptap-msword ul, .tiptap-msword ol { padding-left: 24pt; margin: 0 0 8pt; }
  .tiptap-msword blockquote { border-left: 3px solid #056daa; padding: 2pt 12pt; color: #033b5c; font-style: italic; margin: 8pt 0; }
  .tiptap-msword code { background: #F7F9FB; border: 1px solid #E0E0E0; padding: 0 4px; font-family: Consolas, monospace; font-size: 10pt; }
  .tiptap-msword pre { background: #F7F9FB; border: 1px solid #E0E0E0; padding: 8px 12px; overflow-x: auto; }
  .tiptap-msword hr { border: none; border-top: 1px solid #bfbfbf; margin: 12pt 0; }
  .tiptap-msword table { border-collapse: collapse; margin: 8pt 0; width: 100%; table-layout: fixed; }
  .tiptap-msword table td, .tiptap-msword table th { border: 1px solid #bfbfbf; padding: 4pt 6pt; vertical-align: top; min-width: 24pt; position: relative; }
  .tiptap-msword table th { background: #E3F2FD; font-weight: 600; }
  .tiptap-msword .selectedCell { background: rgba(5, 109, 170, 0.12); }
  .tiptap-msword ul[data-type="taskList"] { list-style: none; padding-left: 4pt; }
  .tiptap-msword ul[data-type="taskList"] li { display: flex; gap: 6pt; }
  .tiptap-msword ul[data-type="taskList"] li > label { margin-top: 3px; }
  .tiptap-msword a { color: #056daa; text-decoration: underline; cursor: pointer; word-break: break-all; }
  .tiptap-msword a:hover { color: #033b5c; text-decoration: underline; }
  .tiptap-msword img { max-width: 100%; height: auto; display: inline-block; margin: 4pt 0; }
  .tiptap-msword img.ProseMirror-selectednode { outline: 2px solid #056daa; outline-offset: 2px; }
  .tiptap-msword ::selection { background: #cfe7f8; }
  .tiptap-msword:focus { outline: none; }
  .tiptap-msword .column-resize-handle {
    position: absolute;
    right: -2px;
    top: 0;
    bottom: 0;
    width: 4px;
    background: #056daa;
    cursor: col-resize;
    z-index: 10;
  }
  .tiptap-msword .ProseMirror-selectednode {
    outline: 2px solid #056daa;
  }
`;

// Standalone stylesheet used when printing the document in a new window
export const printStyles = `
  @page { margin: 1in; }
  body { margin: 0; }
  ${editorStyles}
  .tiptap-msword { min-height: 0; }
`;
