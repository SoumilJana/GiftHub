import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Edge cases (Phase 4.5, pre-beta check): races, people leaving mid-way, odd input.
// Same set-up as rls.test.mjs: every migration on an in-memory Postgres.
const here = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(here, '..', 'migrations')
const db = new PGlite({ extensions: { pgcrypto } })
await db.exec(fs.readFileSync(path.join(here, 'supabase-stub.sql'), 'utf8'))
for (const f of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(fs.readFileSync(path.join(migrationsDir, f), 'utf8'))
}

const as = async (u, sql) => { await db.exec(`reset role; set request.jwt.claim.sub='${u}'; set role authenticated;`); return (await db.query(sql)).rows }
const admin = async (sql) => { await db.exec('reset role'); return (await db.exec(sql)).at(-1)?.rows ?? [] }
let fails = 0
const expect = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }
const refused = async (u, sql, re) => { try { await as(u, sql); return 'no error' } catch (e) { return re.test(e.message) ? 'refused' : e.message } }
const n = async (u, sql) => (await as(u, `select count(*)::int n from (${sql}) x`))[0].n
const uuid = (k) => `00000000-0000-0000-0000-${String(k).padStart(12, '0')}`

// O owns the wishes; G1, G2 and G3 are givers in the same Circle.
const O = uuid('e01'), G1 = uuid('e02'), G2 = uuid('e03'), G3 = uuid('e04')
await admin(`insert into auth.users (id) values ('${O}'),('${G1}'),('${G2}'),('${G3}'); update profiles set display_name='Gia' where id='${G1}';`)
const fam = (await as(O, `select * from create_circle('Family')`))[0]
for (const g of [G1, G2, G3]) await as(g, `select join_circle('${fam.invite_code}')`)
const wish = async (title) => (await as(O, `select save_item(null, '${title}', null, null, 100, 'INR', 5::smallint, null, null, array['${fam.id}']::uuid[]) id`))[0].id

// --- Claims: only one winner -------------------------------------------------
const W1 = await wish('Kettle')
expect('a wish can carry only one claim (unique item_id)', (await admin(`select count(*)::int n from pg_indexes where tablename='claims' and indexdef ilike '%unique%(item_id)%'`))[0].n, 1)
await as(G1, `select claim_item('${W1}','reserved')`)
expect('the second giver to claim is told it is taken', await refused(G2, `select claim_item('${W1}','bought')`, /already claimed/), 'refused')
expect('…and the first claim is unchanged', await as(G1, `select status::text s, mine from circle_claims('${fam.id}') where item_id='${W1}'`), [{ s: 'reserved', mine: true }])
expect('claiming twice is harmless for the same giver', (await as(G1, `select claim_item('${W1}','reserved')`), await n(G1, `select 1 from circle_claims('${fam.id}') where item_id='${W1}'`)), 1)
expect('a claim on a made-up wish is refused', await refused(G1, `select claim_item('${uuid('dead')}','reserved')`, /isn’t available/), 'refused')
expect('a claim with no sign-in is refused', await (async () => { try { await admin(`set request.jwt.claim.sub=''; set role authenticated; select claim_item('${W1}','reserved')`); return 'no error' } catch (e) { return /Sign in|uuid/.test(e.message) ? 'refused' : e.message } })(), 'refused')

// --- The owner deletes a claimed wish ------------------------------------------
const W2 = await wish('Lamp')
await as(G2, `select claim_item('${W2}','bought')`)
await as(O, `delete from items where id='${W2}'`)
expect('deleting a claimed wish removes the claim', (await admin(`select count(*)::int n from claims where item_id='${W2}'`))[0].n, 0)
expect('…and the giver sees nothing left of it', await n(G2, `select 1 from circle_claims('${fam.id}') where item_id='${W2}'`), 0)

// --- The owner stops sharing a claimed wish with the Circle --------------------
const W3 = await wish('Scarf')
await as(G2, `select claim_item('${W3}','reserved')`)
await as(O, `select save_item('${W3}', 'Scarf', null, null, 100, 'INR', 5::smallint, null, null, array[]::uuid[])`)
expect('an unshared wish disappears for givers', await n(G2, `select 1 from items where id='${W3}'`), 0)
expect('…and its reservation is dropped, so it is not stuck as claimed', (await admin(`select count(*)::int n from claims where item_id='${W3}'`))[0].n, 0)

// --- A giver is removed while holding claims ------------------------------------
const W4 = await wish('Book'), W5 = await wish('Watch')
await as(G3, `select claim_item('${W4}','reserved')`)
await as(G3, `select claim_item('${W5}','bought')`)
await as(O, `delete from circle_members where circle_id='${fam.id}' and user_id='${G3}'`)
expect('a removed giver no longer sees the wishes', await n(G3, `select 1 from items where owner_id='${O}'`), 0)
expect('their reservation is dropped, so others can claim it', await refused(G1, `select claim_item('${W4}','reserved')`, /already claimed/), 'no error')
expect('a gift they already bought stays claimed', await refused(G1, `select claim_item('${W5}','reserved')`, /already claimed/), 'refused')

// --- A Circle is deleted with a hand-off in progress ---------------------------
const P = uuid('e11'), Q = uuid('e12')
await admin(`insert into auth.users (id) values ('${P}'),('${Q}');`)
const duo = (await as(P, `select * from create_circle('Duo')`))[0]
await as(Q, `select join_circle('${duo.invite_code}')`)
const W6 = (await as(P, `select save_item(null, 'Camera', null, null, null, 'INR', 8::smallint, null, null, array['${duo.id}']::uuid[]) id`))[0].id
await as(Q, `select claim_item('${W6}','bought')`)
await as(Q, `select set_give_date('${W6}', current_date - 1)`)
await as(Q, `select mark_given('${W6}')`)
expect('deleting the Circle works mid hand-off', await refused(P, `delete from circles where id='${duo.id}'`, /./), 'no error')
expect('the Circle is gone for both', (await n(P, `select 1 from circles where id='${duo.id}'`)) + (await n(Q, `select 1 from circles where id='${duo.id}'`)), 0)
expect('the giver no longer sees the wish', await n(Q, `select 1 from items where id='${W6}'`), 0)
expect('the owner can still mark it received and learns who gave it', await as(P, `select giver_name is not null g from mark_received('${W6}')`), [{ g: true }])

// --- Leaving a couple Circle ------------------------------------------------------
const C1 = uuid('e21'), C2 = uuid('e22'), C3 = uuid('e23')
await admin(`insert into auth.users (id) values ('${C1}'),('${C2}'),('${C3}');`)
const us = (await as(C1, `select * from create_circle(null, 'couple')`))[0]
await as(C2, `select join_circle('${us.invite_code}')`)
await as(C2, `delete from circle_members where circle_id='${us.id}' and user_id='${C2}'`)
expect('after a partner leaves, the other one still has the Circle', await n(C1, `select 1 from circles where id='${us.id}'`), 1)
expect('the one who left can start a new couple Circle', await refused(C2, `select * from create_circle(null, 'couple')`, /./), 'no error')
expect('someone new can join the half-empty couple', await refused(C3, `select join_circle('${us.invite_code}')`, /./), 'no error')

// --- Invite codes ------------------------------------------------------------------
const E1 = uuid('e31'), E2 = uuid('e32'), E3 = uuid('e33')
await admin(`insert into auth.users (id) values ('${E1}'),('${E2}'),('${E3}');`)
const club = (await as(E1, `select * from create_circle('Club')`))[0]
await admin(`update circles set invite_expires_at = now() - interval '1 minute' where id='${club.id}'`)
expect('an expired code does not let anyone in', (await as(E2, `select join_circle('${club.invite_code}') r`))[0].r, null)
await admin(`update circles set invite_expires_at = null where id='${club.id}'`)
const fresh = (await as(E1, `select regenerate_invite_code('${club.id}') c`))[0].c
expect('after a new code is made, the old one stops working', (await as(E2, `select join_circle('${club.invite_code}') r`))[0].r, null)
expect('…and the new one works', (await as(E2, `select join_circle('${fresh}') r`))[0].r !== null, true)
expect('joining a Circle you are already in is harmless', await refused(E2, `select join_circle('${fresh}')`, /./), 'no error')
expect('a code with spaces and lower case still works', (await as(E3, `select join_circle(' ${fresh.toLowerCase()} ') r`))[0].r !== null, true)
expect('a member cannot make a new code', await refused(E3, `select regenerate_invite_code('${club.id}')`, /Only the Circle owner/), 'refused')

// --- Odd wish input ------------------------------------------------------------------
const save = (title, price = 'null', cur = "'INR'", pri = 5, notes = 'null', url = 'null') =>
  `select save_item(null, ${title}, ${url}, null, ${price}, ${cur}, ${pri}::smallint, ${notes}, null, null)`
expect('a blank name is refused', await refused(O, save(`'   '`), /Give your wish a name/), 'refused')
const saved = async (sql) => (await as(O, sql))[0].save_item
expect('an emoji name is fine', (await as(O, `select title from items where id='${await saved(save(`'🎧 Headphones ✨'`))}'`))[0].title, '🎧 Headphones ✨')
expect('a 300-character name is fine', await refused(O, save(`repeat('a', 300)`), /./), 'no error')
expect('a 301-character name is refused', await refused(O, save(`repeat('a', 301)`), /title_check|too long|300/), 'refused')
expect('a negative price is refused', await refused(O, save(`'Mug'`, -1), /price_check|price/), 'refused')
expect('a price of 0 is fine (a free gift)', await refused(O, save(`'Hug'`, 0), /./), 'no error')
expect('the biggest price that fits is fine', await refused(O, save(`'Car'`, 9999999999.99), /./), 'no error')
expect('a price too big to store is refused with a plain message', await refused(O, save(`'Yacht'`, 99999999999), /price is too high/i), 'refused')
expect('a lower-case currency is stored in capitals', (await as(O, `select currency::text c from items where id='${await saved(save(`'Tea'`, 10, `'inr'`))}'`))[0].c, 'INR')
expect('a made-up currency code is refused', await refused(O, save(`'Tea'`, 10, `'RUPEES'`), /currency code/), 'refused')
expect('priority 0 is refused', await refused(O, save(`'Pen'`, 'null', `'INR'`, 0), /priority/), 'refused')
expect('priority 11 is refused', await refused(O, save(`'Pen'`, 'null', `'INR'`, 11), /priority/), 'refused')
expect('notes over 2,000 characters are refused', await refused(O, save(`'Pen'`, 'null', `'INR'`, 5, `repeat('n', 2001)`), /notes/), 'refused')
expect('a link that is not a web address is refused', await refused(O, save(`'Pen'`, 'null', `'INR'`, 5, 'null', `'javascript:alert(1)'`), /url_check|url/), 'refused')
expect('an image that is not a web address is refused', await refused(O, `select save_item(null, 'Pen', null, 'javascript:alert(1)', null, 'INR', 5::smallint, null, null, null)`, /photo/), 'refused')

console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0)
