import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { vi } from 'vitest'
import {
  AWESOME_PHYSICS_CATALOG_ROUTE_NAME,
  AWESOME_PHYSICS_DETAIL_ROUTE_NAME,
  AWESOME_PHYSICS_SHELL_ROUTE_NAME,
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
    expect(awesomePhysicsRoutes).toHaveLength(1)
    expect(awesomePhysicsRoutes[0]?.name).toBe(AWESOME_PHYSICS_SHELL_ROUTE_NAME)
    expect(awesomePhysicsRoutes[0]?.path).toBe('/awesome-physics')
    expect(awesomePhysicsRoutes[0]?.children?.map(({ name, path }) => ({ name, path }))).toEqual([
      { name: AWESOME_PHYSICS_CATALOG_ROUTE_NAME, path: '' },
      { name: AWESOME_PHYSICS_DETAIL_ROUTE_NAME, path: ':id' },
    ])
    expect(typeof awesomePhysicsRoutes[0]?.component).toBe('function')
    expect(awesomePhysicsRoutes[0]?.children?.every(({ component }) => typeof component === 'function')).toBe(true)
    expect(awesomePhysicsRoutes[0]?.children?.[1]?.props).toBe(true)
  })

  it('installs each route once and preserves existing routes on repeated installation', () => {
    const existingRoute: RouteRecordRaw = { path: '/existing', name: 'existing', component: stubComponent }
    const router = testRouter([existingRoute])
    const addRoute = vi.spyOn(router, 'addRoute')

    installAwesomePhysicsRoutes(router)
    installAwesomePhysicsRoutes(router)

    expect(addRoute).toHaveBeenCalledTimes(1)
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
    expect(router.resolve('/awesome-physics/awesome-physx-3-4').name).toBe(AWESOME_PHYSICS_DETAIL_ROUTE_NAME)
    expect(router.resolve('/awesome-physics/awesome-physx-3-4').params).toEqual({ id: 'awesome-physx-3-4' })
    expect(router.resolve('/awesome-physics/awesome-newton-dynamics').name).toBe(AWESOME_PHYSICS_DETAIL_ROUTE_NAME)
    expect(router.resolve('/awesome-physics/awesome-newton-dynamics').params).toEqual({ id: 'awesome-newton-dynamics' })
    expect(router.resolve('/awesome-physics/awesome-ncollide').params).toEqual({ id: 'awesome-ncollide' })
    expect(router.resolve('/awesome-physics/awesome-fluid-engine-dev').params).toEqual({ id: 'awesome-fluid-engine-dev' })
    expect(router.resolve('/awesome-physics/awesome-cantera').params).toEqual({ id: 'awesome-cantera' })
    expect(router.resolve('/awesome-physics/awesome-simbody').params).toEqual({ id: 'awesome-simbody' })
    expect(router.resolve('/unrelated-path').name).toBe('catch-all')
  })
})
