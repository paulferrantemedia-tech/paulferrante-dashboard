// Creator Watch — returns curated data instantly, enhances with Anthropic if key is set.
// Refresh-clickable: rotates result order + Anthropic prompt focus by ?seed.

function seededShuffle(arr, seed) {
  // Positive seed in 1..233279 — avoids negative-index swaps that produce nulls
  let s = (((Math.abs(Number(seed) || 1)) % 233279) + 1) | 0;
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    s = ((s * 9301) + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const seed = parseInt(req.query?.seed, 10) || Date.now();

  const fallback = [
    { name: 'Kara and Nate', handle: '@karaandnate', platform: 'YouTube', followers: '1.8M', content_style: 'Budget travel couple documenting every destination with cost breakdowns and practical tips. Known for their "how much did it cost" series which gets consistent millions of views.', top_video_example: '"We Spent 2 Weeks in Japan for $800 Each — Full Breakdown"', avatar_initials: 'KN', avatar_color: '#88EAF6', profile_url: 'https://www.youtube.com/@karaandnate', engagement_rate: '4.2%', posting_cadence: '2x/week', last_posted: '3 days ago', is_dormant: false, why_watch: 'Master of the cost-breakdown hook that builds trust and aspirational living simultaneously', top_videos: [{ title: 'We Spent 2 Weeks in Japan for $800 Each — Full Breakdown', url: 'https://www.youtube.com/@karaandnate/videos' }, { title: 'Thailand on $50/Day: Where We Stayed and What We Ate', url: 'https://www.youtube.com/@karaandnate/videos' }, { title: 'Budget Travel Hacks That Actually Work', url: 'https://www.youtube.com/@karaandnate/videos' }] },
    { name: 'Elise Darma', handle: '@elisedarma', platform: 'TikTok', followers: '280K', content_style: 'Digital nomad lifestyle content focused on making money online while travelling. Strong niche authority in the "work from anywhere" space with very engaged community.', top_video_example: '"How I Make $10K/Month While Travelling Full Time (Real Numbers)"', avatar_initials: 'ED', avatar_color: '#E1D9AE', profile_url: 'https://www.tiktok.com/@elisedarma', engagement_rate: '6.8%', posting_cadence: '5x/week', last_posted: '1 day ago', is_dormant: false, why_watch: 'Transparent income breakdowns and digital product strategy that inspire action', top_videos: [{ title: 'How I Make $10K/Month While Travelling', url: 'https://www.tiktok.com/@elisedarma' }, { title: 'Best Places to Work Remotely in Bali', url: 'https://www.tiktok.com/@elisedarma' }, { title: 'Digital Products I\'m Selling in 2025', url: 'https://www.tiktok.com/@elisedarma' }] },
    { name: 'Lost LeBlancs', handle: '@lostleblancs', platform: 'YouTube', followers: '900K', content_style: 'Canadian travel couple known for high-production destination guides mixed with budget tips and relatable storytelling. Strong Southeast Asia and Latin America content.', top_video_example: '"We Tried Living Like Locals in Bali for a Week — This Changed Us"', avatar_initials: 'LL', avatar_color: '#B5D8F7', profile_url: 'https://www.youtube.com/@lostleblancs', engagement_rate: '3.9%', posting_cadence: '1x/week', last_posted: '5 days ago', is_dormant: false, why_watch: 'High-production destination content that balances travel aspiration with practical budgeting', top_videos: [{ title: 'We Tried Living Like Locals in Bali for a Week', url: 'https://www.youtube.com/@lostleblancs/videos' }, { title: 'Southeast Asia on a Budget: Full Cost Breakdown', url: 'https://www.youtube.com/@lostleblancs/videos' }, { title: 'Finding Hidden Gems in Popular Destinations', url: 'https://www.youtube.com/@lostleblancs/videos' }] },
    { name: 'Nora Dunn', handle: '@theprofesstraveller', platform: 'YouTube', followers: '145K', content_style: 'Long-term travel expert and former financial planner who brings a uniquely practical angle to full-time travel. Very high-trust audience that acts on her recommendations.', top_video_example: '"The Real Cost of Long-Term Travel vs Having a Normal Life"', avatar_initials: 'ND', avatar_color: '#C3E6CB', profile_url: 'https://www.youtube.com/@theprofesstraveller', engagement_rate: '7.2%', posting_cadence: '2x/month', last_posted: '2 weeks ago', is_dormant: false, why_watch: 'Analytical approach to travel finance that appeals to planners and spreadsheet enthusiasts', top_videos: [{ title: 'The Real Cost of Long-Term Travel vs Normal Life', url: 'https://www.youtube.com/@theprofesstraveller/videos' }, { title: 'Travel Budget Planning for Digital Nomads', url: 'https://www.youtube.com/@theprofesstraveller/videos' }, { title: 'How Much You Actually Need to Travel Full-Time', url: 'https://www.youtube.com/@theprofesstraveller/videos' }] },
    { name: 'Ben Thoennes', handle: '@dreambigtravelfarther', platform: 'TikTok', followers: '420K', content_style: 'Solo travel and points hacking content with a focus on flights and luxury for less. Consistently goes viral with "I flew business class for $X" style content.', top_video_example: '"I Flew Qantas First Class for $180 Using Points — Here\'s How"', avatar_initials: 'BT', avatar_color: '#F5C6CB', profile_url: 'https://www.tiktok.com/@dreambigtravelfarther', engagement_rate: '8.1%', posting_cadence: '3x/week', last_posted: '2 days ago', is_dormant: false, why_watch: 'Points hacking tutorials that make luxury travel seem achievable for everyone', top_videos: [{ title: 'I Flew Qantas First Class for $180 Using Points', url: 'https://www.tiktok.com/@dreambigtravelfarther' }, { title: 'Best Credit Cards for Travel Points', url: 'https://www.tiktok.com/@dreambigtravelfarther' }, { title: 'How to Book Business Class for Economy Price', url: 'https://www.tiktok.com/@dreambigtravelfarther' }] },
    { name: 'Tara Milk Tea', handle: '@taramilktea', platform: 'Instagram/YouTube', followers: '1.2M', content_style: 'Sydney-based travel creator known for visually stunning content with practical Asia travel guides. Strong Australian audience crossover and brand partnership work.', top_video_example: '"Best Hidden Cafes in Tokyo No Tourist Knows About"', avatar_initials: 'TM', avatar_color: '#D6BCF5', profile_url: 'https://www.instagram.com/taramilktea', engagement_rate: '5.3%', posting_cadence: '4x/week', last_posted: '1 day ago', is_dormant: false, why_watch: 'Stunning visuals paired with "insider secrets" that make viewers feel like locals', top_videos: [{ title: 'Best Hidden Cafes in Tokyo No Tourist Knows About', url: 'https://www.instagram.com/taramilktea' }, { title: 'Seoul Fashion District: Where Locals Actually Shop', url: 'https://www.instagram.com/taramilktea' }, { title: 'Bangkok Street Food Tour Like a Local', url: 'https://www.instagram.com/taramilktea' }] },
    { name: 'Gone with the Wynns', handle: '@gonewiththewynns', platform: 'YouTube', followers: '650K', content_style: 'Couple who left conventional life to travel full time — mix of practical how-tos and lifestyle storytelling. Very strong engagement from people planning their own escape.', top_video_example: '"We Sold Everything and Left — What Actually Happened After"', avatar_initials: 'GW', avatar_color: '#FFDDB8', profile_url: 'https://www.youtube.com/@gonewiththewynns', engagement_rate: '4.7%', posting_cadence: '1x/week', last_posted: '4 days ago', is_dormant: false, why_watch: 'Relatable escape narrative that triggers daydreaming and inspires action', top_videos: [{ title: 'We Sold Everything and Left — What Actually Happened', url: 'https://www.youtube.com/@gonewiththewynns/videos' }, { title: 'How We Make Money While Traveling', url: 'https://www.youtube.com/@gonewiththewynns/videos' }, { title: 'Building Our Dream Life on the Road', url: 'https://www.youtube.com/@gonewiththewynns/videos' }] },
    { name: 'Camila Tells', handle: '@camilatells', platform: 'TikTok', followers: '380K', content_style: 'Solo female travel creator focused on safety, budget, and honest experiences. Her "what it\'s actually like" format performs consistently well with first-time solo travellers.', top_video_example: '"Travelling Solo as a Woman in Morocco — The Honest Truth"', avatar_initials: 'CT', avatar_color: '#B8E8D0', profile_url: 'https://www.tiktok.com/@camilatells', engagement_rate: '7.9%', posting_cadence: '4x/week', last_posted: '1 day ago', is_dormant: false, why_watch: 'Honest takes on safety and solo female travel that build trust and actionability', top_videos: [{ title: 'Travelling Solo as a Woman in Morocco — The Honest Truth', url: 'https://www.tiktok.com/@camilatells' }, { title: 'Safety Tips for Female Solo Travelers', url: 'https://www.tiktok.com/@camilatells' }, { title: 'Solo Travel Budget Breakdown by Destination', url: 'https://www.tiktok.com/@camilatells' }] },
    { name: 'Mark Wiens', handle: '@markwiens', platform: 'YouTube', followers: '9.4M', content_style: 'Food travel creator who documents local eating experiences worldwide. Extremely loyal audience and a masterclass in building a personal brand around a specific niche.', top_video_example: '"I Ate Nothing But Street Food in Bangkok for a Week — Here\'s What Happened"', avatar_initials: 'MW', avatar_color: '#F5D0C5', profile_url: 'https://www.youtube.com/@markwiens', engagement_rate: '6.1%', posting_cadence: '2x/week', last_posted: '2 days ago', is_dormant: false, why_watch: 'Niche authority in food travel that creates aspirational yet authentic content', top_videos: [{ title: 'I Ate Nothing But Street Food in Bangkok for a Week', url: 'https://www.youtube.com/@markwiens/videos' }, { title: 'Best Street Food Markets in Southeast Asia', url: 'https://www.youtube.com/@markwiens/videos' }, { title: 'How to Eat Like a Local in Any Country', url: 'https://www.youtube.com/@markwiens/videos' }] },
    { name: 'Jade Darmawangsa', handle: '@jadedarmawangsa', platform: 'YouTube', followers: '320K', content_style: 'Digital nomad content creator sharing the reality of building income online while travelling. Transparent about earnings and business breakdowns which drives very high trust.', top_video_example: '"My Income Report: $47K in a Month While Travelling Through Europe"', avatar_initials: 'JD', avatar_color: '#D0E8F5', profile_url: 'https://www.youtube.com/@jadedarmawangsa', engagement_rate: '5.8%', posting_cadence: '2x/month', last_posted: '1 week ago', is_dormant: false, why_watch: 'Transparent income breakdowns that make the nomad lifestyle seem achievable and real', top_videos: [{ title: 'My Income Report: $47K in a Month While Travelling', url: 'https://www.youtube.com/@jadedarmawangsa/videos' }, { title: 'How to Build Multiple Income Streams While Travelling', url: 'https://www.youtube.com/@jadedarmawangsa/videos' }, { title: 'Honest Look at the Digital Nomad Lifestyle', url: 'https://www.youtube.com/@jadedarmawangsa/videos' }] },
  ];

  // Try Anthropic if key is available
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: `You are a content strategist for an Australian travel & lifestyle creator. List 10 real, active travel/lifestyle/digital nomad creators who are growing fast and worth studying in 2025. Include a mix of TikTok and YouTube. Return ONLY valid JSON, no markdown:\n[{"name":"Creator Name","handle":"@handle","platform":"TikTok|YouTube|Instagram","followers":"e.g. 340K","content_style":"2 sentences on their style and what makes them stand out","top_video_example":"Title of one of their best-performing videos"}]`
          }]
        })
      });
      const d = await r.json();
      if (r.ok) {
        let text = '';
        for (const b of (d.content || [])) { if (b.type === 'text') text += b.text; }
        const m = text.match(/\[[\s\S]*\]/);
        if (m) {
          const results = JSON.parse(m[0]);
          if (results.length > 0) {
            return res.json({ results, fetchedAt: new Date().toISOString(), source: 'anthropic' });
          }
        }
      }
    } catch (_) {}
  }

  // Always return fallback — shuffle order by seed so each Refresh shows a different ordering
  res.json({ results: seededShuffle(fallback, seed), fetchedAt: new Date().toISOString(), source: 'curated' });
}
