// based off of https://github.com/devongovett/png-stream/blob/master/encoder.js
import { Deflate } from 'pako'
import { buf } from 'crc-32'

// color types
enum PNGColorType {
  PNG_COLOR_TYPE_GRAY = 0,
  PNG_COLOR_TYPE_RGB = 2,
  PNG_COLOR_TYPE_INDEXED = 3,
  PNG_COLOR_TYPE_GRAYA = 4,
  PNG_COLOR_TYPE_RGBA = 6,
}

// filter types
const PNG_FILTER_NONE = 0
const PNG_FILTER_SUB = 1
const PNG_FILTER_UP = 2
const PNG_FILTER_AVG = 3
const PNG_FILTER_PAETH = 4

const PNG_SIGNATURE = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
])

export class ColorSpace {
  static readonly RGB = new ColorSpace(PNGColorType.PNG_COLOR_TYPE_RGB, 3)
  static readonly RGBA = new ColorSpace(PNGColorType.PNG_COLOR_TYPE_RGBA, 4)
  static readonly GRAY = new ColorSpace(PNGColorType.PNG_COLOR_TYPE_GRAY, 1)
  static readonly GRAYA = new ColorSpace(PNGColorType.PNG_COLOR_TYPE_GRAYA, 2)
  // static readonly INDEXED = new ColorSpace(
  //   PNGColorType.PNG_COLOR_TYPE_INDEXED,
  //   1,
  // )

  // private to disallow creating other instances of this type
  private constructor(
    public readonly colorType: PNGColorType,
    public readonly colorBytes: number,
  ) {}
}

type Opts = {
  colorSpace: ColorSpace
}

export class PNGEncoder {
  readable: ReadableStream
  _writer: WritableStreamDefaultWriter
  _buffer: Uint8Array = new Uint8Array()
  _lineBuffer: Uint8Array[] = []
  _sequence = 0
  _pixelBytes: number
  _scanlineLength: number
  _prevScanline: Uint8Array
  _deflater: Deflate

  constructor(
    public width: number,
    public height: number,
    public colorSpace: ColorSpace = ColorSpace.RGB,
  ) {
    if (colorSpace.colorType === PNGColorType.PNG_COLOR_TYPE_INDEXED)
      throw new Error('no support for indexed')

    this._pixelBytes = (8 * colorSpace.colorBytes) >> 3
    this._scanlineLength = this._pixelBytes * width
    this._prevScanline = new Uint8Array(this._scanlineLength)

    this._deflater = new Deflate({level: 9, strategy: 3})

    let { readable, writable } = new TransformStream()
    this.readable = readable
    this._writer = writable.getWriter()
  }

  async start() {
    await this._write(PNG_SIGNATURE)
    await this._writeIHDR()
  }

  async _write(data: Uint8Array) {
    await this._writer.write(data)
  }

  async _writeCompressed(data: Uint8Array) {
    this._deflater.push(data, 2)
    await this._writeIDAT(this._deflater.result as Uint8Array)
  }

  async writePixels(data: Uint8Array) {
    let buffer = this._buffer
    this._buffer = new Uint8Array(buffer.length + data.length)
    this._buffer.set(buffer, 0)
    this._buffer.set(data, buffer.length)

    while (this._buffer.length >= this._scanlineLength) {
      let scanline = this._buffer.slice(0, this._scanlineLength)
      this._buffer = this._buffer.slice(this._scanlineLength)

      let line = this._filter(scanline)
      this._lineBuffer.push(line)
      if (this._lineBuffer.length > 20) {
        await this._flush()
      }
    }
  }

  async _flush() {
    for (let line of this._lineBuffer) {
      await this._writeCompressed(line)
    }
    this._lineBuffer = []
  }

  async end() {
    await this._flush()
    await this._writeChunk('IEND', new Uint8Array(0))
    return this._writer.close()
  }

  // Write's a generic PNG chunk including header, data, and CRC
  async _writeChunk(chunk: string, data: Uint8Array) {
    // new buffer with room for the header
    let buffer = new Uint8Array(8 + data.length)
    buffer.set(data, 8)

    let header = new DataView(buffer.buffer)
    header.setUint32(0, data.length)

    // there's gotta be a better way...
    buffer[4] = chunk.charCodeAt(0)
    buffer[5] = chunk.charCodeAt(1)
    buffer[6] = chunk.charCodeAt(2)
    buffer[7] = chunk.charCodeAt(3)

    await this._write(buffer)

    let crcBuffer = new Uint8Array(4)
    let crcView = new DataView(crcBuffer.buffer)
    crcView.setUint32(0, buf(buffer.slice(4)))
    await this._write(crcBuffer)
  }

  async _writeIHDR() {
    let buffer = new Uint8Array(13)
    let view = new DataView(buffer.buffer)
    view.setUint32(0, this.width)
    view.setUint32(4, this.height)
    buffer[8] = 8 // bits
    buffer[9] = this.colorSpace.colorType
    buffer[10] = 0 // compression
    buffer[11] = 0 // filter
    buffer[12] = 0 // interlace

    await this._writeChunk('IHDR', buffer)
  }

  // Main image data
  async _writeIDAT(data: Uint8Array) {
    await this._writeChunk('IDAT', data)
  }

  // Chooses the best filter for a given scanline.
  // Tries them all and chooses the one with the lowest sum.
  _filter(scanline: Uint8Array) {
    let out = new Uint8Array(1 + scanline.length)
    let tmp = new Uint8Array(1 + scanline.length)
    let prev = this._prevScanline
    let b = this._pixelBytes
    let min = Infinity

    let maxFilter = prev ? PNG_FILTER_PAETH : PNG_FILTER_SUB
    for (let filter = PNG_FILTER_NONE; filter <= maxFilter; filter++) {
      tmp[0] = filter

      // v8 deoptimizes switch statements with variables as cases, so we use constants here.
      switch (filter) {
        case 0: // PNG_FILTER_NONE
          for (let i = 0; i < scanline.length; i++) tmp[i + 1] = scanline[i]

          break

        case 1: // PNG_FILTER_SUB
          for (let i = 0; i < scanline.length; i++)
            tmp[i + 1] = (scanline[i] - (i < b ? 0 : scanline[i - b])) & 0xff

          break

        case 2: // PNG_FILTER_UP
          for (let i = 0; i < scanline.length; i++)
            tmp[i + 1] = (scanline[i] - prev[i]) & 0xff

          break

        case 3: // PNG_FILTER_AVG
          for (let i = 0; i < scanline.length; i++)
            tmp[i + 1] =
              (scanline[i] -
                (((i < b ? 0 : scanline[i - b]) + prev[i]) >>> 1)) &
              0xff

          break

        case 4: // PNG_FILTER_PAETH
          for (let i = 0; i < scanline.length; i++) {
            let cur = scanline[i]
            let left = i < b ? 0 : scanline[i - b]
            let upper = prev[i]
            let upperLeft = i < b ? 0 : prev[i - b]
            let p = upper - upperLeft
            let pc = left - upperLeft
            let pa = Math.abs(p)
            let pb = Math.abs(pc)
            pc = Math.abs(p + pc)

            p = pa <= pb && pa <= pc ? left : pb <= pc ? upper : upperLeft
            tmp[i + 1] = (cur - p) & 0xff
          }

          break
      }

      let sum = sumBuf(tmp)
      if (sum < min) {
        let t = out
        out = tmp
        tmp = t
        min = sum
      }
    }

    this._prevScanline = scanline
    return out
  }
}

function sumBuf(buf: Uint8Array) {
  let sum = 0

  for (let i = 1; i < buf.length; i++) {
    let v = buf[i]
    sum += v < 128 ? v : 256 - v
  }

  return sum
}
