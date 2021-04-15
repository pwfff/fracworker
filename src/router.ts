export class Router {
  constructor(private routes: Route[]) {
  }

  public async handle(event: FetchEvent): Promise<Response> {
    for (let route of this.routes) {
      let url = new URL(event.request.url)
      let match = route.match(url.pathname)
      if (match) {
        return route.handler(event, match)
      }
    }

    return new Response('404', {
      status: 404
    })
  }
}

export class Route {
  path: RegExp
  handler: Handler

  constructor(path: RegExp, handler: Handler) {
    this.path = path
    this.handler = handler
  }

  match(path: string): RegExpMatchArray | null {
    return path.match(this.path)
  }
}

export type Handler = (event: FetchEvent, args: RegExpMatchArray) => Promise<Response>