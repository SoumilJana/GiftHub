// Copies the clickable design prototype into the build so it is served at /demo.html.
// design/circle-workspace.html stays the single source; the copy is gitignored.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const web = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(web, 'public'), { recursive: true })
copyFileSync(join(web, '..', 'design', 'circle-workspace.html'), join(web, 'public', 'demo.html'))
