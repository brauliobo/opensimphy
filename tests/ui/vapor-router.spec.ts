import { flushPromises } from '@vue/test-utils'
import { createVaporApp, vaporInteropPlugin, type VaporComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../../src/App.vue'
import { installVaporRouter } from '../../src/router/installVaporRouter'
import { emptyVaporView } from './vaporStubs'

describe('vapor router bootstrap', () => {
  it('mounts the vapor app shell without reading config of undefined', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'overview', component: emptyVaporView },
        { path: '/labs', name: 'labs', component: emptyVaporView },
        { path: '/tour', name: 'tour', component: emptyVaporView },
        { path: '/atlas', name: 'atlas', component: emptyVaporView },
        { path: '/evidence', name: 'evidence', component: emptyVaporView },
        { path: '/saved', name: 'saved', component: emptyVaporView },
        { path: '/awesome-physics', name: 'awesome-physics-catalog', component: emptyVaporView },
      ],
    })
    await router.push('/')
    const app = createVaporApp(App as VaporComponent)
    app.use(vaporInteropPlugin)
    installVaporRouter(app, router)
    app.mount('#app')
    await router.isReady()
    await flushPromises()
    expect(document.querySelector('[data-testid="app-ready"]')).not.toBeNull()
    app.unmount()
  })
})
