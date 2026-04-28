// Reddit Pulse — fetches real posts via Reddit's public RSS feeds
// No API key required. RSS feeds are more permissive than the JSON API.
//
// Each call rotates the subreddit set + time window based on the ?seed query
// param so consecutive Refresh clicks return noticeably different content.

// Seeded shuffle (deterministic given a seed) so the same seed = same result
function seededShuffle(arr, seed) {
  let s = (seed | 0) || 1;
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function handler(req, res) {
  // Always disable upstream caches so Refresh is real
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const seed = parseInt(req.query?.seed, 10) || Date.now();

  // Larger pool of relevant subreddits — pick 6 different ones each call
  const subredditPool = [
    'travelhacks', 'solotravel', 'digitalnomad', 'travel', 'australia', 'flightdeals',
    'awardtravel', 'shoestring', 'IWantOut', 'expats', 'JapanTravel', 'thailandtourism',
    'roadtrip', 'backpacking', 'TravelMaps', 'onebag',
  ];
  const subreddits = seededShuffle(subredditPool, seed).slice(0, 6);

  // Rotate time window — Reddit's RSS supports day | week | month | year
  const windows = ['day', 'week', 'month'];
  const window = windows[Math.abs(seed) % windows.length];

  const posts = [];

  await Promise.all(subreddits.map(async (sub) => {
    try {
      // Use RSS feed — more reliable from server environments than the JSON API
      const url = `https://www.reddit.com/r/${sub}/top.rss?t=${window}&limit=5`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      if (!r.ok) return;
      const xml = await r.text();

      // Parse RSS XML with regex (no library needed)
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const item of items) {
        const block = item[1];
        const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/))?.[1]?.trim();
        const link = (block.match(/<link>(.*?)<\/link>/) || block.match(/<comments>(.*?)<\/comments>/))?.[1]?.trim();
        if (!title || title === 'top scoring links : ' + sub) continue;
        posts.push({
          subreddit: `r/${sub}`,
          post_title: title,
          pain_point: title,
          url: link || `https://reddit.com/r/${sub}`,
          upvotes: null,
          comments: null,
          sentiment: /\?|help|advice|tips|trick|how do|best way/i.test(title)
            ? 'seeking advice'
            : /worst|bad|never|annoying|frustrated|hate|scam|avoid/i.test(title)
            ? 'frustrated'
            : /amazing|incredible|wow|best|love|unbelievable/i.test(title)
            ? 'excited'
            : 'discussing',
          content_angle: `Video idea: "${title.slice(0, 90)}"`,
        });
      }
    } catch (_) {}
  }));

  if (posts.length === 0) {
    // Fallback: return curated evergreen content angles if Reddit is unreachable.
    // Shuffle by seed so the fallback also varies between Refresh clicks.
    const fallbackPool = [
        { subreddit: 'r/travelhacks', post_title: 'How I saved $800 on my last flight using Google Flights hacks', pain_point: 'Flight costs', sentiment: 'excited', content_angle: 'Walk through exactly how to use Google Flights price tracking and hidden city ticketing to save on flights from Australia', url: 'https://reddit.com/r/travelhacks' },
        { subreddit: 'r/solotravel', post_title: 'Solo travel safety tips nobody tells you', pain_point: 'Solo safety fears', sentiment: 'seeking advice', content_angle: 'The real safety checklist for solo travellers — what works and what\'s overrated', url: 'https://reddit.com/r/solotravel' },
        { subreddit: 'r/digitalnomad', post_title: 'Best cities for digital nomads under $2000/month', pain_point: 'Budget planning', sentiment: 'seeking advice', content_angle: 'Day in the life + full cost breakdown living as a digital nomad in a top affordable city', url: 'https://reddit.com/r/digitalnomad' },
        { subreddit: 'r/australia', post_title: 'Cheapest ways to travel within Australia — actual tips that work', pain_point: 'Domestic travel costs', sentiment: 'seeking advice', content_angle: 'Australian domestic travel hacks — interstate flights vs road trips vs trains cost comparison', url: 'https://reddit.com/r/australia' },
        { subreddit: 'r/travel', post_title: 'Hidden gems in Southeast Asia that aren\'t overrun by tourists', pain_point: 'Overcrowded destinations', sentiment: 'discussing', content_angle: 'Off-the-beaten-path spots in SEA that still feel authentic — your guide to avoiding the tourist traps', url: 'https://reddit.com/r/travel' },
        { subreddit: 'r/flightdeals', post_title: 'Error fare to Europe — got return flights for $480', pain_point: 'Flight costs', sentiment: 'excited', content_angle: 'How to find and book error fares before they\'re fixed — the exact method that works', url: 'https://reddit.com/r/flightdeals' },
        { subreddit: 'r/travelhacks', post_title: 'Credit card travel hacks that actually work in Australia', pain_point: 'Points and rewards', sentiment: 'seeking advice', content_angle: 'Best Australian travel credit cards ranked — points, lounge access, and no foreign fees explained simply', url: 'https://reddit.com/r/travelhacks' },
        { subreddit: 'r/solotravel', post_title: 'First solo trip advice — what do I actually need?', pain_point: 'First-time solo travel anxiety', sentiment: 'seeking advice', content_angle: 'Everything I wish I knew before my first solo trip — the honest packing list + mindset shifts', url: 'https://reddit.com/r/solotravel' },
        { subreddit: 'r/awardtravel', post_title: 'Best ways to use Qantas points in 2025 — actual value comparison', pain_point: 'Points value optimization', sentiment: 'seeking advice', content_angle: 'Qantas points hacks ranked by actual cents-per-point value', url: 'https://reddit.com/r/awardtravel' },
        { subreddit: 'r/JapanTravel', post_title: 'Hidden Tokyo neighborhoods locals actually go to', pain_point: 'Tourist-trap fatigue', sentiment: 'discussing', content_angle: 'Tokyo off the Shibuya/Shinjuku trail — the neighborhoods worth your time', url: 'https://reddit.com/r/JapanTravel' },
        { subreddit: 'r/onebag', post_title: 'My ultralight 7kg setup for 6 months traveling', pain_point: 'Overpacking', sentiment: 'excited', content_angle: 'Carry-on only for long trips — the gear list that actually works', url: 'https://reddit.com/r/onebag' },
      ];
      const shuffled = seededShuffle(fallbackPool, seed).slice(0, 8);
    return res.status(200).json({
      results: shuffled,
      fetchedAt: new Date().toISOString(),
      source: 'fallback',
      window,
    });
  }

  // Deduplicate and take top 8
  const seen = new Set();
  const unique = posts.filter(p => {
    if (seen.has(p.post_title)) return false;
    seen.add(p.post_title);
    return true;
  });

  // Optionally enhance with Anthropic content angles
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && unique.length > 0) {
    try {
      const prompt = `You are a content strategist for an Australian travel & lifestyle TikTok/YouTube creator. Here are trending Reddit posts:\n\n${unique.slice(0, 8).map((p, i) => `${i + 1}. [${p.subreddit}] "${p.post_title}"`).join('\n')}\n\nFor each post give a sharp 1-sentence video idea and sentiment label. Return ONLY JSON array:\n[{"index":0,"sentiment":"excited|frustrated|seeking advice|confused","content_angle":"one sharp video idea sentence"}]`;
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
      });
      const d = await resp.json();
      if (resp.ok && d.content?.[0]?.text) {
        const m = d.content[0].text.match(/\[[\s\S]*\]/);
        if (m) JSON.parse(m[0]).forEach(a => { if (unique[a.index]) { unique[a.index].content_angle = a.content_angle; unique[a.index].sentiment = a.sentiment; } });
      }
    } catch (_) {}
  }

  res.json({ results: unique.slice(0, 8), fetchedAt: new Date().toISOString(), window, subreddits });
}
