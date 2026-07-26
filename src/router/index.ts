import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'overview', component: () => import('../views/OverviewView.vue'), meta: { title: 'Tour' } },
    { path: '/topics/:id', name: 'topic', component: () => import('../views/TopicView.vue'), props: true, meta: { title: 'Topic' } },
    { path: '/atlas', name: 'atlas', component: () => import('../views/FormulaAtlasView.vue'), meta: { title: 'Formula Atlas' } },
    {
      path: '/atlas/:id',
      name: 'formula',
      component: () => import('../views/FormulaDetailView.vue'),
      props: true,
      meta: { title: 'Formula Record' },
    },
    { path: '/labs', name: 'labs', component: () => import('../views/LabsView.vue'), meta: { title: 'Labs' } },
    { path: '/labs/core', alias: '/core', name: 'core', component: () => import('../views/CoreLabView.vue'), meta: { title: 'Core Lab' } },
    { path: '/labs/walls', alias: '/walls', name: 'walls', component: () => import('../views/NumberWallsView.vue'), meta: { title: 'Number Walls' } },
    { path: '/earth', name: 'earth', component: () => import('../views/EarthOverviewView.vue'), meta: { title: 'EARTH Dossier' } },
    { path: '/earth/corpus', name: 'earth-corpus', component: () => import('../views/EarthCorpusView.vue'), meta: { title: 'EARTH Source Index' } },
    {
      path: '/earth/programs',
      alias: '/earth/simulations',
      name: 'earth-simulations',
      component: () => import('../views/EarthSimulationsView.vue'),
      meta: { title: 'EARTH Program Registry' },
    },
    {
      path: '/earth/programs/:id',
      alias: '/earth/simulations/:id',
      name: 'earth-simulation',
      component: () => import('../views/EarthSimulationDetailView.vue'),
      props: true,
      meta: { title: 'EARTH Program Record' },
    },
    { path: '/earth/datasets', name: 'earth-datasets', component: () => import('../views/EarthDatasetsView.vue'), meta: { title: 'EARTH Dataset Ledger' } },
    {
      path: '/earth/corpus/:slug',
      alias: '/earth/:slug',
      name: 'earth-document',
      component: () => import('../views/EarthDocumentView.vue'),
      props: true,
      meta: { title: 'EARTH Source Record' },
    },
    { path: '/sources', name: 'sources', component: () => import('../views/SourcesView.vue'), meta: { title: 'Sources' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  if (typeof document === 'undefined') return
  const title = typeof to.meta.title === 'string' ? to.meta.title : 'OpenSimPhy Atlas'
  document.title = `${title} | OpenSimPhy Atlas`
})
