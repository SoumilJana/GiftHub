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
expect('BF sees "Already claimed", not who or from where', await as(BF, `select * from circle_claims('${couple.id}')`), [{ item_id: I3, status: 'reserved', mine: false, give_on: null }])
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

// Phase 3.5: gift hand-off. H1 owns the wish, H2 gives it, H3 is another giver.
const H1='00000000-0000-0000-0000-0000000000a1', H2='00000000-0000-0000-0000-0000000000a2', H3='00000000-0000-0000-0000-0000000000a3', HI='33333333-3333-3333-3333-333333333331'
await db.exec(`reset role; insert into auth.users (id) values ('${H1}'),('${H2}'),('${H3}'); update profiles set display_name='Ana' where id='${H2}';`)
const fam = (await as(H1, `select * from create_circle('Family')`))[0]
await as(H2, `select join_circle('${fam.invite_code}')`); await as(H3, `select join_circle('${fam.invite_code}')`)
await as(H1, `insert into items (id, owner_id, title) values ('${HI}','${H1}','Headphones')`)
await as(H1, `insert into item_circles values ('${HI}','${fam.id}')`)
await as(H2, `select claim_item('${HI}','bought')`)
await as(H2, `select set_give_date('${HI}', current_date - 2)`)
expect('giver sees their give date', (await as(H2, `select give_on is not null d from circle_claims('${fam.id}')`))[0].d, true)
expect('other giver never sees the give date', (await as(H3, `select give_on from circle_claims('${fam.id}')`))[0].give_on, null)
expect('other giver cannot set the date', await fails_with(H3, `select set_give_date('${HI}', current_date)`, /isn’t yours/), 'refused')
expect('giver is reminded once the date has passed', (await as(H2, `select title, owner_name from my_due_gifts(current_date)`)), [{ title: 'Headphones', owner_name: '' }])
expect('a date in the future is not due', (await as(H2, `select set_give_date('${HI}', current_date + 3)`), (await as(H2, `select count(*)::int n from my_due_gifts(current_date)`))[0].n), 0)
expect('a faked far-future "today" is clamped', (await as(H2, `select count(*)::int n from my_due_gifts(current_date + 30)`))[0].n, 0)
expect('receiver has no prompt and no notification before the hand-off', (await as(H1, `select (select count(*)::int from received_prompts()) + (select count(*)::int from notifications) n`))[0].n, 0)
expect('receiver cannot see due gifts', (await as(H1, `select count(*)::int n from my_due_gifts(current_date + 1)`))[0].n, 0)
expect('other giver cannot mark it given', await fails_with(H3, `select mark_given('${HI}')`, /isn’t yours/), 'refused')
await as(H2, `select mark_given('${HI}')`)
expect('receiver is asked after the hand-off, with the giver named', await as(H1, `select title, giver_name from received_prompts()`), [{ title: 'Headphones', giver_name: 'Ana' }])
expect('given gifts are no longer due', (await as(H2, `select count(*)::int n from my_due_gifts(current_date + 1)`))[0].n, 0)
expect('other giver gets no prompt', (await as(H3, `select (select count(*)::int from received_prompts()) + (select count(*)::int from notifications) n`))[0].n, 0)
const pid = (await as(H1, `select id from received_prompts()`))[0].id
expect('others cannot dismiss the prompt', (await as(H3, `select dismiss_prompt('${pid}')`), (await as(H1, `select count(*)::int n from received_prompts()`))[0].n), 1)
await as(H1, `select * from mark_received('${HI}')`)
expect('Mark received clears the prompt', (await as(H1, `select count(*)::int n from received_prompts()`))[0].n, 0)
await as(H1, `update items set status='active' where id='${HI}'`)
await as(H2, `select claim_item('${HI}','reserved')`)
expect('going back to reserved resets the hand-off', (await as(H2, `select give_on from circle_claims('${fam.id}')`))[0].give_on, null)

// Phase 3.6: couple and group Circles. Kai and Lee are a couple; Max and Nia start as a pair group.
const K1='00000000-0000-0000-0000-0000000000b1', K2='00000000-0000-0000-0000-0000000000b2', K3='00000000-0000-0000-0000-0000000000b3', K4='00000000-0000-0000-0000-0000000000b4'
await db.exec(`reset role; insert into auth.users (id) values ('${K1}'),('${K2}'),('${K3}'),('${K4}'); update profiles set display_name='Kai Park' where id='${K1}'; update profiles set display_name='Lee' where id='${K2}';`)
const c1 = (await as(K1, `select * from create_circle(null, 'couple')`))[0]
expect('a couple Circle needs no name', [c1.name, c1.kind, c1.kind_confirmed], [null, 'couple', true])
expect('a second couple Circle is refused', await fails_with(K1, `select * from create_circle(null, 'couple')`, /already in a couple/), 'refused')
expect('a group still needs a name', await fails_with(K1, `select * from create_circle('  ', 'group')`, /Give your Circle a name/), 'refused')
const pair = (await as(K3, `select * from create_circle('Pair')`))[0]
await as(K4, `select join_circle('${pair.invite_code}')`)
expect('a group member cannot change the kind', await fails_with(K4, `select * from set_circle_kind('${pair.id}', 'couple')`, /Only the Circle owner/), 'refused')
await as(K3, `select * from set_circle_kind('${pair.id}', 'couple')`)
expect('a group of two can become a couple', (await as(K3, `select kind::text k from circles where id='${pair.id}'`))[0].k, 'couple')
expect('someone in a couple cannot join another couple', await fails_with(K3, `select join_circle('${c1.invite_code}')`, /already in a couple/), 'refused')
await as(K2, `select join_circle('${c1.invite_code}')`)
expect('a couple Circle closes at two people', await fails_with(H3, `select join_circle('${c1.invite_code}')`, /already has two people/), 'refused')
await as(K2, `update circles set name='Us' where id='${c1.id}'`)
expect('either partner can rename', (await as(K1, `select name from circles where id='${c1.id}'`))[0].name, 'Us')
await as(K2, `update circles set name=null where id='${c1.id}'`)
expect('clearing the name goes back to automatic', (await as(K1, `select name from circles where id='${c1.id}'`))[0].name, null)
expect('the kind cannot be changed directly', await fails_with(K2, `update circles set kind='group' where id='${c1.id}'`, /permission denied/), 'refused')
const solo = (await as(K1, `select * from create_circle('Solo two')`))[0]
expect('someone in a couple cannot make a second one', await fails_with(K1, `select * from set_circle_kind('${solo.id}', 'couple')`, /already in a couple/), 'refused')
expect('a group cannot lose its name', await fails_with(K1, `update circles set name=null where id='${solo.id}'`, /circles_name_check/), 'refused')
expect('three people cannot be a couple', await fails_with(H1, `select * from set_circle_kind('${fam.id}', 'couple')`, /has more/), 'refused')
await as(K2, `select * from set_circle_kind('${c1.id}', 'group')`)
expect('an unnamed couple becoming a group is named after them', (await as(K1, `select name, kind::text k from circles where id='${c1.id}'`))[0], { name: 'Kai & Lee', k: 'group' })
expect('a group member cannot delete it', (await as(K2, `delete from circles where id='${c1.id}'`), (await as(K1, `select count(*)::int n from circles where id='${c1.id}'`))[0].n), 1)
await as(K4, `delete from circles where id='${pair.id}'`)
expect('either partner can delete a couple Circle', (await as(K3, `select count(*)::int n from circles where id='${pair.id}'`))[0].n, 0)

console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0)
