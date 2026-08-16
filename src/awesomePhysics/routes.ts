import type { RouteRecordRaw, Router } from 'vue-router'

export const AWESOME_PHYSICS_CATALOG_ROUTE_NAME = 'awesome-physics-catalog'
export const AWESOME_PHYSICS_DETAIL_ROUTE_NAME = 'awesome-physics-detail'

export const awesomePhysicsRoutes = [
  {
    path: '/awesome-physics',
    name: AWESOME_PHYSICS_CATALOG_ROUTE_NAME,
    component: () => import('../views/AwesomePhysicsCatalogView.vue'),
    meta: { title: 'Awesome Physics Catalog' },
  },
  {
    path: '/awesome-physics/:id',
    name: AWESOME_PHYSICS_DETAIL_ROUTE_NAME,
    component: () => import('../views/AwesomePhysicsSimulationView.vue'),
    props: true,
    meta: { title: 'Awesome Physics Record' },
  },
] satisfies RouteRecordRaw[]

export function installAwesomePhysicsRoutes(router: Router): void {
  for (const route of awesomePhysicsRoutes) {
    if (route.name === undefined || router.hasRoute(route.name)) continue
    router.addRoute(route)
  }
}
