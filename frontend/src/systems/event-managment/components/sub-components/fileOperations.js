import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, AlignmentType, convertInchesToTwip } from 'docx';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function dataUrlToUint8(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function imageTypeFromDataUrl(dataUrl) {
  const mime = (dataUrl.match(/^data:image\/(\w+)/) || [])[1] || 'png';
  if (mime === 'jpeg') return 'jpg';
  if (['png', 'jpg', 'gif', 'bmp'].includes(mime)) return mime;
  return 'png';
}

// Loads an image data URL to measure its natural dimensions
function measureImage(src) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
    img.onerror = () => resolve({ width: 400, height: 300 });
    img.src = src;
  });
}

export async function exportToDocx(editor, filename = 'document') {
  if (!editor) return;

  const html = editor.getHTML();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Pre-measure embedded images so they keep their proportions in the .docx
  const imageDims = new Map();
  const imgEls = Array.from(doc.querySelectorAll('img')).filter((el) =>
    (el.getAttribute('src') || '').startsWith('data:image/'),
  );
  await Promise.all(
    imgEls.map(async (el) => {
      const src = el.getAttribute('src');
      if (!imageDims.has(src)) imageDims.set(src, await measureImage(src));
    }),
  );

  const children = [];

  const alignmentOf = (node) =>
    node.style.textAlign === 'center' ? AlignmentType.CENTER :
    node.style.textAlign === 'right' ? AlignmentType.RIGHT :
    node.style.textAlign === 'justify' ? AlignmentType.JUSTIFIED :
    AlignmentType.LEFT;

  const imageParagraph = (el) => {
    const src = el.getAttribute('src') || '';
    if (!src.startsWith('data:image/')) return null;
    try {
      const dims = imageDims.get(src) || { width: 400, height: 300 };
      const maxWidth = 600;
      const scale = dims.width > maxWidth ? maxWidth / dims.width : 1;
      return new Paragraph({
        children: [
          new ImageRun({
            data: dataUrlToUint8(src),
            type: imageTypeFromDataUrl(src),
            transformation: {
              width: Math.round(dims.width * scale),
              height: Math.round(dims.height * scale),
            },
          }),
        ],
      });
    } catch {
      return null;
    }
  };

  const textRunsOf = (node, marks = {}) => {
    const runs = [];
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        if (child.textContent) {
          runs.push(new TextRun({
            text: child.textContent,
            bold: marks.bold,
            italics: marks.italics,
            underline: marks.underline ? {} : undefined,
            strike: marks.strike,
          }));
        }
        return;
      }
      if (child.nodeType !== 1) return;
      const tag = child.tagName.toLowerCase();
      const next = { ...marks };
      if (tag === 'strong' || tag === 'b') next.bold = true;
      if (tag === 'em' || tag === 'i') next.italics = true;
      if (tag === 'u') next.underline = true;
      if (tag === 's' || tag === 'del') next.strike = true;
      runs.push(...textRunsOf(child, next));
    });
    return runs;
  };

  const processNode = (node) => {
    if (node.nodeType !== 1) {
      if (node.nodeType === 3 && node.textContent.trim()) {
        children.push(new Paragraph({ children: [new TextRun({ text: node.textContent })] }));
      }
      return;
    }

    switch (node.tagName.toLowerCase()) {
      case 'p': {
        const inlineImages = node.querySelectorAll('img');
        inlineImages.forEach((img) => {
          const p = imageParagraph(img);
          if (p) children.push(p);
        });
        const runs = textRunsOf(node);
        if (runs.length > 0 || inlineImages.length === 0) {
          children.push(new Paragraph({
            children: runs.length > 0 ? runs : [new TextRun({ text: '' })],
            alignment: alignmentOf(node),
          }));
        }
        break;
      }
      case 'h1':
        children.push(new Paragraph({ text: node.textContent, heading: HeadingLevel.HEADING_1 }));
        break;
      case 'h2':
        children.push(new Paragraph({ text: node.textContent, heading: HeadingLevel.HEADING_2 }));
        break;
      case 'h3':
        children.push(new Paragraph({ text: node.textContent, heading: HeadingLevel.HEADING_3 }));
        break;
      case 'h4':
        children.push(new Paragraph({ text: node.textContent, heading: HeadingLevel.HEADING_4 }));
        break;
      case 'img': {
        const p = imageParagraph(node);
        if (p) children.push(p);
        break;
      }
      case 'ul':
      case 'ol':
        node.querySelectorAll(':scope > li').forEach((li) => {
          children.push(new Paragraph({ text: li.textContent, bullet: { level: 0 } }));
        });
        break;
      case 'blockquote':
        children.push(new Paragraph({
          children: [new TextRun({ text: node.textContent, italics: true })],
          indent: { left: convertInchesToTwip(0.5) },
        }));
        break;
      case 'table': {
        const tableRows = [];
        node.querySelectorAll('tr').forEach((row) => {
          const cells = [];
          row.querySelectorAll('td, th').forEach((cell) => {
            cells.push(new DocxTableCell({
              children: [new Paragraph({ text: cell.textContent })],
            }));
          });
          if (cells.length > 0) tableRows.push(new DocxTableRow({ children: cells }));
        });
        if (tableRows.length > 0) {
          children.push(new DocxTable({
            rows: tableRows,
            width: { size: 100, type: 'pct' },
          }));
        }
        break;
      }
      default:
        if (node.querySelector('img')) {
          node.querySelectorAll('img').forEach((img) => {
            const p = imageParagraph(img);
            if (p) children.push(p);
          });
        } else if (node.textContent.trim()) {
          children.push(new Paragraph({ text: node.textContent }));
        }
    }
  };

  doc.body.childNodes.forEach((node) => processNode(node));

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

  const safeName = String(filename).replace(/[\\/:*?"<>|]+/g, '_').trim() || 'document';
  const blob = await Packer.toBlob(docxDoc);
  saveAs(blob, `${safeName}.docx`);
}

export function handleImport(event, editor) {
  const file = event.target.files?.[0];
  if (!file || !editor) return;

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const isDocx = ext === 'docx' || ext === 'doc' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isSheet = ['xlsx', 'xls', 'csv'].includes(ext) ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const reader = new FileReader();

  reader.onload = async (e) => {
    const content = e.target?.result;
    let html = '';

    try {
      if (isDocx) {
        // mammoth keeps headings, lists, tables AND inlines images as base64
        const result = await mammoth.convertToHtml({ arrayBuffer: content });
        html = result.value;
      } else if (isSheet) {
        const data = new Uint8Array(content);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        html = XLSX.utils.sheet_to_html(sheet);
      } else if (ext === 'md' || file.type === 'text/markdown') {
        const lines = String(content).split('\n');
        html = lines.map((line) => {
          if (line.startsWith('#### ')) return `<h4>${escapeHtml(line.slice(5))}</h4>`;
          if (line.startsWith('### ')) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
          if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
          if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
          if (line.startsWith('- ') || line.startsWith('* ')) return `<ul><li>${escapeHtml(line.slice(2))}</li></ul>`;
          if (line.trim() === '') return '';
          return `<p>${escapeHtml(line)}</p>`;
        }).join('');
      } else if (ext === 'html' || ext === 'htm' || file.type === 'text/html') {
        html = String(content);
      } else {
        // Plain text and anything else: one paragraph per line
        html = String(content)
          .split('\n')
          .map((line) => `<p>${escapeHtml(line)}</p>`)
          .join('');
      }

      if (html && editor) {
        editor.commands.setContent(html, { emitUpdate: true });
      }
    } catch (err) {
      console.error('Import failed:', err);
    }
  };

  if (isDocx || isSheet) {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }

  event.target.value = '';
}
