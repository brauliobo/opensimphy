import { createRouter, createWebHistory } from 'vue-router'

const onelabRoutes = import.meta.env.VITE_ONELAB_ENABLED === 'true'
  ? [{ path: '/labs/onelab', name: 'onelab', component: () => import('../views/OnelabLabView.vue') }]
  : []

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'overview', component: () => import('../views/OverviewView.vue') },
    { path: '/topics/:id', name: 'topic', component: () => import('../views/TopicView.vue'), props: true },
    { path: '/atlas', name: 'atlas', component: () => import('../views/FormulaAtlasView.vue') },
    {
      path: '/atlas/:id',
      name: 'formula',
      component: () => import('../views/FormulaDetailView.vue'),
      props: true,
    },
    { path: '/labs', name: 'labs', component: () => import('../views/LabsView.vue') },
    { path: '/labs/core', alias: '/core', name: 'core', component: () => import('../views/CoreLabView.vue') },
    { path: '/labs/walls', alias: '/walls', name: 'walls', component: () => import('../views/NumberWallsView.vue') },
    ...onelabRoutes,
    { path: '/sources', name: 'sources', component: () => import('../views/SourcesView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
