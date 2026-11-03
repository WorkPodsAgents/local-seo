import { defineConfig } from 'vitest/config'

// Vitest blanks CSS imports by default; the category overlay imports the WorkPods tokens as text
// to declare them in its shadow root, so its tests need the real file.
export default defineConfig({ test: { css: { include: [/tokens\.css/] } } })
