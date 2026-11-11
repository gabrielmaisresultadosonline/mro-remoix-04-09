// Records the preview element of the current tab (Chrome/Edge) to MP4 when supported, WebM otherwise.
export async function recordElement(el: HTMLElement, seconds: number, onStart: () => void, onTick?: (s: number) => void) {
  const md: any = navigator.mediaDevices;
  if (!md?.getDisplayMedia) throw new Error("Seu navegador não permite gravação. Use Chrome ou Edge no computador.");
  const stream: MediaStream = await md.getDisplayMedia({ video: { frameRate: 60 }, audio: true, preferCurrentTab: true, selfBrowserSurface: "include" } as any);
  const [track] = stream.getVideoTracks();
  const CropTarget = (window as any).CropTarget;
  if (CropTarget && (track as any).cropTo) {
    try { await (track as any).cropTo(await CropTarget.fromElement(el)); } catch { /* full tab */ }
  }
  const types = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
  const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((res) => { rec.onstop = () => res(new Blob(chunks, { type: mimeType || "video/webm" })); });
  await new Promise((r) => setTimeout(r, 400));
  onStart();
  rec.start(250);
  for (let i = 0; i < seconds; i++) { onTick?.(i); await new Promise((r) => setTimeout(r, 1000)); }
  rec.stop();
  stream.getTracks().forEach((t) => t.stop());
  const blob = await done;
  return { blob, ext: blob.type.includes("mp4") ? "mp4" : "webm" };
}
export function download(data: Blob | string, name: string) {
  const blob = typeof data === "string" ? new Blob([data], { type: "text/html" }) : data;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
