import { Route, Router } from './router'
import { DefaultFractalParams, drawFractal, FractalParams } from './fractal'
import { PNGEncoder } from './encoder'

export async function handleRequest(event: FetchEvent): Promise<Response> {
  return router.handle(event)
}

let router = new Router([
  new Route(/^\/favicon.ico$/, favicon),
  new Route(/^\/$/, fractal),
  new Route(/^\/get\/(?<key>[^/]+)$/, kvGet),
  new Route(/^\/put\/(?<key>[^/]+)$/, kvPut),
])

function parseURLParams(params: URLSearchParams): FractalParams {
  let map: { [k: string]: { name: string; parser: typeof parseFloat } } = {
    i: { name: 'iterations', parser: parseInt },
    z: { name: 'zoom', parser: parseInt },
    zx: { name: 'zoomX', parser: parseFloat },
    zy: { name: 'zoomY', parser: parseFloat },
    ss: { name: 'supersample', parser: parseInt },
  }

  let args: { [k: string]: number } = {}
  for (let [k, v] of Object.entries(map)) {
    let param = params.get(k)
    if (param != undefined) {
      args[v.name] = v.parser(param)
    }
  }

  return { ...DefaultFractalParams, ...args }
}

async function favicon(event: FetchEvent): Promise<Response> {
  let png = new PNGEncoder(16, 16)

  event.waitUntil(
    drawFractal(png, { ...DefaultFractalParams, zoom: 2, supersample: 2 }),
  )

  return new Response(png.readable, {
    headers: {
      'Content-Type': 'image/png',
    },
  })
}

async function fractal(event: FetchEvent): Promise<Response> {
  let url = new URL(event.request.url)
  let png = new PNGEncoder(800, 800)

  event.waitUntil(drawFractal(png, parseURLParams(url.searchParams)))

  return new Response(png.readable, {
    headers: {
      'Content-Type': 'image/png',
    },
  })
}

async function kvGet(
  event: FetchEvent,
  args: RegExpMatchArray,
): Promise<Response> {
  let headers = { 'Content-Type': 'image/png' }
  if (args.groups.key != 'last') {
    headers
  }
  return new Response(await FRACTAL_STORAGE.get(args.groups.key, 'stream'), {
    headers,
  })
}

async function kvPut(
  event: FetchEvent,
  args: RegExpMatchArray,
): Promise<Response> {
  let url = new URL(event.request.url)

  let iParam = url.searchParams.get('i') || '255'
  let iterations = parseInt(iParam)

  let zParam = url.searchParams.get('z') || '1'
  let zoom = parseInt(zParam)

  let ssParam = url.searchParams.get('ss') || '1'
  let supersample = parseInt(ssParam)

  let png = new PNGEncoder(800, 800)
  event.waitUntil(drawFractal(png, iterations, zoom, supersample))
  return new Response(await FRACTAL_STORAGE.put(args.groups.key, png.readable))
}
