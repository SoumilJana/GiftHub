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
await db.exec(`insert into auth.users (id) values ('${A}'),('${B}'),('${D}'); update profiles set display_name='Sam Rivera' where id='${B}';`)
const as = async (u, sql) => { await db.exec(`reset role; set request.jwt.claim.sub='${u}'; set role authenticated;`); return (await db.query(sql)).rows }
let fails = 0
const expect = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }
const circle = (await as(A, `select * from create_circle('Maya & Sam')`))[0]
expect('invite code format', /^[A-HJKMNP-Z2-9]{6}$/.test(circle.invite_code), true)
await as(A, `insert into items (id, owner_id, title, priority) values ('${I}','${A}','Keyboard',9)`)
await as(A, `insert into item_circles values ('${I}','${circle.id}')`)
await as(B, `select join_circle('${circle.invite_code.toLowerCase()}')`)
expect('Sam sees Maya item', (await as(B, `select count(*)::int n from items`))[0].n, 1)
// Phase 3: claims only through functions.
let err = ''
const fails_with = async (u, sql, re) => { try { await as(u, sql); return 'no error' } catch (e) { return re.test(e.message) ? 'refused' : e.message } }
expect('Maya sees no claims in the Circle before any claim', (await as(A, `select count(*)::int n from circle_claims('${circle.id}')`))[0].n, 0)
const mayaBefore = await fails_with(A, `select claim_item('${I}','reserved')`, /isn’t available/)
expect('Maya cannot claim own item', mayaBefore, 'refused')
await as(B, `select claim_item('${I}','reserved')`)
expect('Sam sees his claim, marked as his', await as(B, `select status::text, mine from circle_claims('${circle.id}')`), [{ status: 'reserved', mine: true }])
await as(B, `select claim_item('${I}','bought')`)
expect('Sam can change reserved to bought', (await as(B, `select status::text s from circle_claims('${circle.id}')`))[0].s, 'bought')
expect('Maya sees NO claim through circle_claims', (await as(A, `select count(*)::int n from circle_claims('${circle.id}')`))[0].n, 0)
expect('Maya gets the same answer claimed or not', await fails_with(A, `select claim_item('${I}','reserved')`, /isn’t available/), mayaBefore)
expect('Maya cannot read the claims table', await fails_with(A, `select count(*) from claims`, /permission denied/), 'refused')
expect('Sam cannot read the claims table either', await fails_with(B, `select count(*) from claims`, /permission denied/), 'refused')
expect('Sam cannot write the claims table directly', await fails_with(B, `insert into claims (item_id, claimed_by) values ('${I}','${B}')`, /permission denied/), 'refused')
expect('Maya cannot unclaim for Sam', (await as(A, `select unclaim_item('${I}')`), (await as(B, `select count(*)::int n from circle_claims('${circle.id}')`))[0].n), 1)
expect('stranger cannot claim', await fails_with(D, `select claim_item('${I}','reserved')`, /isn’t available/), 'refused')
expect('stranger sees no claims', (await as(D, `select count(*)::int n from circle_claims('${circle.id}')`))[0].n, 0)
expect('Sam receives live signals for the Circle', (await as(B, `select count(*)::int n from claim_signals where circle_id='${circle.id}'`))[0].n > 0, true)
expect('Maya receives NO live signals about her wishes', (await as(A, `select count(*)::int n from claim_signals`))[0].n, 0)
expect('stranger receives no live signals', (await as(D, `select count(*)::int n from claim_signals`))[0].n, 0)
expect('claims are not in the Realtime publication', (await db.query(`select count(*)::int n from pg_publication_tables where pubname='supabase_realtime' and tablename='claims'`)).rows[0].n, 0)
expect('stranger sees no items', (await as(D, `select count(*)::int n from items`))[0].n, 0)
expect('stranger sees no circles', (await as(D, `select count(*)::int n from circles`))[0].n, 0)
const bad = (await as(D, `select join_circle('AAAAAA') r`))[0].r
expect('bad code returns null', bad, null)
for (let i = 0; i < 4; i++) { try { await as(D, `select join_circle('AAAAAA')`) } catch {} }
err=''; try { await as(D, `select join_circle('${circle.invite_code}')`) } catch (e) { err = e.message }
expect('rate limit after 5 tries', /Too many tries/.test(err), true)
err=''; try { await as(D, `insert into circle_members values ('${circle.id}','${D}','owner')`) } catch (e) { err = e.message }
expect('no direct membership insert', /row-level security/.test(err), true)
expect('Sam cannot mark Maya’s wish received', await fails_with(B, `select * from mark_received('${I}')`, /isn’t on your list/), 'refused')
expect('Maya sees no givers before receiving', (await as(A, `select count(*)::int n from my_received()`))[0].n, 0)
expect('mark received reveals the giver', await as(A, `select giver_name, claim_status::text from mark_received('${I}')`), [{ giver_name: 'Sam Rivera', claim_status: 'bought' }])
expect('Received lists the giver', await as(A, `select giver_name from my_received()`), [{ giver_name: 'Sam Rivera' }])
expect('a received wish leaves Sam’s claim list', (await as(B, `select count(*)::int n from circle_claims('${circle.id}')`))[0].n, 0)
expect('a received wish cannot be claimed', await fails_with(B, `select claim_item('${I}','reserved')`, /isn’t available/), 'refused')
await as(A, `update items set status='active' where id='${I}'`)
await as(B, `select unclaim_item('${I}')`)
expect('Sam can undo his claim', (await as(B, `select count(*)::int n from circle_claims('${circle.id}')`))[0].n, 0)
await as(A, `delete from circle_members where user_id='${B}'`)
expect('removed Sam loses items', (await as(B, `select count(*)::int n from items`))[0].n, 0)
expect('removed Sam loses claims view', (await as(B, `select count(*)::int n from circle_claims('${circle.id}')`))[0].n, 0)
expect('removed Sam loses live signals', (await as(B, `select count(*)::int n from claim_signals`))[0].n, 0)

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
await as(FR, `select claim_item('${I3}','reserved')`)
expect('BF sees only Couple', (await as(BF, `select name from circles order by name`)).map((r) => r.name), ['Couple'])
expect('BF sees GF in one Circle only', (await as(BF, `select count(*)::int n from circle_members where user_id='${GF}'`))[0].n, 1)
expect('BF cannot see Crew members', (await as(BF, `select count(*)::int n from circle_members where circle_id='${crew.id}'`))[0].n, 0)
expect('BF cannot read FRIEND profile', (await as(BF, `select count(*)::int n from profiles where id='${FR}'`))[0].n, 0)
expect('BF sees Couple items, not Crew-only', (await as(BF, `select title from items where owner_id='${GF}' order by title`)).map((r) => r.title), ['Both', 'Couple only'])
expect('BF sees only Couple sharing of a shared item', (await as(BF, `select count(*)::int n from item_circles where item_id='${I3}'`))[0].n, 1)
expect('BF sees "Already claimed", not who or from where', await as(BF, `select * from circle_claims('${couple.id}')`), [{ item_id: I3, status: 'reserved', mine: false }])
expect('BF cannot take over FRIEND’s claim', await fails_with(BF, `select claim_item('${I3}','bought')`, /already claimed/), 'refused')
expect('BF cannot undo FRIEND’s claim', (await as(BF, `select unclaim_item('${I3}')`), (await as(FR, `select count(*)::int n from circle_claims('${crew.id}')`))[0].n), 1)
expect('BF cannot read Crew claims', (await as(BF, `select count(*)::int n from circle_claims('${crew.id}')`))[0].n, 0)
expect('BF cannot read Crew signals', (await as(BF, `select count(*)::int n from claim_signals where circle_id='${crew.id}'`))[0].n, 0)
expect('GF still sees no claim', (await as(GF, `select (select count(*)::int from circle_claims('${couple.id}')) + (select count(*)::int from circle_claims('${crew.id}')) + (select count(*)::int from claim_signals) n`))[0].n, 0)

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

// Phase 2: save_item, unsharing on leave, photo quota.
const P1='00000000-0000-0000-0000-0000000000c1', P2='00000000-0000-0000-0000-0000000000c2', P3='00000000-0000-0000-0000-0000000000c3'
await db.exec(`reset role; insert into auth.users (id) values ('${P1}'),('${P2}'),('${P3}');`)
const home = (await as(P1, `select * from create_circle('Home')`))[0]
const other = (await as(P3, `select * from create_circle('Not mine')`))[0]
await as(P2, `select join_circle('${home.invite_code}')`)
const wish = (await as(P1, `select save_item(null, '  Lamp ', 'https://www.Muji.com/x?y=1', null, 45, 'eur', 7::smallint, '', array['birthday','holiday']::occasion[], array['${home.id}','${other.id}']::uuid[]) id`))[0].id
expect('save_item stores the domain and currency', (await as(P1, `select title, domain, currency::text, notes from items where id='${wish}'`))[0], { title: 'Lamp', domain: 'muji.com', currency: 'EUR', notes: null })
expect('save_item skips Circles you are not in', (await as(P1, `select count(*)::int n from item_circles where item_id='${wish}'`))[0].n, 1)
expect('Circle-mate sees the wish and its occasions', (await as(P2, `select count(*)::int n from item_occasions where item_id='${wish}'`))[0].n, 2)
await as(P1, `select save_item('${wish}', 'Lamp', null, null, null, 'EUR', 4::smallint, null, array['holiday']::occasion[], array[]::uuid[])`)
expect('editing can unshare and drop occasions', (await as(P2, `select count(*)::int n from items where id='${wish}'`))[0].n, 0)
err=''; try { await as(P2, `select save_item('${wish}', 'Mine now', null, null, null, 'EUR', 5::smallint, null, null, null)`) } catch (e) { err = e.message }
expect('cannot edit someone else\'s wish', /no longer exists/.test(err), true)
const w2 = (await as(P2, `select save_item(null, 'Socks', null, null, null, 'USD', 5::smallint, null, null, array['${home.id}']::uuid[]) id`))[0].id
expect('P1 sees P2 wish', (await as(P1, `select count(*)::int n from items where id='${w2}'`))[0].n, 1)
await as(P2, `delete from circle_members where circle_id='${home.id}' and user_id='${P2}'`)
await as(P2, `select join_circle('${home.invite_code}')`)
expect('leaving unshares your wishes (rejoining does not reshare)', (await as(P1, `select count(*)::int n from items where id='${w2}'`))[0].n, 0)
expect('share_my_items shares all active wishes', (await as(P2, `select share_my_items('${home.id}') n`))[0].n, 1)
expect('P1 sees P2 wish again', (await as(P1, `select count(*)::int n from items where id='${w2}'`))[0].n, 1)
for (let i = 0; i < 10; i++) await as(P1, `insert into storage.objects (bucket_id, name) values ('item-photos', '${P1}/${i}.webp')`)
err=''; try { await as(P1, `insert into storage.objects (bucket_id, name) values ('item-photos', '${P1}/10.webp')`) } catch (e) { err = e.message }
expect('11th photo is refused', /row-level security/.test(err), true)
err=''; try { await as(P2, `insert into storage.objects (bucket_id, name) values ('item-photos', '${P1}/x.webp')`) } catch (e) { err = e.message }
expect('cannot upload into someone else\'s folder', /row-level security/.test(err), true)

console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0)
