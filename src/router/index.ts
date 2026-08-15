import { createRouter, createWebHistory } from 'vue-router'
import pagePaths from './page-paths.json'

const onelabRoutes = import.meta.env.VITE_ONELAB_ENABLED === 'true'
  ? [{ path: pagePaths.onelab, name: 'onelab', component: () => import('../views/OnelabLabView.vue') }]
  : []

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: pagePaths.overview, name: 'overview', component: () => import('../views/OverviewView.vue') },
    { path: pagePaths.topic, name: 'topic', component: () => import('../views/TopicView.vue'), props: true },
    { path: pagePaths.atlas, name: 'atlas', component: () => import('../views/FormulaAtlasView.vue') },
    {
      path: pagePaths.formula,
      name: 'formula',
      component: () => import('../views/FormulaDetailView.vue'),
      props: true,
    },
    { path: pagePaths.labs, name: 'labs', component: () => import('../views/LabsView.vue') },
    { path: pagePaths.core, alias: pagePaths.coreAlias, name: 'core', component: () => import('../views/CoreLabView.vue') },
    { path: pagePaths.walls, alias: pagePaths.wallsAlias, name: 'walls', component: () => import('../views/NumberWallsView.vue') },
    ...onelabRoutes,
    { path: pagePaths.sources, name: 'sources', component: () => import('../views/SourcesView.vue') },
    { path: pagePaths.fallback, redirect: pagePaths.overview },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
