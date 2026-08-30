import sharp from "sharp";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1000;
const BACKGROUND = { r: 245, g: 245, b: 245, alpha: 1 };

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

// A simple styled stack, not an anatomical layering: top over bottom over
// shoes, with an optional outer-layer inset — "looks like an outfit, uses
// real clothes, robust to build" per the spec's deliberate sweet spot.
const TOP_BOX: Box = { left: 150, top: 40, width: 500, height: 380 };
const BOTTOM_BOX: Box = { left: 150, top: 420, width: 500, height: 330 };
const FOOTWEAR_BOX: Box = { left: 250, top: 760, width: 300, height: 200 };
const OUTER_LAYER_BOX: Box = { left: 600, top: 20, width: 180, height: 180 };

async function fitToBox(imageBuffer: Buffer, box: Box) {
  const resized = await sharp(imageBuffer)
    .resize({ width: box.width, height: box.height, fit: "inside" })
    .png()
    .toBuffer();
  const metadata = await sharp(resized).metadata();
  const width = metadata.width ?? box.width;
  const height = metadata.height ?? box.height;

  return {
    input: resized,
    left: box.left + Math.round((box.width - width) / 2),
    top: box.top + Math.round((box.height - height) / 2),
  };
}

export async function composeFlatlay(images: {
  top: Buffer;
  bottom: Buffer;
  footwear: Buffer;
  outer?: Buffer | null;
}): Promise<Buffer> {
  const overlays = await Promise.all([
    fitToBox(images.top, TOP_BOX),
    fitToBox(images.bottom, BOTTOM_BOX),
    fitToBox(images.footwear, FOOTWEAR_BOX),
    ...(images.outer ? [fitToBox(images.outer, OUTER_LAYER_BOX)] : []),
  ]);

  return sharp({
    create: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite(overlays)
    .png()
    .toBuffer();
}
