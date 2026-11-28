import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile } from "node:fs/promises";

await sharp("icon.svg")
  .resize(256, 256)
  .png()
  .toFile("frostgpt-icon.png");

const ico = await pngToIco("frostgpt-icon.png");
await writeFile("frostgpt.ico", ico);

console.log("FROSTGPT Windows icon created!");
