import { defineConfig, build as viteBuild } from 'vite';
import { resolve, basename } from 'path';
import {
  copyFileSync,
  existsSync,
  readdirSync,
  renameSync,
  rmSync,
  cpSync
} from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        popup: resolve(__dirname, 'src/pages/popup.html'),
        blocked: resolve(__dirname, 'src/pages/blocked.html'),
        options: resolve(__dirname, 'src/pages/options.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  },
  plugins: [
    {
      name: 'navguard-build-content-iife',
      async closeBundle() {
        console.log('[NavGuard] Building content.js as IIFE...');
        await viteBuild({
          configFile: false,
          logLevel: 'warn',
          build: {
            outDir: resolve(__dirname, 'dist'),
            emptyOutDir: false,
            lib: {
              entry: resolve(__dirname, 'src/content/index.ts'),
              name: 'NavGuardContent',
              formats: ['iife'],
              fileName: () => 'content.js'
            }
          }
        });
      }
    },
    {
      name: 'navguard-postbuild',
      closeBundle() {
        const dist = resolve(__dirname, 'dist');

        // 1. Copy manifest.json
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(dist, 'manifest.json')
        );

        // 2. Copy injected.js
        const injectedSrc = resolve(__dirname, 'src/injected/injected.js');
        if (existsSync(injectedSrc)) {
          copyFileSync(injectedSrc, resolve(dist, 'injected.js'));
        }

        // 3. Copy thư mục assets (chứa icons)
        const assetsSrc = resolve(__dirname, 'assets');
        if (existsSync(assetsSrc)) {
          cpSync(assetsSrc, resolve(dist, 'assets'), { recursive: true });
          console.log('[NavGuard] Đã copy thư mục assets/');
        } else {
          console.warn('[NavGuard] CẢNH BÁO: Không tìm thấy thư mục assets/');
        }

        // 4. Move HTML từ dist/src/pages/ về dist/
        const srcPagesDir = resolve(dist, 'src/pages');
        if (existsSync(srcPagesDir)) {
          const htmlFiles = readdirSync(srcPagesDir).filter((f) =>
            f.endsWith('.html')
          );
          for (const file of htmlFiles) {
            renameSync(
              resolve(srcPagesDir, file),
              resolve(dist, basename(file))
            );
          }
          rmSync(resolve(dist, 'src'), { recursive: true, force: true });
        }

        console.log('[NavGuard] Post-build: HTML files moved to dist root');
      }
    }
  ]
});
