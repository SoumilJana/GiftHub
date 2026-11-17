import { Link } from '@tanstack/react-router'
import { InfoFrame, Mail, OPERATOR, type InfoSection } from '../components/InfoFrame'

/** Bump when the text of a page changes in substance. */
const UPDATED = '17 November 2026'

const privacySections: InfoSection[] = [
  {
    id: 'who',
    title: 'Who we are',
    body: (
      <>
        <p>
          GiftHub is a private, shared wishlist run by {OPERATOR}, an individual in India. In this policy “we” means {OPERATOR} running GiftHub, and “you”
          means anyone who uses it.
        </p>
        <p>
          For any privacy question, request or complaint, email <Mail subject="Privacy request" />.
        </p>
      </>
    ),
  },
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <ul>
        <li>
          <strong>Your account:</strong> your email address, the name you give, your preferred currency, and your password, which is stored only as a
          scrambled hash. If you sign in with Google, Google shares your name, email address and profile photo with us.
        </li>
        <li>
          <strong>Your wishes:</strong> titles, links, prices, notes, priorities, occasions, photos you upload, and which Circles each one is shared with.
        </li>
        <li>
          <strong>Your Circles:</strong> the Circles you start or join, their names and invite codes, your role, and when you joined.
        </li>
        <li>
          <strong>Claims:</strong> when you reserve or buy a gift from someone’s list, we record that you did and when.
        </li>
        <li>
          <strong>Bug reports:</strong> what you write, an optional screenshot, and the page, app version, browser and device you were using.
        </li>
        <li>
          <strong>Technical records:</strong> our hosting providers keep short-lived server logs, such as IP addresses and error messages, to run and
          protect the service.
        </li>
      </ul>
    ),
  },
  {
    id: 'use',
    title: 'How we use it',
    body: (
      <>
        <ul>
          <li>To run GiftHub: show your list, share wishes with the Circles you choose, and keep claims secret from the person receiving the gift.</li>
          <li>To keep accounts secure and stop abuse, for example by limiting how often invite codes can be tried.</li>
          <li>To send the emails you need: confirming your address, sign-in links and password resets.</li>
          <li>To fix problems you report.</li>
        </ul>
        <p>
          <strong>We don’t sell your data, show ads, or use your data to train AI.</strong> We use no analytics or tracking tools.
        </p>
      </>
    ),
  },
  {
    id: 'see',
    title: 'Who can see what',
    body: (
      <ul>
        <li>People in a Circle see your name and the wishes you share with that Circle, and nothing else.</li>
        <li>Members never learn which other Circles you are in, or which other Circles a wish is shared with.</li>
        <li>You never see who reserved or bought something from your list until you mark it received.</li>
      </ul>
    ),
  },
  {
    id: 'providers',
    title: 'Services we rely on',
    body: (
      <>
        <p>These companies process data for us, only to provide their service:</p>
        <ul>
          <li>
            <strong>Supabase:</strong> database, sign-in and photo storage. Your data is stored on its servers in Tokyo, Japan.
          </li>
          <li>
            <strong>Cloudflare:</strong> hosts the app and delivers it to your browser.
          </li>
          <li>
            <strong>Google:</strong> only if you choose Sign in with Google.
          </li>
          <li>
            <strong>Resend:</strong> delivers bug reports to us by email.
          </li>
        </ul>
        <p>
          <strong>Store images:</strong> product pictures load directly from the store’s own website, so that store can see your IP address when your
          browser fetches the picture, as it would if you visited the store.
        </p>
      </>
    ),
  },
  {
    id: 'keep',
    title: 'How long we keep it',
    body: (
      <ul>
        <li>We keep your data while your account exists.</li>
        <li>
          When you delete your account (Profile → Delete account), your profile, wishes, photos, claims and memberships are deleted straight away. Circles
          you own pass to another member, or are deleted if you were the only one.
        </li>
        <li>Bug reports are kept for up to a year, then deleted.</li>
        <li>Backups held by Supabase may keep copies for a short time before they expire.</li>
      </ul>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <p>You can ask us to:</p>
        <ul>
          <li>tell you what data we hold about you, and give you a copy;</li>
          <li>correct it (you can change most of it yourself in the app);</li>
          <li>delete it (you can delete your account yourself on the Profile page);</li>
          <li>stop using it for a purpose you agreed to.</li>
        </ul>
        <p>
          Email <Mail subject="Privacy request" />. We reply as soon as we can, and resolve complaints within 90 days at the latest, as India’s Digital
          Personal Data Protection Rules require. If you aren’t satisfied, you can complain to the Data Protection Board of India, or to the data
          protection authority where you live.
        </p>
      </>
    ),
  },
  {
    id: 'age',
    title: 'Age',
    body: <p>GiftHub is for people aged 18 or over. If you believe a child has made an account, email us and we will delete it.</p>,
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        Data travels over encrypted connections. Database rules decide who can read each record, so even a mistake in the app can’t show a claim to
        the person receiving the gift. No system is perfectly secure; if a breach affects you, we will tell you and the authorities as the law requires.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: <p>If we change this policy in a way that matters, we will tell you in the app before the change takes effect. The date at the top shows the latest version.</p>,
  },
]

export function PrivacyPage() {
  return (
    <InfoFrame
      title="Privacy Policy"
      lead="What GiftHub collects, why, and what you can do about it."
      updated={UPDATED}
      sections={privacySections}
    />
  )
}

const termsSections: InfoSection[] = [
  {
    id: 'agreement',
    title: 'Agreeing to these terms',
    body: (
      <p>
        These terms are an agreement between you and {OPERATOR}, who runs GiftHub. By creating an account or using GiftHub, you agree to them and to
        the <Link to="/privacy">Privacy Policy</Link>. If you don’t agree, please don’t use GiftHub.
      </p>
    ),
  },
  {
    id: 'eligibility',
    title: 'Who can use GiftHub',
    body: <p>You must be 18 or over. One account per person. Keep your sign-in details to yourself; you are responsible for what happens in your account.</p>,
  },
  {
    id: 'content',
    title: 'Your content',
    body: (
      <>
        <p>
          Your wishes, notes and photos stay yours. You give us permission to store them and show them to the people you share them with, only so
          GiftHub can work.
        </p>
        <p>Only add content you have the right to share. Don’t add anything unlawful, hateful, sexually explicit, or that infringes someone else’s rights.</p>
      </>
    ),
  },
  {
    id: 'circles',
    title: 'Circles and invite codes',
    body: (
      <ul>
        <li>Anyone with a valid invite code or link can join that Circle straight away, so share codes only with people you trust.</li>
        <li>The Circle’s owner and admins can change its code, remove members, or delete it.</li>
        <li>What you share in a Circle is visible to all its members while you are in it.</li>
      </ul>
    ),
  },
  {
    id: 'use',
    title: 'Fair use',
    body: (
      <>
        <p>Don’t misuse GiftHub. For example, don’t:</p>
        <ul>
          <li>try to see data you aren’t meant to, including claims on your own list;</li>
          <li>guess invite codes, scrape the service, or overload it;</li>
          <li>use it to harass anyone, send spam, or for anything unlawful.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'free',
    title: 'A free service, with limits',
    body: (
      <ul>
        <li>GiftHub is free. To stay free it has limits, such as 150 active wishes per person, 10 Circles per person and 20 members per Circle.</li>
        <li>We may change features or limits, and will tell you in the app first when a change affects you.</li>
        <li>GiftHub may later earn a commission when someone buys through a store link. If that starts, we will say so clearly next to those links.</li>
      </ul>
    ),
  },
  {
    id: 'stores',
    title: 'Stores and prices',
    body: (
      <p>
        GiftHub doesn’t sell anything. Prices, pictures and availability come from you or from stores, and can be wrong or out of date. Anything you buy
        is between you and the store.
      </p>
    ),
  },
  {
    id: 'ending',
    title: 'Ending your account',
    body: (
      <p>
        You can delete your account at any time on the Profile page. We may suspend or close an account that breaks these terms, and will tell you why
        unless the law stops us.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'No guarantees',
    body: (
      <>
        <p>
          GiftHub is provided “as is”. We work to keep it running and your data safe, but can’t promise it will always be available, error-free, or
          that a surprise will never be spoiled by something outside GiftHub.
        </p>
        <p>
          As far as the law allows, we are not liable for indirect losses, or for losses caused by stores, other members, or events outside our
          control. Nothing in these terms limits rights you have that the law doesn’t allow us to limit.
        </p>
      </>
    ),
  },
  {
    id: 'law',
    title: 'Law and disputes',
    body: (
      <p>
        These terms are governed by the laws of India, and disputes go to the courts of India. Please email <Mail subject="GiftHub terms" /> first;
        most problems can be sorted out quickly.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: <p>If we change these terms in a way that matters, we will tell you in the app before the change takes effect.</p>,
  },
]

export function TermsPage() {
  return <InfoFrame title="Terms" lead="The rules for using GiftHub, in plain language." updated={UPDATED} sections={termsSections} />
}

const stored: { name: string; why: string; kept: string }[] = [
  { name: 'Sign-in session', why: 'Keeps you signed in. Set by Supabase, our sign-in provider.', kept: 'Until you sign out' },
  { name: 'Pending invite', why: 'Remembers a Circle code while you sign in, so you join it afterwards.', kept: 'Until you join' },
  { name: 'Strip or List', why: 'Remembers how you like to see lists.', kept: 'Until you clear it' },
  { name: 'Dismissed notes', why: 'Remembers notes you closed with “Got it”.', kept: 'Until you clear it' },
  { name: 'Offline copy of the app', why: 'Lets GiftHub open quickly and work without a connection.', kept: 'Until a new version replaces it' },
]

export function CookiesPage() {
  return (
    <InfoFrame
      title="Cookies and storage"
      lead="GiftHub uses no tracking or advertising cookies. It saves only what the app needs to work, in your browser."
      updated={UPDATED}
    >
      <div className="prose-info mt-6">
        <p>
          Because everything below is strictly necessary, or remembers a choice you made, there is no cookie banner to accept. If we ever add anything
          that isn’t needed, such as analytics, we will ask you first.
        </p>
      </div>
      <ul aria-label="What GiftHub stores in your browser" className="mt-6 rounded-panel bg-print px-5 py-1 sm:px-7">
        {stored.map((s) => (
          <li key={s.name} className="grid gap-x-6 gap-y-0.5 border-b border-blush py-4 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <span className="font-semibold">{s.name}</span>
            <span>
              {s.why}
              <span className="mt-0.5 block text-small text-plum-soft">Kept: {s.kept.toLowerCase()}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="prose-info mt-6">
        <p>
          The font is served by GiftHub itself, not by Google. Product pictures load from the stores that sell them; see the{' '}
          <Link to="/privacy">Privacy Policy</Link>. You can clear everything above in your browser’s settings, which also signs you out.
        </p>
      </div>
    </InfoFrame>
  )
}
