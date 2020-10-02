import { handleRequest } from './fetch'
import { handleScheduled } from './scheduled'

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event))
})

addEventListener('scheduled', (event) => {
  event.waitUntil(handleScheduled(event.scheduledTime))
})
