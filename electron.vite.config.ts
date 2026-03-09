import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

const sharedAlias = path.resolve(__dirname, 'src/shared')
const featuresAlias = path.resolve(__dirname, 'src/features')
const libAlias = path.resolve(__dirname, 'src/lib')

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': sharedAlias,
        '@lib': libAlias
      }
    },
    build: {
      lib: {
        entry: path.resolve(__dirname, 'electron/main/index.ts')
      },
      rollupOptions: {
        external: ['better-sqlite3']
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': sharedAlias,
        '@lib': libAlias
      }
    }
    ,
    build: {
      lib: {
        entry: path.resolve(__dirname, 'electron/preload/index.ts')
      }
    }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': sharedAlias,
        '@features': featuresAlias,
        '@lib': libAlias
      }
    }
  }
})

