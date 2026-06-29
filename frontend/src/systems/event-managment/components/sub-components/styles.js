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
  .tiptap-msword h1 { font-size: 20pt; color: #2e74b5; font-weight: 400; margin: 12pt 0 6pt; line-height: 1.2; }
  .tiptap-msword h2 { font-size: 16pt; color: #2e74b5; font-weight: 400; margin: 10pt 0 4pt; line-height: 1.3; }
  .tiptap-msword h3 { font-size: 13pt; color: #1f4e79; font-weight: 600; margin: 8pt 0 4pt; line-height: 1.4; }
  .tiptap-msword h4 { font-size: 11pt; color: #2e74b5; font-style: italic; margin: 8pt 0 4pt; line-height: 1.5; }
  .tiptap-msword ul, .tiptap-msword ol { padding-left: 24pt; margin: 0 0 8pt; }
  .tiptap-msword blockquote { border-left: 3px solid #2e74b5; padding: 2pt 12pt; color: #1f4e79; font-style: italic; margin: 8pt 0; }
  .tiptap-msword code { background: #f3f2f1; border: 1px solid #e1e1e1; padding: 0 4px; border-radius: 2px; font-family: Consolas, monospace; font-size: 10pt; }
  .tiptap-msword pre { background: #f9f9f9; border: 1px solid #e1e1e1; padding: 8px 12px; border-radius: 2px; overflow-x: auto; }
  .tiptap-msword hr { border: none; border-top: 1px solid #bfbfbf; margin: 12pt 0; }
  .tiptap-msword table { border-collapse: collapse; margin: 8pt 0; width: 100%; table-layout: fixed; }
  .tiptap-msword table td, .tiptap-msword table th { border: 1px solid #bfbfbf; padding: 4pt 6pt; vertical-align: top; min-width: 24pt; position: relative; }
  .tiptap-msword table th { background: #deeaf6; font-weight: 600; }
  .tiptap-msword .selectedCell { background: rgba(43, 124, 211, 0.15); }
  .tiptap-msword ul[data-type="taskList"] { list-style: none; padding-left: 4pt; }
  .tiptap-msword ul[data-type="taskList"] li { display: flex; gap: 6pt; }
  .tiptap-msword ul[data-type="taskList"] li > label { margin-top: 3px; }
  .tiptap-msword a { color: #0563c1; text-decoration: underline; cursor: pointer; }
  .tiptap-msword a:hover { color: #034a8c; text-decoration: underline; }
  .tiptap-msword ::selection { background: #b4d5fe; }
  .tiptap-msword:focus { outline: none; }
  .tiptap-msword .column-resize-handle {
    position: absolute;
    right: -2px;
    top: 0;
    bottom: 0;
    width: 4px;
    background: #2b7cd3;
    cursor: col-resize;
    z-index: 10;
  }
  .tiptap-msword .ProseMirror-selectednode {
    outline: 2px solid #2b7cd3;
  }
`;