import type { App, Component } from 'vue'
import type { Router } from 'vue-router'
import VaporRouterLink from './VaporRouterLink.vue'
import VaporRouterView from './VaporRouterView.vue'

const VAPOR_ROUTER_COMPONENTS = new Set(['RouterLink', 'RouterView'])

export function installVaporRouter(app: App, router: Router): App {
  const register = app.component.bind(app)
  app.component = ((name: string, component?: Component) => {
    if (component && VAPOR_ROUTER_COMPONENTS.has(name)) return app
    return register(name, component as Component)
  }) as App['component']
  try {
    router.install(app)
  } finally {
    app.component = register
  }
  register('RouterLink', VaporRouterLink)
  register('RouterView', VaporRouterView)
  return app
}
