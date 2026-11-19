# How GiftHub reads a store link

*19 November 2026, Phase 4 (updated after the Phase 4.5 security check)*

When someone pastes a product link, GiftHub fills in the name, price and photo by itself. This note explains how that works, how we tested it, what the first test showed, what we changed, and how the second test went.

## The method

Reading a link means fetching the store's product page and pulling three things out of it: the **name**, the **photo** and the **price**.

**1. Clean the link.** Remove tracking codes and follow short links (`amzn.in/d/…`) to the real product page. Amazon links are cut down to the product code.

**2. Fetch the page, with up to three tries.** Many stores refuse visits from servers, so each step is only used when the one before it fails:

| Try | From where | Cost |
|---|---|---|
| 1 | Our own Cloudflare server (where the site runs) | Free |
| 2 | Supabase's servers (a different address that some stores allow) | Free |
| 3 | scrape.do, a service that visits through ordinary Indian internet connections | Free plan: about 1,000 pages a month |

**3. Read the page.** We look in the places stores usually put product details, in this order:

1. The structured product data many stores add for Google.
2. Store-specific spots: Amazon's page layout, Croma and FirstCry's page data, and Tata CLiQ's product feed.
3. The preview tags used when a link is shared on WhatsApp.
4. The page title, as a last resort.

**4. Tidy up.**
- Long titles become a short name ("Samsung Galaxy M35 5G"), and the specs go into Notes.
- Each read is remembered for a day, so the same link isn't fetched twice.

**5. Never make the person wait.** They can save straight away. The details fill in a few seconds later, and anything they typed themselves is kept.

**Limits and safety:** only signed-in people can read links, up to 30 a minute each. It only reads ordinary public web pages, and stops at 2.5 MB or 10 seconds per page. Every redirect is checked, and every web address is looked up before it is fetched, so a link can never make our servers open an address inside a private network (see "Security check" below).

## How we tested it

The test sends real product links to the live site, exactly as the app does. For each link it checks whether the name, photo and price all came back. The goal is **80% of links fully filled in**.

There are 74 links from 14 stores: Amazon, Flipkart, Myntra, Nykaa, Croma, Tata CLiQ, Meesho, FirstCry, Ajio, Decathlon, boAt, Lenskart, Etsy and IKEA. The script is `web/scripts/link-test.mjs`.

## First test: 49%

**37 of 76 links** came back complete.

| Store | Result |
|---|---|
| Amazon | 13 of 15 |
| Flipkart | 7 of 11 |
| IKEA, Decathlon, boAt, Etsy | all of them |
| Nykaa | 4 of 6 |
| Myntra | 0 of 10 |
| Croma, Tata CLiQ, FirstCry, Lenskart | name and photo, but no price |
| Meesho, Ajio | mostly refused |

## What we realised

- **Myntra wasn't refusing, it was sending an empty page.** Our retries only started on a refusal, so they never ran for Myntra. scrape.do reads Myntra fine.
- **Croma and FirstCry do show the price,** just not where we looked. It sits in the data the page uses to draw itself.
- **Tata CLiQ's page is an empty shell** that the browser fills in later. The real details come from a separate product feed the page calls.
- **Some links landed on the shop's home page** (Lenskart's US site). We were saving "Lenskart.com" as the product name.
- **Some products simply don't exist any more.** We treated those as "blocked" and wasted paid retries on them.
- **We couldn't see which retry failed,** so Meesho and Ajio were a mystery.
- **Store photos were never the problem.** We had planned to copy photos into our own storage because Myntra supposedly blocked them. We checked photos from all 13 stores in a browser, and every one loads, so that work isn't needed.

## What we changed

1. **Empty pages now get retries too,** which fixed Myntra.
2. **Store-specific readers:** prices from Croma and FirstCry's page data, and Tata CLiQ's product feed.
3. **Home-page answers count as "couldn't read",** not as a product.
4. **Removed products** now say "That page is gone from nykaa.com", and skip the paid retry.
5. **Every answer lists the steps it went through,** for example `cloudflare blocked > supabase blocked > scrapedo 404`.
6. **Old saved reads were thrown away,** so the improvements apply straight away.

## Second test: 84% ✅

**62 of 74 links** came back complete. That beats the 80% target.

| Store | First test | Second test |
|---|---|---|
| Myntra | 0 of 10 | **10 of 10** |
| Croma | 0 of 6 | **6 of 6** |
| Tata CLiQ | 0 of 6 | **6 of 6** |
| FirstCry | 0 of 2 | **2 of 2** |
| Lenskart | 0 of 3 | **1 of 1** (India link) |
| Amazon | 13 of 15 | 13 of 15 |
| Flipkart | 7 of 11 | 7 of 11 |
| Nykaa | 4 of 6 | 4 of 6 |
| Meesho | 1 of 4 | 1 of 4 |
| Ajio | 0 of 1 | 0 of 1 |
| IKEA, Decathlon, boAt, Etsy | all | all |

The 12 that still miss:

- **6 aren't for sale any more:** 4 removed products (2 on Nykaa, 2 on Meesho) and 2 unavailable Amazon items. Without these, the score is **91%**.
- **4 Flipkart listings** show no price on their own page.
- **2 real failures:** scrape.do ran out of time on one Meesho page and the Ajio page.

## After the second test

- Removed products found through scrape.do now also say "gone" instead of "blocked".
- scrape.do now gets 40 seconds instead of 25. Because saving doesn't wait for the read, a slow store just means the details appear a little later.

## Security check

During the pre-beta security check we found that a link could trick the reader:

- **Redirects weren't checked.** A page could send the reader on to an internal address, such as the one cloud servers use for their own settings.
- **Web addresses weren't looked up.** A name like `127.0.0.1.nip.io` looks ordinary but points back at the server itself.

Now the reader follows redirects one at a time and checks each one, and it looks up every address first. Anything that points at a private, local or cloud-settings address is refused. Both kinds of trick link are refused in tests, and real store links still read.

## Third test: 85% ✅

After the security changes, **63 of 74 links** came back complete.

- One Meesho page that ran out of time before now reads in full.
- The 11 misses are the same kinds as before: 4 removed products, 2 Amazon items that aren't for sale, 4 Flipkart listings with no price, and Ajio, where scrape.do still runs out of time.
- Most links came from the one-day memory of earlier reads, so only 6 went through the new checks. A rerun once that memory clears tests all of them.

## What's next

- ~~Phone check~~: done.
- **Phase 4.5, the pre-beta check:**
  - ~~edge-case tests, such as two people claiming the same wish at once~~: done, 3 bugs fixed
  - ~~security check~~: done (this page, plus page security headers and a person check on sign-in)
  - a robustness pass
  - a 20-minute manual test with two phones
- **Then a private beta** with 5–10 couples and friend groups.
