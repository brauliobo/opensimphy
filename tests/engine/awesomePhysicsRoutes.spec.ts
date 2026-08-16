import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { vi } from 'vitest'
import {
  AWESOME_PHYSICS_CATALOG_ROUTE_NAME,
  AWESOME_PHYSICS_DETAIL_ROUTE_NAME,
  awesomePhysicsRoutes,
  installAwesomePhysicsRoutes,
} from '../../src/awesomePhysics/routes'

const stubComponent = { template: '<div />' }

function testRouter(routes: RouteRecordRaw[] = []): ReturnType<typeof createRouter> {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      ...routes,
      { path: '/:pathMatch(.*)*', name: 'catch-all', component: stubComponent },
    ],
  })
}

describe('Awesome Physics routes', () => {
  it('defines typed lazy catalog and detail records with stable names and props', () => {
    expect(awesomePhysicsRoutes).toHaveLength(2)
    expect(awesomePhysicsRoutes.map(({ name, path }) => ({ name, path }))).toEqual([
      { name: AWESOME_PHYSICS_CATALOG_ROUTE_NAME, path: '/awesome-physics' },
      { name: AWESOME_PHYSICS_DETAIL_ROUTE_NAME, path: '/awesome-physics/:id' },
    ])
    expect(awesomePhysicsRoutes.every(({ component }) => typeof component === 'function')).toBe(true)
    expect(awesomePhysicsRoutes[1]?.props).toBe(true)
  })

  it('installs each route once and preserves existing routes on repeated installation', () => {
    const existingRoute: RouteRecordRaw = { path: '/existing', name: 'existing', component: stubComponent }
    const router = testRouter([existingRoute])
    const addRoute = vi.spyOn(router, 'addRoute')

    installAwesomePhysicsRoutes(router)
    installAwesomePhysicsRoutes(router)

    expect(addRoute).toHaveBeenCalledTimes(2)
    expect(router.hasRoute(AWESOME_PHYSICS_CATALOG_ROUTE_NAME)).toBe(true)
    expect(router.hasRoute(AWESOME_PHYSICS_DETAIL_ROUTE_NAME)).toBe(true)
    expect(router.resolve('/existing').name).toBe('existing')
    expect(router.resolve('/not-a-route').name).toBe('catch-all')
  })

  it('ranks dynamically installed catalog routes ahead of the catch-all', () => {
    const router = testRouter()

    installAwesomePhysicsRoutes(router)

    expect(router.resolve('/awesome-physics').name).toBe(AWESOME_PHYSICS_CATALOG_ROUTE_NAME)
    expect(router.resolve('/awesome-physics/awesome-matter-js').name).toBe(AWESOME_PHYSICS_DETAIL_ROUTE_NAME)
    expect(router.resolve('/awesome-physics/awesome-matter-js').params).toEqual({ id: 'awesome-matter-js' })
    expect(router.resolve('/unrelated-path').name).toBe('catch-all')
  })
})
