import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, AlignmentType, convertInchesToTwip, PageBreak as DocxPageBreak } from 'docx';
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

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

// The text of one PDF page as editable paragraphs, with basic bold/size
// hints kept from the original fonts
async function pdfPageToTextHtml(page) {
  const textContent = await page.getTextContent();
  const lines = [];
  let line = '';
  let lastY = null;
  textContent.items.forEach((item) => {
    const y = item.transform?.[5];
    if (lastY !== null && y !== lastY && line.trim()) { lines.push(line); line = ''; }
    line += item.str;
    if (item.hasEOL) { lines.push(line); line = ''; }
    lastY = y;
  });
  if (line.trim()) lines.push(line);
  return lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
}

// Resolves a decoded image object from the page (or document) object store
function resolvePdfObject(page, objId) {
  const store = String(objId).startsWith('g_') ? page.commonObjs : page.objs;
  return new Promise((resolve) => {
    try {
      if (store.has(objId)) return resolve(store.get(objId));
      store.get(objId, (data) => resolve(data));
    } catch {
      resolve(null);
    }
  });
}

// Turns a decoded pdf.js image object into a data URL
function pdfImageToDataUrl(img) {
  try {
    if (!img) return null;
    const width = img.width || img.bitmap?.width;
    const height = img.height || img.bitmap?.height;
    if (!width || !height || width < 20 || height < 20) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (img.bitmap) {
      ctx.drawImage(img.bitmap, 0, 0);
    } else if (img.data) {
      const bytes = img.data;
      const imageData = ctx.createImageData(width, height);
      const out = imageData.data;
      if (bytes.length === width * height * 4) {
        out.set(bytes);
      } else if (bytes.length === width * height * 3) {
        for (let i = 0, j = 0; j < bytes.length; i += 4, j += 3) {
          out[i] = bytes[j]; out[i + 1] = bytes[j + 1]; out[i + 2] = bytes[j + 2]; out[i + 3] = 255;
        }
      } else if (bytes.length === width * height) {
        for (let i = 0, j = 0; j < bytes.length; i += 4, j++) {
          out[i] = bytes[j]; out[i + 1] = bytes[j]; out[i + 2] = bytes[j]; out[i + 3] = 255;
        }
      } else {
        return null;
      }
      ctx.putImageData(imageData, 0, 0);
    } else {
      return null;
    }
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

// Extracts the embedded pictures of one PDF page so they stay in the document
async function extractPdfPageImages(page, pdfjs, ops) {
  const opList = ops || await page.getOperatorList();
  const seen = new Set();
  const srcs = [];
  for (let i = 0; i < opList.fnArray.length; i++) {
    if (opList.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue;
    const objId = opList.argsArray[i]?.[0];
    if (!objId || seen.has(objId)) continue;
    seen.add(objId);
    const obj = await resolvePdfObject(page, objId);
    const src = pdfImageToDataUrl(obj);
    if (src) srcs.push(src);
  }
  return srcs;
}

// Layout-aware reconstruction of one PDF page: keeps font sizes, bold and
// italic runs, centered/right alignment, blank-line spacing, rebuilds
// column-aligned rows as real tables, and keeps the page's pictures
async function pdfPageToRichHtml(page, pdfjs) {
  // getOperatorList also loads the fonts and image objects we resolve below
  const ops = await page.getOperatorList();
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });

  // Real font names (e.g. "Arial-BoldMT") live in the object store
  const fontFlags = new Map();
  const fontIds = [...new Set(textContent.items.map((i) => i.fontName).filter(Boolean))];
  await Promise.all(fontIds.map(async (id) => {
    const font = await Promise.race([
      resolvePdfObject(page, id),
      new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    const name = font?.name || '';
    fontFlags.set(id, {
      bold: /bold|black|heavy|semibold/i.test(name),
      italic: /italic|oblique/i.test(name),
    });
  }));

  // Runs: positioned text fragments in user-space coordinates (points)
  const runs = [];
  textContent.items.forEach((it) => {
    if (!it.str || !it.str.trim() || !Array.isArray(it.transform)) return;
    const size = Math.hypot(it.transform[2], it.transform[3]) || 10;
    runs.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0, size, fontName: it.fontName });
  });
  if (runs.length === 0) {
    const images = await extractPdfPageImages(page, pdfjs, ops);
    return images.map((src) => `<p><img src="${src}" alt="" /></p>`).join('');
  }

  // Group into lines (top of the page first), then split lines into segments
  // wherever a wide horizontal gap suggests a column boundary
  runs.sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines = [];
  runs.forEach((r) => {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line.y - r.y) <= Math.max(2, line.size * 0.35)) {
      line.runs.push(r);
      line.size = Math.max(line.size, r.size);
    } else {
      lines.push({ y: r.y, size: r.size, runs: [r] });
    }
  });
  lines.forEach((line) => {
    line.runs.sort((a, b) => a.x - b.x);
    const segs = [];
    line.runs.forEach((r) => {
      const seg = segs[segs.length - 1];
      const last = seg?.runs[seg.runs.length - 1];
      const gap = last ? r.x - (last.x + last.w) : 0;
      if (seg && gap <= Math.max(8, line.size * 1.2)) {
        r.leadingSpace = gap > line.size * 0.18;
        seg.runs.push(r);
        seg.right = Math.max(seg.right, r.x + r.w);
      } else {
        segs.push({ x: r.x, right: r.x + r.w, runs: [r] });
      }
    });
    line.segs = segs;
    line.left = segs[0].x;
    line.right = segs[segs.length - 1].right;
  });

  const sizeCounts = new Map();
  runs.forEach((r) => {
    const s = Math.round(r.size);
    sizeCounts.set(s, (sizeCounts.get(s) || 0) + r.str.length);
  });
  const baseSize = [...sizeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 11;
  const contentLeft = Math.min(...lines.map((l) => l.left));
  const contentRight = Math.max(...lines.map((l) => l.right));

  const runHtml = (r) => {
    let t = escapeHtml(r.str);
    const f = fontFlags.get(r.fontName) || {};
    if (f.italic) t = `<em>${t}</em>`;
    if (f.bold) t = `<strong>${t}</strong>`;
    const sz = Math.round(r.size);
    if (Math.abs(sz - baseSize) >= 2) t = `<span style="font-size: ${sz}pt">${t}</span>`;
    return (r.leadingSpace ? ' ' : '') + t;
  };
  const segHtml = (seg) => seg.runs.map(runHtml).join('');

  // Consecutive lines whose segments start at aligned x positions are a table
  const isTableRowPair = (a, b) => {
    if (a.segs.length < 2 || b.segs.length < 2) return false;
    if (a.y - b.y > Math.max(a.size, b.size) * 2.6) return false;
    let shared = 0;
    b.segs.forEach((sb) => {
      if (a.segs.some((sa) => Math.abs(sa.x - sb.x) <= 14)) shared += 1;
    });
    return shared >= 2;
  };

  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const group = [lines[i]];
    while (i + group.length < lines.length && isTableRowPair(group[group.length - 1], lines[i + group.length])) {
      group.push(lines[i + group.length]);
    }
    if (group.length >= 2) {
      blocks.push({ type: 'table', lines: group });
      i += group.length;
    } else {
      blocks.push({ type: 'line', line: lines[i] });
      i += 1;
    }
  }

  const parts = [];
  let lastY = null;
  blocks.forEach((block) => {
    const first = block.type === 'table' ? block.lines[0] : block.line;
    // A tall vertical gap in the original becomes an empty paragraph
    if (lastY !== null && lastY - first.y > first.size * 2.4) parts.push('<p></p>');
    lastY = block.type === 'table' ? block.lines[block.lines.length - 1].y : first.y;

    if (block.type === 'table') {
      // Cluster segment x positions into columns
      const xs = [];
      block.lines.forEach((l) => l.segs.forEach((s) => xs.push(s.x)));
      xs.sort((a, b) => a - b);
      const cols = [];
      xs.forEach((x) => {
        const c = cols[cols.length - 1];
        if (c && x - c.max <= 14) { c.max = x; c.sum += x; c.n += 1; } else cols.push({ max: x, sum: x, n: 1 });
      });
      const colX = cols.map((c) => c.sum / c.n);
      const rowsHtml = block.lines.map((l) => {
        const cells = colX.map(() => '');
        l.segs.forEach((s) => {
          let best = 0;
          colX.forEach((cx, ci) => { if (Math.abs(s.x - cx) < Math.abs(s.x - colX[best])) best = ci; });
          cells[best] += (cells[best] ? ' ' : '') + segHtml(s);
        });
        return `<tr>${cells.map((c) => `<td><p>${c || ''}</p></td>`).join('')}</tr>`;
      }).join('');
      parts.push(`<table><tbody>${rowsHtml}</tbody></table>`);
      return;
    }

    const line = block.line;
    const inner = line.segs.map(segHtml).join('&nbsp;&nbsp;&nbsp;&nbsp;');
    let align = '';
    if (line.segs.length === 1 && line.left - contentLeft > 30) {
      const lineCenter = (line.left + line.right) / 2;
      const pageCenter = (contentLeft + contentRight) / 2;
      if (Math.abs(lineCenter - pageCenter) <= 25) align = 'center';
      else if (contentRight - line.right <= 15) align = 'right';
    }
    parts.push(`<p${align ? ` style="text-align: ${align}"` : ''}>${inner}</p>`);
  });

  const images = await extractPdfPageImages(page, pdfjs, ops);
  parts.push(...images.map((src) => `<p><img src="${src}" alt="" /></p>`));

  return parts.join('');
}

// Opens a PDF as an editable document that respects the original design:
// font sizes, bold/italic, alignment, tables and pictures are reconstructed,
// and pages are separated by page breaks (so pages can be added or deleted)
export async function pdfBufferToHtml(arrayBuffer) {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const parts = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    let pageHtml = '';
    try {
      pageHtml = await pdfPageToRichHtml(page, pdfjs);
    } catch (err) {
      console.error(`PDF page ${p} rich conversion failed, falling back to plain text:`, err);
      try { pageHtml = await pdfPageToTextHtml(page); } catch { pageHtml = ''; }
    }
    parts.push(pageHtml || '<p></p>');
  }
  const html = parts.join('<div data-page-break="true"></div>');
  return html.trim() ? html : '<p>(This PDF has no readable pages)</p>';
}

// Flattens editor HTML to plain text, one line per block (used to save .txt/.md/.csv files)
export function htmlToPlainText(html) {
  const parsed = new DOMParser().parseFromString(
    String(html || '').replace(/<br\s*\/?>/gi, '\n'),
    'text/html',
  );
  const out = [];
  parsed.body.querySelectorAll('p,h1,h2,h3,h4,li,pre,blockquote,tr').forEach((el) => {
    if (el.tagName === 'LI' && el.querySelector('p')) return;
    if (el.closest('tr') && el.tagName !== 'TR') return;
    if (el.tagName === 'TR') {
      out.push(Array.from(el.querySelectorAll('td,th')).map((c) => c.textContent.trim()).join(','));
      return;
    }
    out.push(el.textContent);
  });
  if (out.length === 0) out.push(parsed.body.textContent || '');
  return out.join('\n');
}

// Renders editor HTML into a real PDF file (text-based layout)
export async function htmlToPdfBlob(html) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 72;
  const maxW = pageW - margin * 2;
  const sizes = { h1: 20, h2: 16, h3: 14, h4: 12, p: 11, li: 11, blockquote: 11, pre: 10 };

  const blocks = [];
  const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const walk = (node) => {
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      if (src.startsWith('data:image/')) blocks.push({ tag: 'img', src });
      return;
    }
    if (['h1', 'h2', 'h3', 'h4', 'p', 'li', 'blockquote', 'pre'].includes(tag)) {
      // Blocks holding images keep the images in place of their text
      const imgs = node.querySelectorAll('img');
      if (imgs.length > 0) {
        imgs.forEach((img) => {
          const src = img.getAttribute('src') || '';
          if (src.startsWith('data:image/')) blocks.push({ tag: 'img', src });
        });
      }
      if (tag === 'li' && node.querySelector('p')) {
        const text = node.textContent.replace(/\s+/g, ' ').trim();
        if (text) blocks.push({ tag: 'li', text: `- ${text}` });
        return;
      }
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (text || imgs.length === 0) blocks.push({ tag, text: tag === 'li' ? `- ${text}` : text });
      return;
    }
    if (tag === 'table') {
      node.querySelectorAll('tr').forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('td,th')).map((c) => c.textContent.trim());
        blocks.push({ tag: 'p', text: cells.join('   ') });
      });
      return;
    }
    if (tag === 'hr') { blocks.push({ tag: 'hr' }); return; }
    if (tag === 'div' && node.hasAttribute('data-page-break')) { blocks.push({ tag: 'pagebreak' }); return; }
    node.childNodes.forEach(walk);
  };
  parsed.body.childNodes.forEach(walk);

  // Pre-measure images so they keep their proportions in the PDF
  const imageDims = new Map();
  await Promise.all(
    blocks.filter((b) => b.tag === 'img').map(async (b) => {
      if (!imageDims.has(b.src)) imageDims.set(b.src, await measureImage(b.src));
    }),
  );

  let y = margin;
  blocks.forEach((b) => {
    if (b.tag === 'pagebreak') {
      doc.addPage();
      y = margin;
      return;
    }
    if (b.tag === 'img') {
      const dims = imageDims.get(b.src) || { width: 400, height: 300 };
      const scale = Math.min(maxW / dims.width, 1);
      const w = dims.width * scale;
      const h = dims.height * scale;
      const format = /^data:image\/jpe?g/i.test(b.src) ? 'JPEG' : 'PNG';
      let drawH = h;
      let drawW = w;
      const maxH = pageH - margin * 2;
      if (drawH > maxH) { const s = maxH / drawH; drawH *= s; drawW *= s; }
      if (y + drawH > pageH - margin) { doc.addPage(); y = margin; }
      try {
        doc.addImage(b.src, format, margin, y, drawW, drawH);
        y += drawH + 12;
      } catch (err) {
        console.error('PDF image embed failed:', err);
      }
      return;
    }
    if (b.tag === 'hr') {
      if (y > pageH - margin) { doc.addPage(); y = margin; }
      doc.setDrawColor(180);
      doc.line(margin, y, pageW - margin, y);
      y += 16;
      return;
    }
    const size = sizes[b.tag] || 11;
    const bold = ['h1', 'h2', 'h3', 'h4'].includes(b.tag);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(b.text || ' ', maxW);
    lines.forEach((line) => {
      if (y > pageH - margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += size * 1.4;
    });
    y += size * 0.4;
  });

  return doc.output('blob');
}

export async function buildDocxBlob(html) {
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

    if (node.tagName.toLowerCase() === 'div' && node.hasAttribute('data-page-break')) {
      children.push(new Paragraph({ children: [new DocxPageBreak()] }));
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

  return Packer.toBlob(docxDoc);
}

export async function exportToDocx(editor, filename = 'document') {
  if (!editor) return;
  const blob = await buildDocxBlob(editor.getHTML());
  const safeName = String(filename).replace(/[\\/:*?"<>|]+/g, '_').trim() || 'document';
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
  const isPdf = ext === 'pdf' || file.type === 'application/pdf';

  const reader = new FileReader();

  reader.onload = async (e) => {
    const content = e.target?.result;
    let html = '';

    try {
      if (isDocx) {
        // mammoth keeps headings, lists, tables AND inlines images as base64
        const result = await mammoth.convertToHtml({ arrayBuffer: content });
        html = result.value;
      } else if (isPdf) {
        // PDFs must go through text extraction; reading them as text
        // would dump raw binary into the document
        html = await pdfBufferToHtml(content);
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

  if (isDocx || isSheet || isPdf) {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }

  event.target.value = '';
}
