/**
 * Turns the studio's canvas into a file: the node is rasterised with
 * html2canvas at twice the pixel density, then saved as a PNG or wrapped in
 * a single-page PDF whose page is exactly the canvas. Both libraries load
 * on demand so the dashboard bundle stays small.
 */

const SCALE = 2;

async function rasterise(node, background) {
  const html2canvas = (await import("html2canvas")).default;
  return html2canvas(node, {
    backgroundColor: background || null,
    scale: SCALE,
    useCORS: true,
    logging: false,
    windowWidth: Math.max(node.scrollWidth, node.offsetWidth),
    windowHeight: Math.max(node.scrollHeight, node.offsetHeight),
  });
}

function download(href, file_name) {
  const link = document.createElement("a");
  link.href = href;
  link.download = file_name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function export_canvas_png(node, file_name, background) {
  const canvas = await rasterise(node, background);
  download(canvas.toDataURL("image/png"), `${file_name}.png`);
}

export async function export_canvas_pdf(node, file_name, background) {
  const canvas = await rasterise(node, background);
  const { jsPDF } = await import("jspdf");
  const width = canvas.width / SCALE;
  const height = canvas.height / SCALE;
  const pdf = new jsPDF({ orientation: width >= height ? "landscape" : "portrait", unit: "px", format: [width, height], hotfixes: ["px_scaling"] });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, width, height);
  pdf.save(`${file_name}.pdf`);
}
