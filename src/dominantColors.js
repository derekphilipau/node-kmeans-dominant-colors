import getPixels from "get-pixels";
import convert from "color-convert";
import kmeans from "node-kmeans";

const ALPHA_THRESHOLD = 125; // Minimum alpha value (transparency) for a pixel to be considered
const KMEANS_SEED = 0.3; // Seed value for the k-means clustering
const VALUE_MIN = 5; // Minimum value value for a pixel to be considered
const VALUE_MAX = 100; // Maximum value value for a pixel to be considered
const SATURATION_MIN = 10; // Minimum saturation value for a pixel to be considered
const SATURATION_MAX = 100; // Maximum saturation value for a pixel to be considered
const SATURATION_BOOST = 0; // Amount to boost saturation by (0-100)
const VALUE_BOOST = 0; // Amount to boost value by (0-100)
const SAMPLE_RATE = 0.009; // Higher values will sample more pixels

/**
 * Get pixels from an image and convert it into an ndarray of pixels
 *
 * @param {*} imageUrlOrPath URL or path to the image
 * @returns ndarray of pixels
 */
async function getPixelsAsync(imageUrlOrPath) {
  return new Promise((resolve, reject) => {
    getPixels(imageUrlOrPath, (err, pixels) => {
      if (err) {
        reject(err);
      } else {
        resolve(pixels);
      }
    });
  });
}

/**
 * Calculate the distance between two colors in the Lab color space
 *
 * @param {*} p
 * @param {*} q
 * @returns
 */
function labDistance(p, q) {
  const labDifference = Math.sqrt(
    (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2
  );
  return labDifference;
}

async function getKmeansClusters(points, numClusters) {
  return new Promise((resolve, reject) => {
    kmeans.clusterize(
      points,
      {
        k: numClusters,
        seed: KMEANS_SEED,
        distance: (p, q) => labDistance(p, q),
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res);
      }
    );
  });
}

function getSampledFlatPixelArray(
  pixels,
  valueMin,
  valueMax,
  saturationMin,
  saturationMax,
  valueBoost,
  saturationBoost
) {
  const totalImagePixels = pixels.shape[0] * pixels.shape[1];

  // For performance reasons, take a higher percentage of pixels for smaller images:
  const numberPixelsToSample = Math.min(
    totalImagePixels,
    Math.round(SAMPLE_RATE * totalImagePixels + 4000)
  );
  const pixelArray = [];
  let i, j, idx;
  // Randomly sample pixels from the image
  for (let count = 0; count < numberPixelsToSample; count++) {
    i = Math.floor(Math.random() * pixels.shape[0]);
    j = Math.floor(Math.random() * pixels.shape[1]);

    idx = (i * pixels.shape[1] + j) * pixels.shape[2];
    // Get rgba pixels
    let [r, g, b, a] = [
      pixels.data[idx],
      pixels.data[idx + 1],
      pixels.data[idx + 2],
      pixels.data[idx + 3],
    ];
    // Don't include transparent pixels
    if (typeof a === "undefined" || a >= ALPHA_THRESHOLD) {
      let [h, s, v] = convert.rgb.hsv(r, g, b);
      if (saturationBoost || valueBoost) {
        // Increase the saturation and value by the specified amounts
        s = Math.min(s + saturationBoost, 100);
        v = Math.min(v + valueBoost, 100);
      }
      // Skip pixels that fall outside saturation and value ranges
      if (
        v >= valueMin &&
        v <= valueMax &&
        s >= saturationMin &&
        s <= saturationMax
      ) {
        pixelArray.push(convert.hsv.lab(h, s, v));
      }
    }
  }
  return pixelArray;
}

export default async function dominantColors(
  imageUrlOrPath,
  numColors,
  valueMin = VALUE_MIN,
  valueMax = VALUE_MAX,
  saturationMin = SATURATION_MIN,
  saturationMax = SATURATION_MAX,
  valueBoost = VALUE_BOOST,
  saturationBoost = SATURATION_BOOST
) {
  try {
    const pixels = await getPixelsAsync(imageUrlOrPath);
    let dataArray = getSampledFlatPixelArray(
      pixels,
      valueMin,
      valueMax,
      saturationMin,
      saturationMax,
      valueBoost,
      saturationBoost
    );

    let clusters;
    try {
      clusters = await getKmeansClusters(dataArray, numColors);
    } catch (error) {
      // If k-means clustering fails, try again without filtering pixels
      let dataArray = getSampledFlatPixelArray(
        pixels,
        0,
        100,
        0,
        100,
        0,
        0
      );
      clusters = await getKmeansClusters(dataArray, numColors);
    }

    const totalLength = clusters.reduce(
      (acc, cluster) => acc + cluster.cluster.length,
      0
    );

    return clusters.map((cluster) => {
      return {
        color: convert.lab.hex(cluster.centroid),
        percent: cluster.cluster.length / totalLength,
      };
    });
  } catch (error) {
    return [];
  }
}
