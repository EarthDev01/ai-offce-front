import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'

import App from './App.vue'
import router from './router'
// reset ของ antd ย้ายเข้าไป @import ใน style.css แล้ว (ต้องอยู่ใน layer base ไม่งั้นทับ utility ของ Tailwind)
import './style.css'

createApp(App).use(createPinia()).use(router).use(Antd).mount('#app')
