import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import { installAwesomePhysicsRoutes } from './awesomePhysics/routes'
import { router } from './router'
import './styles/main.css'
import './styles/fiddles.css'

registerSW({ immediate: true })

installAwesomePhysicsRoutes(router)
createApp(App).use(router).mount('#app')
