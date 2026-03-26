/**
 * Bundle chord exports (SVG, PNG, MIDI, WAV) into a downloadable .zip.
 */
import JSZip from "jszip";
import { generateMidiFile } from "@better-chord/core";
import { generateWav } from "./wav-export";

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_ ]/g, "_").slice(0, 80);
}

/**
 * Export an SVG element as SVG string bytes.
 */
function svgToBytes(svgElement: SVGSVGElement): Uint8Array {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  const controls = clone.querySelector("[data-controls]");
  if (controls) {
    const controlsH = 30;
    controls.remove();
    const vb = svgElement.viewBox.baseVal;
    clone.setAttribute("viewBox", `0 ${controlsH} ${vb.width} ${vb.height - controlsH}`);
  }
  const svgData = new XMLSerializer().serializeToString(clone);
  return new TextEncoder().encode(svgData);
}

/**
 * Export an SVG element as a PNG blob.
 */
function svgToPng(svgElement: SVGSVGElement, pixelRatio = 2): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    const controls = clone.querySelector("[data-controls]");
    let offsetY = 0;
    if (controls) { offsetY = 30; controls.remove(); }

    const vb = svgElement.viewBox.baseVal;
    const w = vb.width;
    const h = vb.height - offsetY;
    clone.setAttribute("viewBox", `0 ${offsetY} ${w} ${h}`);
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));

    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * pixelRatio;
      canvas.height = h * pixelRatio;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("No canvas context")); return; }
      ctx.scale(pixelRatio, pixelRatio);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      canvas.toBlob((b) => {
        if (!b) { reject(new Error("toBlob failed")); return; }
        b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)));
      }, "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG load failed")); };
    img.src = url;
  });
}

export interface ZipVariant {
  label: string;
  notes: string[];
  svgElement: SVGSVGElement | null;
}

/**
 * Bundle a single chord variant into a zip folder.
 */
async function addVariantToZip(
  folder: JSZip,
  variant: ZipVariant,
  chordName: string,
): Promise<void> {
  const name = sanitize(chordName);

  // SVG
  if (variant.svgElement) {
    folder.file(`${name}.svg`, svgToBytes(variant.svgElement));
    try {
      const png = await svgToPng(variant.svgElement);
      folder.file(`${name}.png`, png);
    } catch { /* skip PNG if conversion fails */ }
  }

  // MIDI (block chord)
  const midi = generateMidiFile({ notes: variant.notes });
  folder.file(`${name}.mid`, midi);

  // WAV — block chord
  try {
    const wavBlock = await generateWav(variant.notes, "block");
    folder.file(`${name}_chord.wav`, wavBlock);
  } catch { /* skip if offline audio fails */ }

  // WAV — arpeggio
  try {
    const wavArp = await generateWav(variant.notes, "arpeggio");
    folder.file(`${name}_arpeggio.wav`, wavArp);
  } catch { /* skip if offline audio fails */ }
}

/**
 * Export a single variant as a .zip download.
 */
export async function exportSingleZip(
  chordName: string,
  variant: ZipVariant,
): Promise<Blob> {
  const zip = new JSZip();
  await addVariantToZip(zip, variant, chordName);
  return zip.generateAsync({ type: "blob" });
}

/**
 * Export all variants as a .zip with subfolders.
 */
export async function exportAllZip(
  chordName: string,
  variants: ZipVariant[],
): Promise<Blob> {
  const zip = new JSZip();
  for (let i = 0; i < variants.length; i++) {
    const letter = String.fromCharCode(65 + i); // A, B, C...
    const folderName = `${letter}_${sanitize(variants[i].label)}`;
    const folder = zip.folder(folderName)!;
    await addVariantToZip(folder, variants[i], chordName);
  }
  return zip.generateAsync({ type: "blob" });
}

/**
 * Trigger a blob download.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
