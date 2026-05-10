{
  "name": "paulferrante-dashboard",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "prebuild": "rm -f assets/index-*.js && rm -f assets/*-*.js",
    "build": "vite build",
    "postbuild": "cp -f dist/src/index.html index.html && cp -rf dist/assets/* assets/ 2>/dev/null || true && rm -rf dist",
    "preview": "vite preview"
  },
  "dependencies": {
    "html2canvas": "^1.4.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.13.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
