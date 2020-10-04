import { Route, Router } from './router'
import { DefaultFractalParams, drawFractal, FractalParams } from './fractal'
import { PNGEncoder } from './encoder'
import { handleScheduled, ScheduledEvent } from './scheduled'

export async function handleRequest(event: FetchEvent): Promise<Response> {
  return router.handle(event)
}

let router = new Router([
  new Route(/^\/favicon.ico$/, favicon),
  new Route(/^\/$/, fractal),
  new Route(/^\/test$/, test),
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
  let headers: HeadersInit = { 'Content-Type': 'image/png' }
  if (args.groups.key == 'last') {
    headers = {}
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
  let png = new PNGEncoder(800, 800)
  event.waitUntil(drawFractal(png, parseURLParams(url.searchParams)))
  return new Response(await FRACTAL_STORAGE.put(args.groups.key, png.readable))
}

async function test(event: FetchEvent) {
  try {
    await handleScheduled({ waitUntil: event.waitUntil, scheduledTime: 1000 })
    return new Response('ok')
  } catch (e) {
    return new Response(e)
  }
}
