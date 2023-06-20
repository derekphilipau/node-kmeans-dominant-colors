import { writeFileSync } from "fs";
import dominantColors from "../dominantColors.js";

const argSets = [
  { name: 'No filter', args: [10000, 0, 100, 0, 100] },
  { name: 'default 5 < v, 10 < s', args: [10000] },
  { name: '5 < v < 95, 10 < s', args: [10000, 5, 95, 10, 100] },
  { name: '5 < v, 5 < s', args: [10000, 5, 100, 5, 100] },
  { name: '20 < v', args: [10000, 20, 100, 0, 100] },
  { name: '10 < s', args: [10000, 0, 100, 10, 100] },
  { name: '20 < v, 10 < s', args: [10000, 20, 100, 10, 100] },
  { name: '40 < v,', args: [10000, 40, 100, 0, 100] },
  { name: '20 < s', args: [10000, 0, 100, 20, 100] },
  { name: '40 < v, 20 < s', args: [10000, 40, 100, 20, 100] },
  { name: 'v boost 10', args: [10000, 0, 100, 0, 100, 10] },
  { name: 's boost 10', args: [10000, 60, 100, 0, 100, 0, 10] },
]

async function getPalettes(imageFile) {
  const results = [];
  for (const argSet of argSets) {    
    results.push({
      name: argSet.name,
      palettes: [
        await dominantColors(imageFile, 10, ...argSet.args),
        await dominantColors(imageFile, 8, ...argSet.args),
        await dominantColors(imageFile, 5, ...argSet.args),
        await dominantColors(imageFile, 2, ...argSet.args),
      ]
    });
  }
  return results;
}

function getPalette(palette) {
  const totalLength = 15 * palette.length;
  return `
  <div class="is-flex mr-6">
  ${palette
    .map(
      (color) =>
        `<div style="background-color: #${
          color.color
        }; height: 60px; width: ${Math.floor(
          color.percent * totalLength
        )}px;"></div>`
    )
    .join("\n")}
  </div>`;
}

export async function generateHtml(images, numColors) {
  const imageDivs = [];
  for (const image of images) {
    const imageFile = `./img/${image.filename}`;

    console.log(`Processing colors for ${imageFile}`);
    const results = await getPalettes(imageFile, numColors);

    const imageHtml = `
      <div class="columns mb-6 is-flex">
        <div class="column is-one-quarter">
          <figure class="image">
            <img src="img/${image.filename}">
            <figcaption>
              <a href="${image.url}">"${image.title}", ${image.artist}</a>
            </figcaption>
          </figure>
        </div>
        <div class="column is-three-quarters is-flex" style="overflow-x:  auto;">
          ${results
            .map(
              (result) =>
              `<div class="pb-1">
                <h4 class="mb-1 is-size-6">${result.name}</h4>
                <div class="">
                ${result.palettes
                  .map(
                    (palette) =>
                      `<div class="is-flex mb-2">
                      ${getPalette(palette)}
                      </div>`
                  )
                  .join("\n")}
                </div>
              </div>`
              )
            .join("\n")}
        </div>
      </div>
    `;
    imageDivs.push(imageHtml);
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>node-kmeans-dominant-colors</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css">
      </head>
      <body>
        <section class="hero">
          <div class="hero-body">
            <p class="title">
              node-kmeans-dominant-colors
            </p>
            <p class="subtitle">
              <a href="https://github.com/derekphilipau/node-kmeans-dominant-colors">View on Github</a>
            </p>
            <p class="content">
              K-means clustering using <a href="https://github.com/Philmod/node-kmeans">node-kmeans</a> library.
              Default is to filter all pixels with s < 10 or v < 10
            </p>
          </div>
        </section>
        <section class="container">
          ${imageDivs.join("\n")}
        </section>
      </body>
    </html>
  `;

  writeFileSync("index.html", html);
}
