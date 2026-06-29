import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, AlignmentType, convertInchesToTwip } from 'docx';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export async function exportToDocx(editor) {
  if (!editor) return;
  
  const html = editor.getHTML();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const children = [];
  
  const processNode = (node) => {
    if (node.nodeType === 3) {
      return new TextRun({ text: node.textContent });
    }
    
    if (node.nodeType === 1) {
      switch (node.tagName.toLowerCase()) {
        case 'p':
          const runs = [];
          node.childNodes.forEach(child => {
            const run = processNode(child);
            if (run) runs.push(run);
          });
          children.push(new Paragraph({
            children: runs.length > 0 ? runs : [new TextRun({ text: '' })],
            alignment: node.style.textAlign === 'center' ? AlignmentType.CENTER :
                      node.style.textAlign === 'right' ? AlignmentType.RIGHT :
                      node.style.textAlign === 'justify' ? AlignmentType.JUSTIFIED :
                      AlignmentType.LEFT,
          }));
          break;
        case 'h1':
          children.push(new Paragraph({ text: node.textContent, heading: HeadingLevel.HEADING_1 }));
          break;
        case 'h2':
          children.push(new Paragraph({ text: node.textContent, heading: HeadingLevel.HEADING_2 }));
          break;
        case 'ul':
        case 'ol':
          node.childNodes.forEach(li => {
            children.push(new Paragraph({ text: li.textContent, bullet: { level: 0 } }));
          });
          break;
        case 'table':
          const tableRows = [];
          node.querySelectorAll('tr').forEach(row => {
            const cells = [];
            row.querySelectorAll('td, th').forEach(cell => {
              cells.push(new DocxTableCell({
                children: [new Paragraph({ text: cell.textContent })],
              }));
            });
            tableRows.push(new DocxTableRow({ children: cells }));
          });
          children.push(new DocxTable({
            rows: tableRows,
            width: { size: 100, type: 'pct' },
          }));
          break;
        default:
          if (node.textContent.trim()) {
            children.push(new Paragraph({ text: node.textContent }));
          }
      }
    }
    
    return null;
  };
  
  doc.body.childNodes.forEach(node => processNode(node));
  
  const docxDoc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
          },
        },
      },
      children: children,
    }],
  });
  
  const blob = await Packer.toBlob(docxDoc);
  saveAs(blob, 'document.docx');
}

export function handleImport(event, editor) {
  const file = event.target.files?.[0];
  if (!file || !editor) return;
  
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    const content = e.target?.result;
    let html = '';
    
    switch (file.type) {
      case 'text/plain':
        html = `<p>${content}</p>`;
        break;
      case 'text/markdown':
        const text = content;
        const lines = text.split('\n');
        html = lines.map(line => {
          if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
          if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
          if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
          if (line.trim() === '') return '<br>';
          return `<p>${line}</p>`;
        }).join('');
        break;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        html = result.value;
        break;
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        const data = new Uint8Array(content);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        html = XLSX.utils.sheet_to_html(sheet);
        break;
      case 'text/html':
        html = content;
        break;
      default:
        if (typeof content === 'string') {
          html = `<p>${content}</p>`;
        }
    }
    
    if (html && editor) {
      editor.commands.setContent(html);
    }
  };
  
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }
  
  event.target.value = '';
}