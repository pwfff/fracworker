import { PNGEncoder } from './encoder'
import { DefaultFractalParams, drawFractal } from './fractal'

export interface ScheduledEvent extends Event {
  waitUntil(f: any): void
  scheduledTime: number
}

export async function handleScheduled(event: ScheduledEvent) {
  // get the last zoom level we processed
  let zoom = parseInt(await FRACTAL_STORAGE.get('last'))
  zoom = (zoom % 120) + 1

  let key = event.scheduledTime.toString()

  let png = new PNGEncoder(800, 800)
  drawFractal(png, { ...DefaultFractalParams, zoom, supersample: 2 })
  await FRACTAL_STORAGE.put(key, png.readable)

  // TODO: don't hardcode this? should this be on ScheduledEvent?
  let url = `https://fractal.cyberpunk.workers.dev/get/${key}`
  await fetch(HOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: url }),
  })

  await FRACTAL_STORAGE.put('last', zoom)
}
