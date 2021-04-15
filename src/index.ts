import { handleRequest } from './fetch'
import { handleScheduled, ScheduledEvent } from './scheduled'

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event))
})

addEventListener('scheduled', (event) => {
  let sEvent = event as ScheduledEvent
  sEvent.waitUntil(handleScheduled(sEvent))
})
