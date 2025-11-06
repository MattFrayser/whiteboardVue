import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        checker({
            typescript: true,
        }),
    ],
})
