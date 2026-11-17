import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// RLS privacy tests: applies every migration to an in-memory Postgres (PGlite)
// and checks who can see what. Core rule: an owner never receives claim data
// for their own items until they mark the item received.
// A = Maya (item owner), B = Sam (giver), D = stranger.
const here = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(here, '..', 'migrations')

const db = new PGlite({ extensions: { pgcrypto } })
await db.exec(fs.readFileSync(path.join(here, 'supabase-stub.sql'), 'utf8'))
for (const f of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(fs.readFileSync(path.join(migrationsDir, f), 'utf8'))
}
console.log('migrations applied')
const A='00000000-0000-0000-0000-00000000000a',B='00000000-0000-0000-0000-00000000000b',D='00000000-0000-0000-0000-00000000000d',I='11111111-1111-1111-1111-111111111111'
await db.exec(`grant usage on schema public to authenticated; grant all on all tables in schema public to authenticated;
insert into auth.users (id) values ('${A}'),('${B}'),('${D}');`)
const as = async (u, sql) => { await db.exec(`reset role; set request.jwt.claim.sub='${u}'; set role authenticated;`); return (await db.query(sql)).rows }
let fails = 0
const expect = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }
const circle = (await as(A, `select * from create_circle('Maya & Sam')`))[0]
expect('invite code format', /^[A-HJKMNP-Z2-9]{6}$/.test(circle.invite_code), true)
await as(A, `insert into items (id, owner_id, title, priority) values ('${I}','${A}','Keyboard',9)`)
await as(A, `insert into item_circles values ('${I}','${circle.id}')`)
await as(B, `select join_circle('${circle.invite_code.toLowerCase()}')`)
expect('Sam sees Maya item', (await as(B, `select count(*)::int n from items`))[0].n, 1)
await as(B, `insert into claims (item_id, claimed_by, status) values ('${I}','${B}','bought')`)
expect('Sam sees claim', (await as(B, `select count(*)::int n from claims`))[0].n, 1)
expect('Maya sees NO claim', (await as(A, `select count(*)::int n from claims`))[0].n, 0)
let err = ''; try { await as(A, `insert into claims (item_id, claimed_by) values ('${I}','${A}')`) } catch (e) { err = e.message }
expect('Maya cannot claim own item (RLS, not unique leak)', /row-level security/.test(err), true)
err=''; try { await as(B, `update claims set claimed_by='${A}'`) } catch (e) { err = e.message }
expect('Sam cannot reassign claim', /row-level security/.test(err), true)
expect('stranger sees no items', (await as(D, `select count(*)::int n from items`))[0].n, 0)
expect('stranger sees no circles', (await as(D, `select count(*)::int n from circles`))[0].n, 0)
const bad = (await as(D, `select join_circle('AAAAAA') r`))[0].r
expect('bad code returns null', bad, null)
for (let i = 0; i < 4; i++) { try { await as(D, `select join_circle('AAAAAA')`) } catch {} }
err=''; try { await as(D, `select join_circle('${circle.invite_code}')`) } catch (e) { err = e.message }
expect('rate limit after 5 tries', /Too many tries/.test(err), true)
err=''; try { await as(D, `insert into circle_members values ('${circle.id}','${D}','owner')`) } catch (e) { err = e.message }
expect('no direct membership insert', /row-level security/.test(err), true)
await as(A, `update items set status='received' where id='${I}'`)
expect('Maya sees claim after received', (await as(A, `select count(*)::int n from claims`))[0].n, 1)
await as(A, `delete from circle_members where user_id='${B}'`)
expect('removed Sam loses items', (await as(B, `select count(*)::int n from items`))[0].n, 0)
expect('removed Sam loses claims view', (await as(B, `select count(*)::int n from claims`))[0].n, 0)
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0)
