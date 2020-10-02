export class Router {
  constructor(private routes: Route[]) {
  }

  public async handle(request: Request): Promise<Response> {
    for (let route of this.routes) {
      let url = new URL(request.url)
      if (url.pathname == route.path) {
        return route.handler(request)
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

export type Handler = (request: Request) => Promise<Response>