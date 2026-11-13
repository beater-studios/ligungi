import { Ext, LINKS, Mail, REPO, STUDIO, type Content } from './shared.tsx';

const sources = (
  <>
    <p>ligungi's rules follow, in order of authority:</p>
    <ol>
      <li>The official rulebook (軍儀解説書), released in 2022 by Universal Music with the physical board.</li>
      <li>
        The <Ext href={LINKS.rulebookFaq}>official Universal Music FAQ</Ext> (questions Q1 to Q30), which clarifies cases and
        fixes a misprint in the rulebook.
      </li>
      <li>
        The <Ext href={LINKS.rulebookEnglish}>English translation of the rulebook</Ext>, checked page by page against the
        original.
      </li>
      <li>
        <Ext href={LINKS.gungiWeb}>軍儀Web</Ext>, a Japanese site that follows the official rules, used only where the
        rulebook is silent.
      </li>
    </ol>
    <p>
      Where the rulebook leaves room for doubt, the interpretation we adopted and why are in the{' '}
      <Ext href={LINKS.spec}>full rules specification</Ext>, in the project's source code.
    </p>
  </>
);

export const en: Content = {
  updated: 'Last updated: November 12, 2026.',

  about: (
    <>
      <p>
        ligungi is a free platform to play Gungi (軍儀), the board game from HUNTER×HUNTER, online with the official 2022
        rules. No ads, no account required, and the code is open.
      </p>
      <p>
        It is made by <Ext href={STUDIO}>Beater Studios</Ext> and inspired by lichess.org: the interface reuses the look of
        lila, lichess's open source code.
      </p>
      <h2>Rules</h2>
      {sources}
      <h2>Open source</h2>
      <p>
        All of ligungi's code is on <Ext href={REPO}>GitHub</Ext>, under the <Ext href={LINKS.agpl}>GNU AGPL-3.0</Ext> or any
        later version. Rule corrections, translations and code are welcome.
      </p>
      <h2>Credits</h2>
      <ul>
        <li>
          Look and feel: <Ext href={LINKS.lila}>lila</Ext>, the open source code of lichess.org (AGPL-3.0).
        </li>
        <li>
          Sounds: the "sfx" set by Enigmahack, and the icon font, both from lila (see{' '}
          <Ext href={LINKS.lilaCopying}>lila's COPYING.md</Ext>).
        </li>
        <li>
          Noto Sans and Roboto fonts by Google, under the <Ext href={LINKS.ofl}>SIL Open Font License</Ext>.
        </li>
      </ul>
      <h2>Notice</h2>
      <p>
        Gungi and HUNTER×HUNTER belong to their owners (Yoshihiro Togashi, Shueisha and Universal Music). ligungi is a fan
        project, not officially affiliated, and uses no characters, artwork or logos from the series.
      </p>
    </>
  ),

  faq: [
    {
      q: 'What is Gungi?',
      a: (
        <p>
          A two-player strategy game created for the HUNTER×HUNTER manga and released as a real game in 2022. It resembles
          shogi, but pieces can be stacked into towers of up to three, and the height of the tower extends the reach of the
          piece on top. See <a href="/learn">how to play</a>.
        </p>
      ),
    },
    {
      q: 'Are these really the official rules?',
      a: (
        <p>
          Yes. We follow the 2022 rulebook and the official Universal Music FAQ. The sources are on the{' '}
          <a href="/about">About</a> page, and every ambiguous point, with the interpretation we chose, is in the{' '}
          <Ext href={LINKS.spec}>rules specification</Ext>.
        </p>
      ),
    },
    {
      q: 'Is it free? Do I need an account?',
      a: (
        <p>
          It is free, with no ads. You can play without an account; with one you play rated games, join the leaderboard,
          follow friends and keep your history on your profile.
        </p>
      ),
    },
    {
      q: 'How does the rating work?',
      a: (
        <p>
          We use Glicko-2, with a separate rating for each mode. While a rating is still uncertain it shows a "?" and the
          player is not on the leaderboard. Casual games do not change ratings.
        </p>
      ),
    },
    {
      q: 'Why can I not make a move that puts my Marshal in danger?',
      a: (
        <p>
          By the rulebook, whoever lets their Marshal be captured loses. Instead of allowing the move and waiting for the
          capture, the site simply does not offer it. If you have no move that keeps your Marshal safe, the game ends in
          mate, even if it is not under attack at that moment.
        </p>
      ),
    },
    {
      q: 'What are the draft and "済み"?',
      a: (
        <p>
          In the Intermediate and Advanced modes, each player builds their own army by placing pieces in their territory, one
          at a time, starting with the Marshal. "済み" means "done": a player who declares it places no more pieces. By the
          rulebook, when the second player declares done the draft ends for both. Casual games offer a "free draft" option
          where each player finishes their own.
        </p>
      ),
    },
    {
      q: 'What is FEN?',
      a: (
        <p>
          A line of text that describes a whole position: the towers on the board, the pieces in hand, whose turn it is, the
          mode and the phase. On the analysis board you can copy and paste positions with it.
        </p>
      ),
    },
    {
      q: 'Is ligungi connected to HUNTER×HUNTER or Universal Music?',
      a: <p>No. It is a fan project, not officially affiliated.</p>,
    },
    {
      q: 'I found a bug. How do I report it?',
      a: (
        <p>
          Open an <Ext href={LINKS.issues}>issue on GitHub</Ext> or write to <Mail />. For security issues, use the{' '}
          <Ext href={LINKS.security}>private report</Ext>, never a public issue.
        </p>
      ),
    },
    {
      q: 'Can I help?',
      a: (
        <p>
          Yes. The code is open and welcomes contributions: rule corrections backed by a source, translations, code and bug
          reports. Start at the <Ext href={REPO}>repository</Ext>.
        </p>
      ),
    },
  ],

  contact: (
    <>
      <p>
        For questions, suggestions, partnerships or requests about your data, write to <Mail />.
      </p>
      <ul>
        <li>
          Bugs and technical suggestions: <Ext href={LINKS.issues}>GitHub issues</Ext>.
        </li>
        <li>
          Security issues: <Ext href={LINKS.security}>private report on GitHub</Ext>, never in public.
        </li>
        <li>
          Privacy and personal data: <Mail />, see the <a href="/privacy">privacy policy</a>.
        </li>
      </ul>
    </>
  ),

  terms: (
    <>
      <p>
        These terms apply to the use of ligungi.org, run by <Ext href={STUDIO}>Beater Studios</Ext>. By using the site you
        agree to them.
      </p>
      <h2>The service</h2>
      <p>
        ligungi is free and provided as is, with no guarantee of continuous availability. We may change, suspend or end
        features at any time.
      </p>
      <h2>Account</h2>
      <ul>
        <li>You are responsible for your password and for everything done with your account.</li>
        <li>Use a username that is not offensive and does not impersonate anyone.</li>
        <li>Children under 13 may only create an account with their parents' or guardians' permission.</li>
      </ul>
      <h2>Conduct</h2>
      <p>It is not allowed to:</p>
      <ul>
        <li>use programs or outside help during games against other people;</li>
        <li>manipulate ratings, for example with multiple accounts or arranged games;</li>
        <li>harass, insult or threaten other players;</li>
        <li>attack, overload or try to bypass the site's protections.</li>
      </ul>
      <p>Accounts that break these rules may be suspended or removed.</p>
      <h2>Games and profile</h2>
      <p>Games, results, ratings and usernames are public: anyone can view and export games played on the site.</p>
      <h2>Code and trademarks</h2>
      <p>
        ligungi's code is open under the <Ext href={LINKS.agpl}>GNU AGPL-3.0</Ext>, which has its own rules for anyone who
        copies or modifies the code. Gungi and HUNTER×HUNTER belong to their owners; ligungi is a fan project, not officially
        affiliated.
      </p>
      <h2>Liability</h2>
      <p>
        To the extent permitted by law, Beater Studios is not liable for losses arising from the use or unavailability of the
        site, such as interrupted games or lost data.
      </p>
      <h2>Changes and contact</h2>
      <p>
        We may update these terms; the date at the top shows the version in force. These terms are governed by Brazilian
        law. Questions: <Mail />.
      </p>
    </>
  ),

  privacy: (
    <>
      <p>
        This policy explains what data ligungi.org processes and why, in line with Brazil's General Data Protection Law
        (LGPD). The data controller is <Ext href={STUDIO}>Beater Studios</Ext>. Contact: <Mail />.
      </p>
      <h2>Summary</h2>
      <ul>
        <li>No ads, no trackers and no third-party cookies.</li>
        <li>We only keep what the game needs to work.</li>
        <li>Your data is not sold or shared for marketing.</li>
      </ul>
      <h2>What we process</h2>
      <ul>
        <li>
          <b>Account (if you create one):</b> username and password. The password is only stored as a cryptographic hash,
          which not even we can read.
        </li>
        <li>
          <b>Games and activity:</b> moves, results, ratings, players you follow and your account creation date. This data
          appears on your public profile.
        </li>
        <li>
          <b>Session cookie (sid):</b> an essential cookie that identifies your browser to keep you signed in and keep your
          games. It is not used for tracking. Sessions without an account expire after 30 days unused; with an account, after
          a year.
        </li>
        <li>
          <b>IP address:</b> used at request time to limit login attempts and protect the site from abuse. It is not stored in
          our database.
        </li>
        <li>
          <b>Visit statistics:</b> Cloudflare Web Analytics counts, in aggregate, the pages visited, the country, the type of
          browser and the loading time. It uses no cookies, stores nothing in your browser and does not identify you. It is
          only turned on if you accept it in the cookie notice, and you can change your choice at the bottom of this page.
        </li>
        <li>
          <b>Preferences:</b> language, theme, sound and board size stay in your browser (local storage) and are not sent to
          us.
        </li>
      </ul>
      <h2>Why we process it (legal bases)</h2>
      <ul>
        <li>Account, games and session: to provide the service you asked for (performance of a contract).</li>
        <li>IP and protections: legitimate interest in keeping the site safe and running.</li>
        <li>Visit statistics: your consent, which you can withdraw at any time.</li>
      </ul>
      <h2>Who we share it with</h2>
      <p>
        The site's traffic goes through Cloudflare, which provides a content delivery network (CDN), protection against
        attacks and the visit statistics, and may process technical data such as IP addresses, including outside Brazil (see{' '}
        <Ext href={LINKS.cloudflarePrivacy}>Cloudflare's policy</Ext>). The site runs on a hosting provider contracted by
        Beater Studios. Otherwise, we only share data when the law requires it.
      </p>
      <h2>How long</h2>
      <ul>
        <li>Account and games: while the account exists. Games are part of the site's public history.</li>
        <li>Sessions: until they expire, as described above.</li>
        <li>Backups: up to 14 days.</li>
      </ul>
      <h2>Your rights</h2>
      <p>
        Under the LGPD you may request access to, correction or deletion of your data, and information about how it is
        processed. You can change your password or delete your account yourself on the <a href="/account">Account</a> page;
        for anything else, write to <Mail /> with the subject "Privacy", including your username. Deleting your account removes your
        personal data; games already played may remain in the history anonymously.
      </p>
      <h2>Changes</h2>
      <p>We may update this policy; the date at the top shows the version in force.</p>
    </>
  ),

  sources,
};
