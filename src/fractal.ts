import {PNGEncoder} from './encoder'

export async function drawFractal(
  png: PNGEncoder,
  iterations: number,
  zoom: number,
  supersample: number,
): Promise<void> {
  await png.start()

  let width = png.width
  let height = png.height

  // increase the zoom rate. there's probably a better way to scale this
  zoom = Math.floor(zoom ** 1.5)

  // the target of our zooming
  let centerX = -0.75
  let centerY = 0.1

  // with supersampling, our 'canvas' is actually larger
  let ssWidth = width * supersample
  let ssHeight = height * supersample

  for (let y = 0; y < height; y++) {
    let line = new Uint8Array(width * 3)
    for (let x = 0; x < width; x++) {
      let x0 = x * supersample
      let y0 = y * supersample

      let r = 0
      let g = 0
      let b = 0

      // get the extra pixels, average using sum of squares
      for (let xi = x0; xi < x0 + supersample; xi++) {
        for (let yi = y0; yi < y0 + supersample; yi++) {
          // project our image coordinates to coordinates on the imaginary plane
          let cx =
            (4 / zoom) * (xi / ssWidth - 0.5) + (centerX - centerX / zoom)
          let cy =
            (4 / zoom) * (yi / ssHeight - 0.5) + (centerY - centerY / zoom)

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
          let ri = (Math.sin(norm * 20 * 0.3) * 0.5 + 0.5) * 255
          let gi = (Math.sin(norm * 20 * 0.45) * 0.5 + 0.5) * 255
          let bi = (Math.sin(norm * 20 * 0.65) * 0.5 + 0.5) * 255

          // add to sum of squares
          r += ri ** 2
          g += gi ** 2
          b += bi ** 2
        }
      }

      // average the sum of squares
      r = Math.sqrt(r / supersample ** 2)
      g = Math.sqrt(g / supersample ** 2)
      b = Math.sqrt(b / supersample ** 2)

      line[x*3] = r
      line[x*3+1] = g
      line[x*3+2] = b
    }
    png.writePixels(line)
  }

  return png.end()
}
