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

// Sign-up currency: detected currency from user metadata becomes the profile currency.
await db.exec(`reset role; insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', '{"currency":"inr"}'),
  ('00000000-0000-0000-0000-0000000000e2', '{"currency":"rupees"}'),
  ('00000000-0000-0000-0000-0000000000e3', '{}');`)
const cur = (await db.query(`select currency from profiles where id::text like '%0000000000e%' order by id`)).rows.map((r) => r.currency.trim())
expect('signup currency from metadata, invalid falls back to USD', cur, ['INR', 'USD', 'USD'])

// Each Circle is its own room (PRODUCT.md principle 6).
// GF is in "Couple" with BF and in "Crew" with FRIEND. BF must learn nothing about Crew.
const GF='00000000-0000-0000-0000-0000000000f1', BF='00000000-0000-0000-0000-0000000000f2', FR='00000000-0000-0000-0000-0000000000f3', OUT='00000000-0000-0000-0000-0000000000f4'
const I1='22222222-2222-2222-2222-222222222221', I2='22222222-2222-2222-2222-222222222222', I3='22222222-2222-2222-2222-222222222223'
await db.exec(`reset role; insert into auth.users (id) values ('${GF}'),('${BF}'),('${FR}'),('${OUT}');`)
const couple = (await as(GF, `select * from create_circle('Couple')`))[0]
const crew = (await as(GF, `select * from create_circle('Crew')`))[0]
await as(BF, `select join_circle('${couple.invite_code}')`)
await as(FR, `select join_circle('${crew.invite_code}')`)
await as(GF, `insert into items (id, owner_id, title) values ('${I1}','${GF}','Couple only'),('${I2}','${GF}','Crew only'),('${I3}','${GF}','Both')`)
await as(GF, `insert into item_circles values ('${I1}','${couple.id}'),('${I2}','${crew.id}'),('${I3}','${couple.id}'),('${I3}','${crew.id}')`)
await as(FR, `insert into claims (item_id, claimed_by) values ('${I3}','${FR}')`)
expect('BF sees only Couple', (await as(BF, `select name from circles order by name`)).map((r) => r.name), ['Couple'])
expect('BF sees GF in one Circle only', (await as(BF, `select count(*)::int n from circle_members where user_id='${GF}'`))[0].n, 1)
expect('BF cannot see Crew members', (await as(BF, `select count(*)::int n from circle_members where circle_id='${crew.id}'`))[0].n, 0)
expect('BF cannot read FRIEND profile', (await as(BF, `select count(*)::int n from profiles where id='${FR}'`))[0].n, 0)
expect('BF sees Couple items, not Crew-only', (await as(BF, `select title from items where owner_id='${GF}' order by title`)).map((r) => r.title), ['Both', 'Couple only'])
expect('BF sees only Couple sharing of a shared item', (await as(BF, `select count(*)::int n from item_circles where item_id='${I3}'`))[0].n, 1)
expect('BF still sees the item is claimed', (await as(BF, `select count(*)::int n from claims where item_id='${I3}'`))[0].n, 1)
expect('GF still sees no claim', (await as(GF, `select count(*)::int n from claims`))[0].n, 0)

// Ownership and roles.
err=''; try { await as(BF, `select transfer_ownership('${couple.id}','${BF}')`) } catch (e) { err = e.message }
expect('non-owner cannot transfer', /Only the Circle owner/.test(err), true)
await as(GF, `select transfer_ownership('${couple.id}','${BF}')`)
expect('transfer makes BF owner, GF admin', (await as(BF, `select role::text r from circle_members where circle_id='${couple.id}' order by user_id`)).map((r) => r.r), ['admin', 'owner'])
await as(BF, `select set_member_role('${couple.id}','${GF}','member')`)
expect('owner sets GF to member', (await as(BF, `select role::text r from circle_members where circle_id='${couple.id}' and user_id='${GF}'`))[0].r, 'member')
err=''; try { await as(GF, `delete from circle_members where circle_id='${couple.id}' and user_id='${BF}'`) } catch (e) { err = e.message }
expect('member cannot remove owner', (await as(BF, `select count(*)::int n from circle_members where circle_id='${couple.id}'`))[0].n, 2)

// Account deletion: owned Circles pass on, empty ones go, other Circles survive.
await as(OUT, `select * from create_circle('Solo')`)
await as(OUT, `select delete_account()`)
expect('deleted user\'s empty Circle is gone', (await db.query(`reset role; select count(*)::int n from circles where name='Solo'`).catch(async () => { await db.exec('reset role'); return db.query(`select count(*)::int n from circles where name='Solo'`) })).rows[0].n, 0)
await as(GF, `select delete_account()`)
await db.exec('reset role')
expect('Crew passes to FRIEND', (await db.query(`select role::text r from circle_members where circle_id='${crew.id}'`)).rows.map((r) => r.r), ['owner'])
expect('Couple survives with BF', (await db.query(`select count(*)::int n from circle_members where circle_id='${couple.id}'`)).rows[0].n, 1)
expect('GF items and profile are gone', (await db.query(`select (select count(*)::int from items where owner_id='${GF}') + (select count(*)::int from profiles where id='${GF}') n`)).rows[0].n, 0)
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0)
