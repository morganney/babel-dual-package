/* eslint-disable n/no-missing-import, n/no-unpublished-import */

await import(
  `./src/index.js?args=${encodeURIComponent(
    JSON.stringify({
      '--out-dir': 'dist',
      '--no-cjs-dir': '',
      files: ['src/*.js']
    })
  )}`
)
