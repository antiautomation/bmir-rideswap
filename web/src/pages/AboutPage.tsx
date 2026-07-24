import { Link } from 'react-router-dom';

/* Numbers on this page are sourced, not vibes:
   - "likely around 100K tons" + "consolidated transit" quotes: BMP 2030
     Environmental Sustainability Roadmap (their Medium post).
   - 2,850 MT on-playa fossil CO2e (travel excluded): BRC Emissions Inventory, 2025.
   - 476.8 MT / 34,701 gal diesel saved + battery quote: Net Zero BRC
     Initiative 2024 Key Successes report.
   - ~400 g CO2/mile per typical passenger car: EPA.
   The one-in-five scenario math is spelled out inline with its assumptions. */

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

const SRC = {
  sustainability: 'https://burningman.org/arts-innovation/sustainability/',
  roadmap:
    'https://burningman.medium.com/burning-man-project-2030-environmental-sustainability-roadmap-c79657e18146',
  inventory: 'https://burningman.org/arts-innovation/sustainability/emissions-inventory/',
  netZero: 'https://burningman.org/arts-innovation/sustainability/net-zero-black-rock-city-initiative/',
  epa: 'https://www.epa.gov/greenvehicles/greenhouse-gas-emissions-typical-passenger-vehicle',
};

export default function AboutPage() {
  return (
    <article className="about-page">
      <Link to="/" className="btn-ghost">
        ← Back to RideFinder
      </Link>
      <h1>About RideFinder</h1>
      <p className="muted">Why a radio station has a ride board, and why you should use it.</p>

      <h2>The story</h2>
      <p>
        RideFinder exists because of a conversation. A lot of them, actually.
      </p>
      <p>
        I&rsquo;ve been sharing rides for most of my adult life — to shows, up and down the coast,
        and in and out of Black Rock City more times than I can count. Some of it was about gas
        money. Some of it was the empty seats bugging me. But mostly I kept doing it because of
        what happens around hour two, when the small talk runs out and the real conversation
        starts. I&rsquo;ve pulled onto the 447 with a stranger and rolled into Gerlach with a
        campmate. It happens fast out there.
      </p>
      <p>
        Somewhere along the way I stopped thinking of ridesharing as a way to get to the thing and
        started thinking of it as the first hour of the thing. Burning Man asks you to show up
        ready to meet people — immediately, enthusiastically, before you&rsquo;ve had coffee. A
        shared car is a head start. By the time you reach the Gate you&rsquo;ve already practiced.
      </p>
      <p>
        So this board is the version I always wanted: free, no accounts, no ads, and your contact
        info stays private until you decide to share it with one specific person. Post a ride,
        find a match, meet your first friend of the burn before you leave your driveway.
      </p>
      <p className="about-sign">— Wavy Davy</p>

      <h2>The math (bear with me)</h2>
      <p>
        Burning Man Project&rsquo;s{' '}
        <a href={SRC.roadmap} {...ext}>
          2030 Environmental Sustainability Roadmap
        </a>{' '}
        puts it plainly: &ldquo;The carbon footprint for Black Rock City is likely around 100K
        tons.&rdquo;
      </p>
      <p>
        Meanwhile the org&rsquo;s most recent{' '}
        <a href={SRC.inventory} {...ext}>
          on-playa emissions inventory
        </a>{' '}
        — every generator, art car, flame effect, and heater in the city — comes to about{' '}
        <strong>2,850 metric tons</strong> of fossil CO₂e. And that inventory{' '}
        <em>explicitly excludes round-trip attendee travel</em>, because it&rsquo;s too hard to
        measure.
      </p>
      <p>
        Read those two numbers together. The event is not the footprint.{' '}
        <strong>Getting there is the footprint</strong> — the vast majority of it is the miles
        between your driveway and the Gate. Which is strangely good news, because the biggest
        lever isn&rsquo;t owned by the org or the BLM. It&rsquo;s parked outside your house.
      </p>

      <section className="card about-stat">
        <h2>What one in five of us could do</h2>
        <p>
          The EPA figures a{' '}
          <a href={SRC.epa} {...ext}>
            typical passenger car at about 400 grams of CO₂ per mile
          </a>
          . Call the average run to Black Rock City 800 miles round trip — Reno is closer, LA is
          farther. That&rsquo;s roughly a third of a metric ton of CO₂ per car.
        </p>
        <p>
          Black Rock City holds about 70,000 people. If <strong>one in five</strong> of us —
          14,000 burners — paired up instead of driving separately, that&rsquo;s about{' '}
          <strong>7,000 fewer cars</strong> crossing Nevada, more than{' '}
          <strong>2,000 metric tons of CO₂</strong> that never leaves a tailpipe, and around{' '}
          <strong>220,000 gallons of gas</strong> left unburned. Every single year.
        </p>
        <p>
          For scale: the org&rsquo;s entire{' '}
          <a href={SRC.netZero} {...ext}>
            2024 Net Zero BRC program
          </a>{' '}
          — the grid batteries, the solar light towers, the renewable diesel, what its power
          vendor called &ldquo;the largest [temporary] battery deployment in human
          history&rdquo; — prevented 476.8 metric tons of CO₂e and saved about 34,700 gallons of
          diesel. That took a restricted grant and years of engineering. One in five of us
          sharing a ride would beat it more than four times over, using no technology newer than
          the passenger seat.
        </p>
      </section>

      <h2>Their words, not ours</h2>
      <blockquote>
        &ldquo;Camps could further coordinate the logistics of transportation to Black Rock City
        in groups, and eliminate vehicle-related emissions through consolidated transit.&rdquo;
        <cite>
          —{' '}
          <a href={SRC.roadmap} {...ext}>
            Burning Man Project, 2030 Sustainability Roadmap
          </a>
        </cite>
      </blockquote>
      <blockquote>
        &ldquo;Be Carbon Negative: Remove more carbon from the environment than we
        contribute.&rdquo;
        <cite>
          —{' '}
          <a href={SRC.sustainability} {...ext}>
            burningman.org/sustainability
          </a>
          , goal three of three
        </cite>
      </blockquote>
      <p>
        There is no version of that math that works while tens of thousands of us drive to the
        desert alone. The org can electrify the grid and solar-power the Man base — it did, in
        2024 — and the drive in will still swamp all of it. Sharing rides is the one sustainability
        project that&rsquo;s always been ours to run.
      </p>

      <h2>The parts that aren&rsquo;t about carbon</h2>
      <ul>
        <li>
          <strong>Somebody helps pay for gas.</strong> Eight hundred miles round trip burns real
          money. Splitting fuel typically puts $70 or more back in each person&rsquo;s pocket —
          that&rsquo;s your ice for the week, or most of a bike.
        </li>
        <li>
          <strong>Somebody helps drive.</strong> The stretch past Fernley is long, straight, and
          hypnotic, and the Gate-road crawl at 3am is nobody&rsquo;s finest hour. Trade off. Stay
          sharp. Arrive human.
        </li>
        <li>
          <strong>You arrive already in it.</strong> The hardest part of your first burn
          isn&rsquo;t the dust, it&rsquo;s flipping the switch from default-world reserve to
          playa-grade openness. Eight hours in a car with a new person is the best on-ramp ever
          devised. Many a camp has been founded at a gas station in Nixon.
        </li>
      </ul>

      <h2>The fine print</h2>
      <p>
        RideFinder is a free community service from <strong>Wavy Davy</strong>, part of the{' '}
        <a href="https://bmir.org/" {...ext}>
          BMIR 94.5 FM
        </a>{' '}
        family. No ads, no data selling, no accounts. Your email and phone number are never shown
        publicly — read the <Link to="/privacy">privacy policy</Link> for the details. We&rsquo;re
        not affiliated with the Burning Man Project; we just share a zip code for a week or so every August.
      </p>

      <h2>Sources</h2>
      <ul className="about-sources">
        <li>
          <a href={SRC.sustainability} {...ext}>
            Burning Man Project — Sustainability
          </a>
        </li>
        <li>
          <a href={SRC.roadmap} {...ext}>
            Burning Man Project — 2030 Environmental Sustainability Roadmap
          </a>
        </li>
        <li>
          <a href={SRC.inventory} {...ext}>
            Black Rock City Emissions Inventory (2025)
          </a>
        </li>
        <li>
          <a href={SRC.netZero} {...ext}>
            Net Zero BRC Initiative — 2024 Key Successes
          </a>
        </li>
        <li>
          <a href={SRC.epa} {...ext}>
            EPA — Greenhouse Gas Emissions from a Typical Passenger Vehicle
          </a>
        </li>
      </ul>
    </article>
  );
}
