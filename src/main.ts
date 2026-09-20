import { createVaporApp, vaporInteropPlugin, type VaporComponent } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import { installAwesomePhysicsRoutes } from './awesomePhysics/routes'
import { installVaporRouter } from './router/installVaporRouter'
import { router } from './router'
import './styles/main.css'
import './styles/fiddles.css'

registerSW({ immediate: true })

installAwesomePhysicsRoutes(router)

const app = createVaporApp(App as VaporComponent)
app.use(vaporInteropPlugin)
installVaporRouter(app, router)
app.mount('#app')
