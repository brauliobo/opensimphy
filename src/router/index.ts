import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'overview', component: () => import('../views/OverviewView.vue') },
    { path: '/atlas', name: 'atlas', component: () => import('../views/FormulaAtlasView.vue') },
    {
      path: '/atlas/:id',
      name: 'formula',
      component: () => import('../views/FormulaDetailView.vue'),
      props: true,
    },
    { path: '/core', name: 'core', component: () => import('../views/CoreLabView.vue') },
    { path: '/walls', name: 'walls', component: () => import('../views/NumberWallsView.vue') },
    { path: '/sources', name: 'sources', component: () => import('../views/SourcesView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
