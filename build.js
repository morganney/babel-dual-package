await import(
  `./src/index.js?args=${encodeURIComponent(
    JSON.stringify({
      '--out-dir': 'dist',
      '--no-cjs-dir': '',
      '--no-comments': '',
      files: ['src/*.js']
    })
  )}`
)
