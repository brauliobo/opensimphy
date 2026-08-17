import type { RouteRecordRaw, Router } from 'vue-router'

export const AWESOME_PHYSICS_SHELL_ROUTE_NAME = 'awesome-physics-shell'
export const AWESOME_PHYSICS_CATALOG_ROUTE_NAME = 'awesome-physics-catalog'
export const AWESOME_PHYSICS_DETAIL_ROUTE_NAME = 'awesome-physics-detail'

export const awesomePhysicsRoutes = [
  {
    path: '/awesome-physics',
    name: AWESOME_PHYSICS_SHELL_ROUTE_NAME,
    component: () => import('../views/AwesomePhysicsShellView.vue'),
    children: [
      {
        path: '',
        name: AWESOME_PHYSICS_CATALOG_ROUTE_NAME,
        component: () => import('../views/AwesomePhysicsCatalogView.vue'),
        meta: { title: 'Awesome Physics Catalog' },
      },
      {
        path: ':id',
        name: AWESOME_PHYSICS_DETAIL_ROUTE_NAME,
        component: () => import('../views/AwesomePhysicsSimulationView.vue'),
        props: true,
        meta: { title: 'Awesome Physics Record' },
      },
    ],
  },
] satisfies RouteRecordRaw[]

export function installAwesomePhysicsRoutes(router: Router): void {
  if (router.hasRoute(AWESOME_PHYSICS_SHELL_ROUTE_NAME)) return
  const [shellRoute] = awesomePhysicsRoutes
  if (!shellRoute) throw new Error('Awesome Physics shell route is missing')
  router.addRoute(shellRoute)
}
