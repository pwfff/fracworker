import { PNG } from 'pngjs'

export async function handleRequest(request: Request): Promise<Response> {
  if (request.url.endsWith('favicon.ico')) {
    return new Response('nah')
  }

  let iParam = new URL(request.url).searchParams.get('i') || '255'
  let iterations = parseInt(iParam)

  let zParam = new URL(request.url).searchParams.get('z') || '1'
  let zoom = parseInt(zParam)

  let ssParam = new URL(request.url).searchParams.get('ss') || '1'
  let supersample = parseInt(ssParam)

  let png = new PNG({
    width: 800,
    height: 800,
    bgColor: { red: 0, green: 0, blue: 0 },
    //colorType: 0,
  })

  drawFractal(png, iterations, zoom, supersample)

  return new Response(PNG.sync.write(png), {
    headers: {
      'Content-Type': 'image/png',
    },
  })
}

function drawFractal(
  png: PNG,
  iterations: number,
  zoom: number,
  supersample: number,
) {
  zoom = Math.floor(zoom ** 1.5)

  // the target of our zooming
  let centerX = -0.75
  let centerY = 0.1

  let width = png.width * supersample
  let height = png.height * supersample
  let buffer = new Uint8Array(width * height * 3)

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      // project our image coordinates to coordinates on the imaginary plane
      let cx = (4 / zoom) * (x / width - 0.5) + (centerX - centerX / zoom)
      let cy = (4 / zoom) * (y / height - 0.5) + (centerY - centerY / zoom)

      // next point - if this trends towards infinity, we don't fill the pixel
      let zx = 0
      let zy = 0

      // iterate until the point escapes or we hit our limit ('infinity')
      let i = 0
      let infinity = 20
      let zn = 0
      while (i < iterations && zn < infinity) {
        let xt = zx * zy
        zx = zx * zx - zy * zy + cx
        zy = 2 * xt + cy
        zn = Math.sqrt(zx * zx + zy * zy)
        i++
      }

      if (i >= iterations) {
        continue
      }

      // fracIter is how far outside our bounds we escaped, for color smoothing
      let fracIter = Math.log2(Math.log(zn) / Math.log(infinity))

      // norm is some value between 0 and 1, a ratio of how many of the iterations it took to escape
      const norm = Math.sqrt((i - fracIter) / iterations)

      // map the number of iterations to some periodic color
      let r = (Math.sin(norm * 20 * 0.3) * 0.5 + 0.5) * 255
      let g = (Math.sin(norm * 20 * 0.45) * 0.5 + 0.5) * 255
      let b = (Math.sin(norm * 20 * 0.65) * 0.5 + 0.5) * 255

      let idx = width * y + x
      buffer[idx + 0] = Math.floor(r)
      buffer[idx + 1] = Math.floor(g)
      buffer[idx + 2] = Math.floor(b)
    }
  }

  // subsample our larger image, filling in the png
  for (let x = 0; x < png.width; x++) {
    for (let y = 0; y < png.height; y++) {
      let { r, g, b } = get_rgb_average(buffer, width, supersample, x, y)
      let idx = (png.width * y + x) << 2
      png.data[idx + 0] = Math.floor(r)
      png.data[idx + 1] = Math.floor(g)
      png.data[idx + 2] = Math.floor(b)
      png.data[idx + 3] = 255
    }
  }
}

function get_rgb(
  buffer: Uint8Array,
  width: number,
  x: number,
  y: number,
): { r: number; g: number; b: number } {
  let idx = width * y + x
  return {
    r: buffer[idx + 0],
    g: buffer[idx + 1],
    b: buffer[idx + 2],
  }
}

function get_rgb_average(
  buffer: Uint8Array,
  width: number,
  ratio: number,
  x: number,
  y: number,
): { r: number; g: number; b: number } {
  // x0/y0 are our starting coordinate in the supersampled buffer
  let x0 = x * ratio
  let y0 = y * ratio

  let r = 0
  let g = 0
  let b = 0

  // get the extra pixels, average using sum of squares
  for (let xi = x0; xi < x0 + ratio; xi++) {
    for (let yi = y0; yi < y0 + ratio; yi++) {
      let { r: ri, g: gi, b: bi } = get_rgb(buffer, width, xi, yi)
      r += ri ** 2
      g += gi ** 2
      b += bi ** 2
    }
  }

  r = Math.sqrt(r / ratio ** 2)
  g = Math.sqrt(g / ratio ** 2)
  b = Math.sqrt(b / ratio ** 2)

  return { r, g, b }
}
