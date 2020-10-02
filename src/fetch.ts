import { Route, Router } from './router'
import { drawFractal } from './fractal'
import { PNGEncoder } from './encoder'

export async function handleRequest(event: FetchEvent): Promise<Response> {
  return router.handle(event)
}

let router = new Router([
  new Route('/favicon.ico', favicon),
  new Route('/', fractal),
])

async function favicon(event: FetchEvent): Promise<Response> {
  let png = new PNGEncoder(16, 16)

  event.waitUntil(drawFractal(png, 255, 2, 6))

  return new Response(png.readable, {
    headers: {
      'Content-Type': 'image/png',
    },
  })
}

async function fractal(event: FetchEvent): Promise<Response> {
  let url = new URL(event.request.url)

  let iParam = url.searchParams.get('i') || '255'
  let iterations = parseInt(iParam)

  let zParam = url.searchParams.get('z') || '1'
  let zoom = parseInt(zParam)

  let ssParam = url.searchParams.get('ss') || '1'
  let supersample = parseInt(ssParam)

  let png = new PNGEncoder(800, 800)
  event.waitUntil(drawFractal(png, iterations, zoom, supersample))

  return new Response(png.readable, {
    headers: {
      'Content-Type': 'image/png',
    },
  })
}
