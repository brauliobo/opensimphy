import { createRouter, createWebHistory, type RouterScrollBehavior } from 'vue-router'
import pagePaths from './page-paths.json'

const legacyTopicChapters: Record<string, string> = {
  foundations: 'anchors',
  metrology: 'unit-bridges',
  electromagnetism: 'electrical-standards',
  atomic: 'atomic-structure',
  particles: 'particle-scales',
  magnetism: 'spin-magnetism',
  thermal: 'heat-matter',
  'molar-matter': 'heat-matter',
}

function safeHashSelector(hash: string): string | null {
  if (!hash.startsWith('#')) return null
  try {
    const id = decodeURIComponent(hash.slice(1))
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(id)) return null
    const escapedId = id.replace(/[^A-Za-z0-9_-]/g, (character) => `\\${character.codePointAt(0)!.toString(16)} `)
    return `#${escapedId}`
  } catch {
    return null
  }
}

export const tourScrollBehavior: RouterScrollBehavior = (to, _from, savedPosition) => {
  if (savedPosition) return savedPosition
  const selector = safeHashSelector(to.hash)
  return selector ? { el: selector } : { top: 0 }
}
const onelabRoutes = import.meta.env.VITE_ONELAB_ENABLED === 'true'
  ? [{ path: pagePaths.onelab, name: 'onelab', component: () => import('../views/OnelabLabView.vue'), meta: { title: 'Browser ONELAB' } }]
  : []

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'overview', component: () => import('../views/OverviewView.vue'), meta: { title: 'Tour Orientation' } },
    { path: '/tour', name: 'tour', component: () => import('../views/TourMapView.vue'), meta: { title: 'Tour Map' } },
    {
      path: '/tour/:chapter',
      name: 'tour-chapter',
      component: () => import('../views/TourChapterView.vue'),
      props: true,
      meta: { title: 'Not Found' },
    },
    {
      path: '/tour/:chapter/:lesson',
      name: 'tour-lesson',
      component: () => import('../views/TourLessonView.vue'),
      props: true,
      meta: { title: 'Not Found' },
    },
    {
      path: '/topics/:id',
      name: 'legacy-topic',
      redirect: (to) => {
        const chapter = legacyTopicChapters[String(to.params.id)]
        return chapter
          ? { name: 'tour-chapter', params: { chapter } }
          : { path: '/not-found', query: { from: to.fullPath } }
      },
    },
    { path: '/atlas', name: 'atlas', component: () => import('../views/FormulaAtlasView.vue'), meta: { title: 'Formula Atlas' } },
    {
      path: pagePaths.formula,
      name: 'formula',
      component: () => import('../views/FormulaDetailView.vue'),
      props: true,
      meta: { title: 'Formula Record' },
    },
    { path: '/labs', name: 'labs', component: () => import('../views/LabsView.vue'), meta: { title: 'Labs' } },
    { path: '/labs/cases', name: 'case-hub', component: () => import('../views/CaseHubView.vue'), meta: { title: 'Simulation Cases' } },
    { path: '/labs/quantum-wave', name: 'quantum-wave', component: () => import('../views/QuantumWaveLabView.vue'), meta: { title: 'Quantum Wave Lab' } },
    { path: '/labs/edwin-gray', name: 'edwin-gray', component: () => import('../views/EdwinGrayLabView.vue'), meta: { title: 'Edwin Gray Motor Lab' } },
    { path: '/labs/authors/chenopdodium', name: 'fiddle-archive', component: () => import('../views/FiddleArchiveView.vue'), meta: { title: 'Fiddle Archive' } },
    { path: '/labs/authors/chenopdodium/:slug', name: 'fiddle-record', component: () => import('../views/FiddleRecordView.vue'), props: true, meta: { title: 'Fiddle Record' } },
    {
      path: '/labs/simulations',
      name: 'legacy-fiddle-archive',
      redirect: (to) => ({ name: 'fiddle-archive', query: to.query }),
    },
    {
      path: '/labs/simulations/:slug',
      name: 'legacy-fiddle-record',
      redirect: (to) => ({ name: 'fiddle-record', params: { slug: to.params.slug }, query: to.query }),
    },
    { path: '/labs/core', alias: '/core', name: 'core', component: () => import('../views/CoreLabView.vue'), meta: { title: 'Core Lab' } },
    { path: '/labs/walls', alias: '/walls', name: 'walls', component: () => import('../views/NumberWallsView.vue'), meta: { title: 'Number Walls' } },
    ...onelabRoutes,
    {
      path: '/labs/earth/:programId',
      name: 'earth-workbench',
      component: () => import('../views/EarthSimulationDetailView.vue'),
      props: (route) => ({ id: route.params.programId, surface: 'workbench' }),
      meta: { title: 'EARTH Workbench' },
    },
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
      props: (route) => ({ id: route.params.id, surface: 'evidence' }),
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
    { path: '/evidence', name: 'evidence', component: () => import('../views/EvidenceView.vue'), meta: { title: 'Evidence Guide' } },
    { path: '/saved', name: 'saved', component: () => import('../views/SavedView.vue'), meta: { title: 'Local Notebook' } },
    { path: '/not-found', name: 'not-found', component: () => import('../views/NotFoundView.vue'), meta: { title: 'Page Not Found' } },
    { path: '/:pathMatch(.*)*', name: 'catch-all', component: () => import('../views/NotFoundView.vue'), meta: { title: 'Page Not Found' } },
  ],
  scrollBehavior: tourScrollBehavior,
})

router.afterEach((to) => {
  if (typeof document === 'undefined') return
  const title = typeof to.meta.title === 'string' ? to.meta.title : 'OpenSimPhy Atlas'
  document.title = `${title} | OpenSimPhy Atlas`
})
