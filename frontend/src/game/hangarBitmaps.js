// Hangar bay bitmaps — same camp sheets the Main Hall uses, drawn on canvas
// 2d because a second live Pixi Application is how the tab used to wedge.
// Missing files fall back to the hardcoded draw in HangarRoom.jsx.

const BASE = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || '';
const DIR = BASE + '/sprites/camp/';

function loadImg(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** First 128px cell of a 16-frame horizontal strip, or the whole image. */
export function sheetCell(img) {
  if (!img || !img.width) return { img: null, fw: 0, fh: 0 };
  const isStrip = img.width >= img.height * 2;
  const fw = isStrip ? Math.round(img.width / 16) : img.width;
  return { img, fw, fh: img.height };
}

export async function loadHangarBitmaps() {
  const [floor, door] = await Promise.all([
    loadImg(DIR + 'station-floor-tileset-2x.png'),
    loadImg(DIR + 'camp-station-hangar-16.png'),
  ]);
  return {
    floor: sheetCell(floor),
    door: sheetCell(door),
  };
}
