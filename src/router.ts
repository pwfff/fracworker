export class Router {
  constructor(private routes: Route[]) {
  }

  public async handle(event: FetchEvent): Promise<Response> {
    for (let route of this.routes) {
      let url = new URL(event.request.url)
      if (url.pathname == route.path) {
        return route.handler(event)
      }
    }

    return new Response('404', {
      status: 404
    })
  }
}

export class Route {
  path: string
  handler: Handler

  constructor(path: string, handler: Handler) {
    this.path = path
    this.handler = handler
  }
}

export type Handler = (event: FetchEvent) => Promise<Response>