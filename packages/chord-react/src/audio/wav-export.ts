/**
 * Render piano audio to WAV using OfflineAudioContext + smplr.
 */
import { Soundfont } from "smplr";
import { toAscendingNotes } from "./playback";

const SAMPLE_RATE = 44100;

/**
 * Render notes to an AudioBuffer using an OfflineAudioContext.
 */
async function renderToBuffer(
  notes: string[],
  mode: "block" | "arpeggio",
  octave: number = 4,
  durationSec: number = 2.5,
  arpDelayMs: number = 120,
): Promise<AudioBuffer> {
  const ascending = toAscendingNotes(notes, octave);
  const totalDuration = mode === "arpeggio"
    ? durationSec + (ascending.length * arpDelayMs) / 1000
    : durationSec;

  const offlineCtx = new OfflineAudioContext(2, Math.ceil(SAMPLE_RATE * totalDuration), SAMPLE_RATE);
  const piano = new Soundfont(offlineCtx as unknown as AudioContext, {
    instrument: "acoustic_grand_piano",
  });
  await piano.load;

  for (let i = 0; i < ascending.length; i++) {
    const time = mode === "arpeggio" ? (i * arpDelayMs) / 1000 : 0;
    piano.start({ note: ascending[i], time, duration: durationSec });
  }

  return offlineCtx.startRendering();
}

/**
 * Encode an AudioBuffer as a 16-bit PCM WAV file.
 */
function encodeWav(buffer: AudioBuffer): Uint8Array {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = buffer.length;
  const dataSize = numSamples * numChannels * bytesPerSample;
  const fileSize = 44 + dataSize;

  const out = new ArrayBuffer(fileSize);
  const view = new DataView(out);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave channels and write PCM samples
  const channels = Array.from({ length: numChannels }, (_, ch) => buffer.getChannelData(ch));
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Uint8Array(out);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Generate a WAV file for a chord (block or arpeggio).
 */
export async function generateWav(
  notes: string[],
  mode: "block" | "arpeggio",
  octave?: number,
): Promise<Uint8Array> {
  const buffer = await renderToBuffer(notes, mode, octave);
  return encodeWav(buffer);
}
