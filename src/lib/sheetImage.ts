import { toPng } from "html-to-image";

/** 把导出板（宽 1080）画成图。很长时自动降低倍率，保证不超过手机浏览器的画布上限（约 1500 万像素），不会出空白图。 */
export async function sheetToPng(node: HTMLElement): Promise<string> {
  const height = node.scrollHeight;
  const cap = Math.sqrt(15_000_000 / (1080 * Math.max(height, 1)));
  const pixelRatio = Math.max(0.6, Math.min(2, window.devicePixelRatio || 1, cap));
  return toPng(node, {
    width: 1080,
    height,
    pixelRatio,
    cacheBust: true,
    backgroundColor: "#f6f1ea",
  });
}
