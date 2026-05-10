import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import html2canvas from "html2canvas";

// ─────────────────────────────────────────────────────────────
// 🔧 API CONFIG
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  YT_API_KEY:       'AIzaSyBw6nbEtl_ZN_aaijpp4njYgXT6enGj-pU',
  YT_CHANNEL_ID:    'UCpi1tHHbTLZmGvOoREHZDsw',
  IG_ACCESS_TOKEN:  'YOUR_IG_ACCESS_TOKEN',
  IG_USER_ID:       'YOUR_IG_USER_ID',
  TIKTOK_PROXY_URL: '/api/tiktok',
};

const BG    = '#FFFFFF';
const CARD  = '#F7F9FC';
const BDR   = '#CDD4E0';
const BLUE  = '#88EAF6';   // Bright Sky — accent, CTAs
const YELL  = '#E1D9AE';   // Sand — warm highlights
const OCEAN = '#EEF9FD';   // Deep Ocean — secondary accent, depth
const SLATE = '#2E4A66';   // Slate — body copy, metadata
const TEXT  = '#1A2744';   // Dark charcoal — headings & body

function fmtFull(n) {
  if (!n && n !== 0) return '—';
  return Number(n).toLocaleString('en-US');
}
function usd(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
// ── Analytics helpers ─────────────────────────────────────────
function detectHookType(title) {
  const t = title.toLowerCase().trim();
  if (/^(why|what|how|which|when|who|does|is|can|should|will|do|are)\b/.test(t) || t.endsWith('?')) return 'Question';
  if (/\b\$[\d,]+|\b\d+\s*(days?|hours?|weeks?|months?|years?|things?|ways?|tips?|secrets?|reasons?|mistakes?|cities?|countries?|flights?|stops?|places?|spots?|nights?)\b/.test(t)) return 'Number';
  if (/\b(i tried|i spent|i did|i tested|i went|i quit|i left|i made|i found|i got|i visited|i lived|i traveled|i flew|i stayed|i booked|i moved|i ate|i drove)\b/.test(t)) return 'Story';
  if (/\b(vs\.?|versus|challenge|compare[d]?|review[ed]?|honest|worth it|is it worth|better or worse)\b/.test(t)) return 'Review';
  if (/\b(how to|guide|tutorial|tips?|tricks?|hacks?|secret|mistakes?|must.know|beginner|step by step|everything you need)\b/.test(t)) return 'Educational';
  if (/\b(exploring|visited|a day in|\d+\s*hours? in|hours? in|week in|days? in|weekend in|morning in|night in|solo in|travel(ing|ling)? to)\b/.test(t)) return 'Destination';
  if (/\b(best|top|greatest|most underrated|most overrated|underrated|hidden gem|must.see|must.visit|must.try|you need to)\b/.test(t)) return 'Listicle';
  if (/\b(never|always|stop|don'?t|the truth|nobody talks|no one talks|real reason|biggest mistake|this is why|here'?s why|actually|honest(ly)?)\b/.test(t)) return 'Bold Claim';
  if (/\b(you won'?t believe|this changed|changed my life|insane|unbelievable|mindblowing|blew my mind|i can'?t believe|wait until|watch this|shocked)\b/.test(t)) return 'Clickbait';
  return 'Standard';
}
const HOOK_COLORS = {
  'Question':   '#88EAF6',
  'Number':     '#E1D9AE',
  'Story':      '#C4A8D8',
  'Review':     '#A8D8B4',
  'Educational':'#D8C4A8',
  'Destination':'#F4B87A',
  'Listicle':   '#FFD580',
  'Bold Claim': '#F47A7A',
  'Clickbait':  '#F4A0C8',
  'Standard':   '#6E6E6E',
};
const HOOK_DEFS = {
  'Question':    'Opens with a question word (What, Why, How, etc.) or ends with "?". Creates a curiosity gap — viewers click to get the answer. Ex: "Why I Left Australia to Travel Full Time"',
  'Number':      'Uses a specific number to signal clear, bite-sized value. Viewers know exactly what they\'re getting. Ex: "5 Things Nobody Tells You About Bali" or "I Spent $500 in Tokyo"',
  'Story':       'First-person narrative hook ("I tried", "I went", "I spent"). Builds personal connection and makes viewers feel like they\'re on the journey with you.',
  'Review':      'Comparison or honest-opinion format ("vs.", "Review", "Worth It?"). Positions you as the trusted expert. Ex: "Business Class vs Economy — Honest Review"',
  'Educational': '"How To" or tutorial format. Drives saves and shares because people bookmark it to reference later. Ex: "How to Book Cheap Flights to Japan"',
  'Destination': 'Opens with a place name or experience ("Exploring Tokyo", "24 Hours in Rome"). Attracts search traffic from people actively planning trips to that location.',
  'Listicle':    'Uses "Best", "Top", or "Most Underrated" without a specific number. Implies a curated, expert selection. Ex: "Best Beaches in Southeast Asia You\'ve Never Heard Of"',
  'Bold Claim':  'Makes a strong or contrarian statement ("Never do this", "The Truth About..."). Stops the scroll with conviction — works best when you can actually back it up.',
  'Clickbait':   'Uses emotionally charged language to maximise curiosity ("Unbelievable", "This Changed Everything"). High click-through but needs strong delivery to keep watch time up.',
  'Standard':    'No clear hook pattern detected. These titles typically underperform the named hook types — consider testing a Question, Number, or Bold Claim reframe.',
};
const HOOK_PILLARS = {
  'Question':    'Educational Travel — questions drive curiosity clicks across platforms',
  'Number':      'Relatable/Actionable Life — numbered formats signal clear, digestible value',
  'Story':       'Personal Storytimes — first-person stories build strongest audience connection',
  'Review':      'Educational Travel — honest reviews position you as the trusted authority',
  'Educational': 'Relatable/Actionable Life — how-to content earns saves and shares',
  'Destination': 'Educational Travel — destination content captures high-intent search traffic',
  'Listicle':    'Relatable/Actionable Life — curated lists earn shares and saves',
  'Bold Claim':  'Personal Storytimes — conviction-led hooks build authority and debate',
  'Clickbait':   'Pet Experiments — emotional hooks drive high click-through on trending topics',
  'Standard':    'Consider testing a stronger hook format for this type of content',
};

function ytBenchmark(subs) {
  // Returns typical engagement benchmarks based on subscriber tier
  if (subs < 5000)   return { likeRate: 3.5, commentRate: 0.4, viewRatio: 45 };
  if (subs < 25000)  return { likeRate: 2.8, commentRate: 0.3, viewRatio: 35 };
  if (subs < 100000) return { likeRate: 2.0, commentRate: 0.25, viewRatio: 25 };
  return                     { likeRate: 1.2, commentRate: 0.15, viewRatio: 15 };
}

function igBenchmark(followers) {
  // Typical IG benchmarks by follower tier — like/comment/save rate (÷ reach, same pattern as YT)
  if (followers < 5000)   return { likeRate: 4.0, commentRate: 0.7, saveRate: 2.5 };
  if (followers < 25000)  return { likeRate: 3.0, commentRate: 0.5, saveRate: 1.5 };
  if (followers < 100000) return { likeRate: 2.0, commentRate: 0.3, saveRate: 1.0 };
  return                          { likeRate: 1.2, commentRate: 0.2, saveRate: 0.6 };
}

function ttBenchmark(followers) {
  // Typical TikTok benchmarks by follower tier — engagement is calculated against views
  // (TikTok industry benchmarks; like/comment/share rate ÷ views)
  if (followers < 10000)   return { engRate: 9.0, likeRate: 12,  commentRate: 0.7, shareRate: 1.5 };
  if (followers < 100000)  return { engRate: 6.5, likeRate: 8,   commentRate: 0.4, shareRate: 0.8 };
  if (followers < 1000000) return { engRate: 5.0, likeRate: 6,   commentRate: 0.3, shareRate: 0.6 };
  return                           { engRate: 4.0, likeRate: 5,   commentRate: 0.2, shareRate: 0.5 };
}

function fmtViews(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1)    + 'K';
  return String(n);
}

function scoreLabel(val, benchmark) {
  if (val >= benchmark * 1.5) return { label: 'Excellent', color: '#96C9AA' };
  if (val >= benchmark * 1.0) return { label: 'Above avg', color: '#A8D8E0' };
  if (val >= benchmark * 0.7) return { label: 'Average',   color: '#D9D0A0' };
  return                              { label: 'Below avg', color: '#C9A0A0' };
}

function statusColor(s) {
  return ({
    'In Production':'#A8D8E0','Review':'#D9D0A0','Under Review':'#D9D0A0',
    'Negotiating':'#D9D0A0','Outreach':'#999999','Pitched':'#9BBFCF',
    'Pitching':'#9BBFCF','Awaiting Approval':'#D9D0A0','Delivered':'#A8D8E0',
    'Paid':'#96C9AA','Not Paid':'#C9A0A0','Declined':'#999999',
    'Gifted':'#999999','Active':'#A8D8E0','Cold':'#555','Scripting':'#D9D0A0',
    'Active Partner':'#96C9AA','Warm Lead':'#D9D0A0',
  })[s] || '#999999';
}
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(_) {} };

// ── useWindowWidth hook ───────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const handle = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  return width;
}

// ── Initial data ──────────────────────────────────────────────
const INIT_DEALS = [
  { id:1,  b:'Magic Mind',        s:'Awaiting Approval', v:1000,   d:'TBC',    del:'2x UGC video',        p:'UGC',          col:'#A8D8E0' },
  { id:2,  b:'Red Note',          s:'Pitching',          v:750,    d:'TBC',    del:'1x multi-platform',   p:'TikTok/IG/YT', col:'#9BBFCF' },
  { id:3,  b:'Kingshot',          s:'Pitching',          v:744,    d:'TBC',    del:'1x UGC',              p:'UGC',          col:'#D9D0A0' },
  { id:4,  b:'AloSim',            s:'Pitching',          v:850,    d:'TBC',    del:'1x TikTok',           p:'TikTok',       col:'#A8D8E0' },
  { id:5,  b:'Pelsbarn',          s:'Pitching',          v:375,    d:'TBC',    del:'1x UGC',              p:'UGC',          col:'#C8D8DC' },
  { id:6,  b:'Xteink',            s:'Pitching',          v:1925,   d:'TBC',    del:'1x TikTok',           p:'TikTok',       col:'#9BBFCF' },
  { id:7,  b:'Darry Ring',        s:'Pitching',          v:1250,   d:'TBC',    del:'1x TikTok or IG',     p:'TikTok/IG',    col:'#D9D0A0' },
  { id:8,  b:'Perfit',            s:'Pitching',          v:1250,   d:'Apr',    del:'1x TikTok',           p:'TikTok',       col:'#A8D8E0' },
  { id:9,  b:'Airalo',            s:'Pitching',          v:1250,   d:'Apr',    del:'1x TikTok',           p:'TikTok',       col:'#9BBFCF' },
  { id:10, b:'American Airlines', s:'Paid',              v:2000,   d:'Nov 25', del:'3x UGC',              p:'UGC',          col:'#96C9AA' },
  { id:11, b:'ZBiotics',          s:'Paid',              v:600,    d:'Nov 25', del:'1x UGC',              p:'UGC',          col:'#96C9AA' },
  { id:12, b:'George Townley',    s:'Paid',              v:402.50, d:'Jan',    del:'1x Instagram',        p:'Instagram',    col:'#96C9AA' },
  { id:13, b:'SaladPower',        s:'Paid',              v:525,    d:'Feb',    del:'1x UGC',              p:'UGC',          col:'#96C9AA' },
  { id:14, b:'Facebook Bonus',    s:'Paid',              v:190,    d:'Feb',    del:'Phase 1 (20 posts)',   p:'Facebook',     col:'#96C9AA' },
  { id:15, b:'Flux Footwear',     s:'Paid',              v:400,    d:'TBC',    del:'1x UGC',              p:'UGC',          col:'#96C9AA' },
  { id:16, b:'Facebook Bonus',    s:'Paid',              v:190,    d:'Mar',    del:'Phase 1 (20 posts)',   p:'Facebook',     col:'#96C9AA' },
  { id:17, b:'Thread Beast',      s:'Not Paid',          v:0,      d:'TBC',    del:'1x TikTok + IG',      p:'TikTok/IG',    col:'#C9A0A0' },
  { id:18, b:'Lord of The Rings', s:'Declined',          v:1200,   d:'TBC',    del:'1x UGC',              p:'UGC',          col:'#AAAAAA' },
];

const INIT_REVENUE = [
  { m:'Nov', r:2600   },
  { m:'Dec', r:0      },
  { m:'Jan', r:402.50 },
  { m:'Feb', r:715    },
  { m:'Mar', r:590    },
  { m:'Apr', r:0      },
];

const INIT_MILESTONES = [
  { id:1, e:'✈️', t:'First brand deal: American Airlines!',  done:true  },
  { id:2, e:'💊', t:'ZBiotics deal closed',                  done:true  },
  { id:3, e:'💸', t:'Revenue: $45K',           done:false, pct:9,  cur:'$4,055',  goal:'$45K',  cat:'Revenue'  },
  { id:4, e:'🤝', t:'Deals: 24',               done:false, pct:21, cur:'5',       goal:'24',    cat:'Deals'    },
  { id:5, e:'👥', t:'Total Audience: 90K',     done:false, pct:73, cur:'65,320',  goal:'90K',   cat:'Audience' },
  { id:6, e:'🎬', t:'Content: 260 posts',      done:false, pct:17, cur:'45',      goal:'260',   cat:'Content'  },
  { id:7, e:'📱', t:'TikTok: 100K followers',  done:false, pct:51, cur:'50,900',  goal:'100K',  cat:'Audience' },
  { id:8, e:'📸', t:'Instagram: 20K followers',done:false, pct:65, cur:'12,900',  goal:'20K',   cat:'Audience' },
];

// ── CRM outreach scoring (all 4 signals) ──────────────────────
function crmScore(c, now = Date.now()) {
  if (c.s === 'Declined') return -1;
  let score = 0;
  if (c.lastDate) {
    const days = Math.floor((now - new Date(c.lastDate)) / 86400000);
    if (days > 365) score += 30; else if (days > 180) score += 20; else if (days > 90) score += 10; else score -= 5;
  } else { score += 15; }
  if (c.paidDeal) score += 40;
  if (c.dealValue >= 5000) score += 20; else if (c.dealValue >= 1000) score += 15; else if (c.dealValue >= 500) score += 10; else if (c.dealValue > 0) score += 5;
  if (c.s === 'Active Partner') score += 15; else if (c.s === 'Warm Lead') score += 8;
  return score;
}
function crmWhy(c) {
  const r = [];
  if (c.paidDeal) r.push('Past paid partner');
  if (c.dealValue >= 1000) r.push(`$${c.dealValue.toLocaleString()} potential`);
  if (c.lastDate) { const d = Math.floor((Date.now()-new Date(c.lastDate))/86400000); if (d > 90) r.push(`${Math.round(d/30)}mo since contact`); }
  if (c.s === 'Warm Lead') r.push('Warm lead');
  return r.slice(0,3).join(' · ') || 'Due for follow-up';
}

const INIT_CRM = [
  // ── AUSTRALIA ─────────────────────────────────────────────────
  { id:1,  b:'Vamp',                           n:'Erika',               e:'erika@vamp.me',                       s:'Cold',           type:'Creator Portal',   country:'Australia',     brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:null,         last:'—',            note:'Creator portal — signed up.' },
  { id:2,  b:'Influencer.com',                 n:'—',                   e:'',                                    s:'Cold',           type:'Creator Portal',   country:'Australia',     brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:null,         last:'—',            note:'Creator portal — confirm country.' },
  { id:3,  b:'Captiv8',                        n:'—',                   e:'',                                    s:'Cold',           type:'Creator Portal',   country:'Australia',     brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:null,         last:'—',            note:'Creator portal — confirm country.' },
  { id:4,  b:'Insense',                        n:'—',                   e:'',                                    s:'Cold',           type:'Creator Portal',   country:'Australia',     brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:null,         last:'—',            note:'Creator portal.' },
  { id:5,  b:'House of Marketers',             n:'Ajey',                e:'ajey@houseofmarketers.com',           s:'Cold',           type:'Creator Agency',   country:'Australia',     brands:'Hello Fresh',                                      niche:['Food'],                    paidDeal:false, dealValue:0,     lastDate:'2024-01-08', last:'Jan 8, 2024',   note:'Initial outreach. No response.' },
  { id:6,  b:'Vaynermedia',                    n:'Avinder Dhillon',     e:'avinder.dhillon@vaynermedia.com',     s:'Active Partner', type:'Creator Agency',   country:'Australia',     brands:'Twisties',                                         niche:['Food','Lifestyle'],        paidDeal:true,  dealValue:800,   lastDate:'2024-01-08', last:'Jan 8, 2024',   note:'Worked on Twisties campaign. Contacted Daisy (influencer manager).' },
  { id:7,  b:'The Wired Agency',               n:'David',               e:'david@thewiredagency.com.au',         s:'Active Partner', type:'Creator Agency',   country:'Australia',     brands:'Pizza Hut',                                        niche:['Food'],                    paidDeal:true,  dealValue:800,   lastDate:'2024-01-11', last:'Jan 11, 2024',  note:'Worked on Pizza Hut campaign. Follow-up sent Jan 11. Steph cc\'d for future briefs.' },
  { id:8,  b:'Sticki',                         n:'—',                   e:'hello@stickicreators.com.au',         s:'Cold',           type:'Creator Agency',   country:'Australia',     brands:'Vegemite',                                         niche:['Food'],                    paidDeal:false, dealValue:0,     lastDate:'2024-03-05', last:'Mar 5, 2024',   note:'Followed up Jan 8 email — no response. Brands: Vegemite.' },
  { id:9,  b:'wemoney',                        n:'Marj',                e:'marj@we.money',                       s:'Active Partner', type:'Brand Direct',     country:'Australia',     brands:'WeMoney app',                                      niche:['Finance','Tech'],          paidDeal:true,  dealValue:500,   lastDate:'2024-03-13', last:'Mar 13, 2024',  note:'Marj will reach out if any campaigns come up.' },
  { id:10, b:'Sprout Social',                  n:'Niah Hart',           e:'',                                    s:'Warm Lead',      type:'Marketing Agency', country:'Australia',     brands:'Australian Gold',                                  niche:['Beauty'],                  paidDeal:false, dealValue:800,   lastDate:'2025-01-28', last:'Jan 28, 2025',  note:'Agency reached out for potential brand deal with Australian Gold.' },
  { id:11, b:'The Exposure Co.',               n:'Daisy Ronald',        e:'',                                    s:'Warm Lead',      type:'Marketing Agency', country:'Australia',     brands:'Lucas Papaw Remedies',                             niche:['Beauty'],                  paidDeal:false, dealValue:500,   lastDate:'2025-06-06', last:'Jun 6, 2025',   note:'Reached out via LinkedIn + shared stats. Beauty product IG/TikTok campaign.' },
  { id:74, b:'Bref',                           n:'—',                   e:'',                                    s:'Warm Lead',      type:'Brand Direct',     country:'Australia',     brands:'Bref',                                             niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2025-06-06', last:'Jun 6, 2025',   note:'Filled out their site application directly.' },
  { id:12, b:'HooZu',                          n:'—',                   e:'',                                    s:'Warm Lead',      type:'Marketing Agency', country:'Australia',     brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2025-06-06', last:'Jun 6, 2025',   note:'Filled out site application.' },
  { id:13, b:'Hello Social',                   n:'—',                   e:'hello@hellosocial.com.au',            s:'Warm Lead',      type:'Marketing Agency', country:'Australia',     brands:'Amazon, Uber, FIFA',                               niche:['Tech','Lifestyle'],        paidDeal:false, dealValue:1000,  lastDate:'2025-06-06', last:'Jun 6, 2025',   note:'Sent email intro. Large brands: Amazon, Uber, FIFA.' },
  { id:14, b:'We Are Social',                  n:'—',                   e:'',                                    s:'Warm Lead',      type:'Marketing Agency', country:'Australia',     brands:'Samsung, Audi, Sephora',                           niche:['Tech','Beauty','Fashion'], paidDeal:false, dealValue:1500,  lastDate:'2025-06-06', last:'Jun 6, 2025',   note:'Filled out application. Premium brands: Samsung, Audi, Sephora.' },
  { id:15, b:'Wear Cape',                      n:'—',                   e:'',                                    s:'Warm Lead',      type:'Marketing Agency', country:'Australia',     brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2025-06-06', last:'Jun 6, 2025',   note:'Filled out application on their site.' },
  { id:16, b:'Two Palms',                      n:'—',                   e:'',                                    s:'Warm Lead',      type:'Marketing Agency', country:'Australia',     brands:'Amazon Prime Video, Tourism Australia',            niche:['Travel','Entertainment'],  paidDeal:false, dealValue:1000,  lastDate:'2025-06-06', last:'Jun 6, 2025',   note:'Reached out via contact section. Brands: Amazon Prime Video, Tourism Australia.' },
  { id:17, b:'Lumentate',                      n:'—',                   e:'',                                    s:'Active Partner', type:'Creator Portal',   country:'Australia',     brands:'Lumentate Meditation App',                         niche:['Fitness','Tech'],          paidDeal:true,  dealValue:400,   lastDate:'2025-05-15', last:'May 15, 2025',  note:'Created brand video on TikTok boosted via spark. Via Collabstr.' },
  { id:18, b:'GegoPro Luggage Tracker',        n:'Carolina Ferrante',   e:'',                                    s:'Active Partner', type:'Creator Portal',   country:'Australia',     brands:'GegoPro Luggage Tracker',                          niche:['Travel','Tech'],           paidDeal:true,  dealValue:300,   lastDate:'2025-04-15', last:'Apr 15, 2025',  note:'Created Amazon UGC video & YouTube Shorts.' },
  // ── UNITED STATES ─────────────────────────────────────────────
  { id:19, b:'True Classic',                   n:'Heddy Tiu',           e:'heddy.tiu@trueclassic.com',           s:'Active Partner', type:'Brand Direct',     country:'United States', brands:'True Classic',                                     niche:['Fashion'],                 paidDeal:true,  dealValue:1000,  lastDate:'2024-01-03', last:'Jan 3, 2024',   note:'2x product campaigns + 1x paid campaign.' },
  { id:20, b:'Daily Harvest',                  n:'Brooke',              e:'tastemakers@daily-harvest.com',       s:'Active Partner', type:'Brand Direct',     country:'United States', brands:'Daily Harvest',                                    niche:['Food','Fitness'],          paidDeal:true,  dealValue:500,   lastDate:'2023-12-20', last:'Dec 20, 2023',  note:'Product campaigns + commission. Contact: Brooke.' },
  { id:21, b:'Bambassadors',                   n:'—',                   e:'creative@bambassadors.com',           s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2024-01-08', last:'Jan 8, 2024',   note:'Initial outreach.' },
  { id:22, b:'InBeat',                         n:'Patricia',            e:'outreach@inbeatmarketing.com',        s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Hopper (travel app)',                               niche:['Travel','Tech'],           paidDeal:false, dealValue:800,   lastDate:'2024-01-08', last:'Jan 8, 2024',   note:'Contact: Patricia. Brands include Hopper (travel app).' },
  { id:23, b:'Spotlight Media',                n:'Sam Habibi',          e:'affiliate@tryspotlight.org',          s:'Cold',           type:'Affiliate Agency', country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2024-01-08', last:'Jan 8, 2024',   note:'TikTok Shop partner agency. Contact: Sam Habibi (Co-founder).' },
  { id:24, b:'August United',                  n:'Lauren',              e:'Lauren@augustunited.com',             s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:null,         last:'—',            note:'⚠ Wrong email on file — needs updating.' },
  { id:25, b:'Laundry Service',                n:'Katie Gifford',       e:'Katie.Gifford@247laundryservice.com', s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2024-01-08', last:'Jan 8, 2024',   note:'⚠ Email may not be correct (source: Hunter.io).' },
  { id:26, b:'McKinney',                       n:'Victoria Lin',        e:'Victoria.Lin@mckinney.com',           s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2024-01-08', last:'Jan 8, 2024',   note:'⚠ Email may not be correct (source: Hunter.io).' },
  { id:27, b:'Station Entertainment',         n:'—',                   e:'n/a',                                 s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Entertainment'],           paidDeal:false, dealValue:0,     lastDate:'2024-03-06', last:'Mar 6, 2024',   note:'Sent message via contact form.' },
  { id:28, b:'Whalar',                         n:'—',                   e:'hello@whalar.com',                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2024-03-06', last:'Mar 6, 2024',   note:'Sent message via contact form.' },
  { id:29, b:'NeoReach',                       n:'—',                   e:'',                                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:null,         last:'—',            note:'No outreach yet.' },
  { id:30, b:'HelloSociety',                   n:'—',                   e:'',                                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:null,         last:'—',            note:'No outreach yet.' },
  { id:31, b:'Fameless',                       n:'—',                   e:'',                                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:null,         last:'—',            note:'No outreach yet.' },
  { id:32, b:'The Influencer Marketing Factory',n:'—',                  e:'',                                    s:'Warm Lead',      type:'Marketing Agency', country:'United States', brands:'Dunkin\', Nordstrom x Wildfang',                   niche:['Food','Fashion'],          paidDeal:false, dealValue:1000,  lastDate:'2025-06-06', last:'Jun 6, 2025',   note:'Filled out application form. Brands: Dunkin\' (TikTok), Nordstrom x Wildfang.' },
  { id:33, b:'Traackr',                        n:'—',                   e:'',                                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:null,         last:'—',            note:'No outreach yet.' },
  { id:34, b:'AspireIQ',                       n:'—',                   e:'',                                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:null,         last:'—',            note:'No outreach yet.' },
  { id:35, b:'The Influencer Network',         n:'—',                   e:'',                                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:null,         last:'—',            note:'No outreach yet.' },
  { id:36, b:'OLLM America',                   n:'Eric',                e:'eric@denvernaturelab.com',            s:'Cold',           type:'Brand Direct',     country:'United States', brands:'Teeth Whitening Products',                         niche:['Beauty'],                  paidDeal:false, dealValue:300,   lastDate:'2024-02-20', last:'Feb 20, 2024',  note:'Amazon Top Seller in partnership with TikTok Shop. Contact: Eric.' },
  { id:37, b:'Shapinfluencer',                 n:'Munsey Wong',         e:'munsey.wong@shapinfluencer.com',      s:'Declined',       type:'Marketing Agency', country:'United States', brands:'Temu',                                             niche:['Fashion','Lifestyle'],     paidDeal:false, dealValue:0,     lastDate:'2024-02-21', last:'Feb 21, 2024',  note:'Declined — offered $50 flat + $50-100 gift for 3 TikToks. Too low.' },
  { id:38, b:'The Inkey List',                 n:'Ella Rinder',         e:'ella.rinder@beforbeauty.co.uk',       s:'Cold',           type:'Brand Direct',     country:'United States', brands:'The Inkey List',                                   niche:['Beauty'],                  paidDeal:false, dealValue:500,   lastDate:'2024-02-23', last:'Feb 23, 2024',  note:'Marketing Manager. Obtained via TikTok DM. Emailed about collab.' },
  { id:39, b:'Vaseline',                       n:'—',                   e:'vaselinepr@edelman.com',              s:'Cold',           type:'Brand Direct',     country:'United States', brands:'Vaseline',                                         niche:['Beauty'],                  paidDeal:false, dealValue:800,   lastDate:'2024-02-26', last:'Feb 26, 2024',  note:'Obtained via TikTok DM. Emailed about collab opps.' },
  { id:40, b:'1 Hotels',                       n:'—',                   e:'TikTok DM',                           s:'Cold',           type:'Brand Direct',     country:'United States', brands:'1 Hotels',                                         niche:['Travel'],                  paidDeal:false, dealValue:1000,  lastDate:'2024-02-25', last:'Feb 25, 2024',  note:'Sent TikTok DM. Info passed to marketing team.' },
  { id:41, b:'Gilette',                        n:'Issa Reaumond',       e:'issa.reaumond@ketchum.com',           s:'Cold',           type:'Brand Direct',     country:'United States', brands:'Gilette',                                          niche:['Fitness','Lifestyle'],     paidDeal:false, dealValue:500,   lastDate:'2024-02-26', last:'Feb 26, 2024',  note:'Obtained via TikTok DM. Ketchum agency contact.' },
  { id:42, b:'Small Screen',                   n:'Will',                e:'will@smallscreenmarketing.com',       s:'Cold',           type:'Marketing Agency', country:'United States', brands:'Plannin',                                          niche:['Tech','Travel'],           paidDeal:false, dealValue:500,   lastDate:'2024-03-06', last:'Mar 6, 2024',   note:'Campaign manager. Discussed affiliate (5%) + potential paid partnership.' },
  { id:43, b:'Zoneify by Zone.TV',             n:'Lilly',               e:'lilly@creatoropportunity.com',        s:'Cold',           type:'Brand Direct',     country:'United States', brands:'Zone.tv',                                          niche:['Entertainment','Tech'],    paidDeal:false, dealValue:300,   lastDate:'2024-03-20', last:'Mar 20, 2024',  note:'Initial outreach.' },
  { id:44, b:'aloSIM',                         n:'Andreea',             e:'andreea@affinityclick.com',           s:'Active Partner', type:'Brand Direct',     country:'United States', brands:'aloSIM',                                           niche:['Travel','Tech'],           paidDeal:true,  dealValue:850,   lastDate:'2024-04-11', last:'Apr 11, 2024',  note:'1x YT video. Pitched with additional deliverables + 30% discount.' },
  { id:45, b:'Creator Deck',                   n:'Mina Stojic',         e:'',                                    s:'Cold',           type:'Marketing Agency', country:'United States', brands:'YSL',                                              niche:['Beauty','Fashion'],        paidDeal:false, dealValue:1000,  lastDate:'2024-04-29', last:'Apr 29, 2024',  note:'Offered PR pack for pride perfume line. Shared media kit for paid interest.' },
  { id:46, b:'Mighty Joy',                     n:'Caroline Polak',      e:'',                                    s:'Warm Lead',      type:'Creator Agency',   country:'United States', brands:'Airalo eSim + more',                               niche:['Travel','Tech'],           paidDeal:false, dealValue:800,   lastDate:'2024-06-21', last:'Jun 21, 2024',  note:'Caroline reached out regarding Airalo eSim campaign.' },
  { id:47, b:'Thing or Two',                   n:'Fabiana Falconi',     e:'',                                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2024-12-10', last:'Dec 10, 2024',  note:'Initial contact.' },
  { id:48, b:'Socially Powerful',              n:'—',                   e:'',                                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2024-12-24', last:'Dec 24, 2024',  note:'Sent application form.' },
  { id:49, b:'Aspire',                         n:'—',                   e:'',                                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2024-12-24', last:'Dec 24, 2024',  note:'Sent application form.' },
  { id:50, b:'The Shelf Influencer Agency',    n:'—',                   e:'',                                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2024-12-24', last:'Dec 24, 2024',  note:'Filled out profile. Check back if they post brand briefs.' },
  { id:51, b:'Moburst',                        n:'—',                   e:'',                                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Tech','Lifestyle'],        paidDeal:false, dealValue:0,     lastDate:'2024-12-24', last:'Dec 24, 2024',  note:'Invited to join creator network.' },
  { id:52, b:'Obviously',                      n:'—',                   e:'contact@obvious.ly',                  s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2024-12-24', last:'Dec 24, 2024',  note:'Filled out profile. Check back if they post brand briefs.' },
  { id:53, b:'Ubiquitous Influencer Marketing',n:'—',                   e:'',                                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2024-12-24', last:'Dec 24, 2024',  note:'Sent application form.' },
  { id:54, b:'Viral Nation',                   n:'—',                   e:'',                                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2024-12-24', last:'Dec 24, 2024',  note:'Sent application form.' },
  { id:55, b:'HypeFactory',                    n:'—',                   e:'',                                    s:'Cold',           type:'Creator Agency',   country:'United States', brands:'Various',                                          niche:['Lifestyle'],               paidDeal:false, dealValue:0,     lastDate:'2024-12-24', last:'Dec 24, 2024',  note:'Sent application form.' },
  { id:56, b:'inbeat agency',                  n:'Marko Popovski',      e:'',                                    s:'Warm Lead',      type:'Creator Agency',   country:'United States', brands:'Dockers + others',                                 niche:['Fashion'],                 paidDeal:false, dealValue:1800,  lastDate:'2025-01-26', last:'Jan 26, 2025',  note:'Contacted about Dockers: 2x IG videos + 2x IG stories $1,400 + $400 exclusivity.' },
  { id:57, b:'Trafalgar',                      n:'Jonathan Monney',     e:'',                                    s:'Warm Lead',      type:'Marketing Agency', country:'United States', brands:'Contiki, Trafalgar, Insight Vacations',            niche:['Travel'],                  paidDeal:false, dealValue:2000,  lastDate:'2025-02-05', last:'Feb 5, 2025',   note:'Jonathan reached out to sign Paul up to their agency. Portfolio: Contiki, Trafalgar, Insight Vacations.' },
  { id:58, b:'Obviously (Premium)',            n:'Kaycee Morales',      e:'contact@obvious.ly',                  s:'Warm Lead',      type:'Marketing Agency', country:'United States', brands:'Google, Ulta Beauty, Lyft, Amazon',                niche:['Tech','Beauty','Lifestyle'],paidDeal:false, dealValue:10000, lastDate:'2025-03-14', last:'Mar 14, 2025',  note:'Visit California — 1 week all expenses + $10k for 2 videos + 25 IG stories.' },
  { id:59, b:'Inopro',                         n:'Aleksandra',          e:'',                                    s:'Warm Lead',      type:'Brand Direct',     country:'United States', brands:'Smile & Shine White Strips',                       niche:['Beauty'],                  paidDeal:false, dealValue:300,   lastDate:'2025-04-02', last:'Apr 2, 2025',   note:'Offered $300 for TikTok + Instagram repost as introductory rate.' },
  { id:60, b:'The Outloud Group',              n:'—',                   e:'',                                    s:'Warm Lead',      type:'Marketing Agency', country:'United States', brands:'23andMe, Dollar Shave Club, Grubhub, Warby Parker', niche:['Tech','Lifestyle','Beauty'],paidDeal:false, dealValue:1000,  lastDate:'2025-06-06', last:'Jun 6, 2025',   note:'Filled out contact form. Strong brand portfolio.' },
  { id:61, b:'Carusele',                       n:'—',                   e:'',                                    s:'Warm Lead',      type:'Marketing Agency', country:'United States', brands:'Starbucks, Walgreens, Pepsi, Häagen-Dazs',         niche:['Food','Lifestyle'],        paidDeal:false, dealValue:1000,  lastDate:'2025-06-06', last:'Jun 6, 2025',   note:'Submitted media kit and joined creator network.' },
  { id:62, b:'Sway Group',                     n:'—',                   e:'',                                    s:'Active Partner', type:'Marketing Agency', country:'United States', brands:'Pinterest, HGTV Magazine, Ariat Boots',            niche:['Fashion','Lifestyle'],     paidDeal:true,  dealValue:1500,  lastDate:'2025-06-06', last:'Jun 6, 2025',   note:'Joined creator network. Worked on Ariat Boots. Great rates for video.' },
  { id:63, b:'Famex Associates',               n:'Shajjadur Rahman',    e:'',                                    s:'Active Partner', type:'Brand Direct',     country:'United States', brands:'Famex',                                            niche:['Lifestyle'],               paidDeal:true,  dealValue:400,   lastDate:'2025-07-14', last:'Jul 14, 2025',  note:'Created UGC post for their social accounts.' },
  { id:64, b:'Muus',                           n:'Elijah Fischer',      e:'',                                    s:'Active Partner', type:'Marketing Agency', country:'United States', brands:'ZBiotics, Adidas, Puma, Guess, JD Sports, Venmo',  niche:['Fitness','Fashion','Tech'], paidDeal:true,  dealValue:600,   lastDate:'2025-11-20', last:'Nov 20, 2025',  note:'ZBiotics campaign. Brand & influencer account manager.' },
  { id:65, b:'The Goat',                       n:'Shreeya Chandra',     e:'',                                    s:'Active Partner', type:'Marketing Agency', country:'United States', brands:'American Airlines, Dell, Nivea, Audi',             niche:['Travel','Lifestyle','Beauty'],paidDeal:true, dealValue:2000,  lastDate:'2025-11-20', last:'Nov 20, 2025',  note:'Worked on American Airlines Girl Math campaign. Large portfolio.' },
  { id:66, b:'Omnilux LED Mask',               n:'Kelly Hartlage',      e:'',                                    s:'Warm Lead',      type:'Brand Direct',     country:'United States', brands:'Omnilux',                                          niche:['Beauty','Fitness'],        paidDeal:false, dealValue:800,   lastDate:'2025-11-26', last:'Nov 26, 2025',  note:'Proactive reach out for Black Friday/holiday campaigns.' },
  { id:67, b:'Dog and A Duck',                 n:'Brian Rosman',        e:'',                                    s:'Warm Lead',      type:'Marketing Agency', country:'United States', brands:'Tryst Hotel, hotels, restaurants, fashion',        niche:['Travel','Food','Fashion'], paidDeal:false, dealValue:2000,  lastDate:'2025-12-08', last:'Dec 8, 2025',   note:'Offered The Tryst Puerto Vallarta: 3-night stay + $250 F&B credit. Recap reel deliverable.' },
  { id:68, b:'Delta Airlines',                 n:'—',                   e:'media@delta.com',                     s:'Warm Lead',      type:'Brand Direct',     country:'United States', brands:'Delta Airlines',                                   niche:['Travel'],                  paidDeal:false, dealValue:5000,  lastDate:'2025-12-16', last:'Dec 16, 2025',  note:'Proactive outreach to general media contact sharing past travel examples.' },
  { id:69, b:'Vibeology',                      n:'—',                   e:'hello@vibeology.co',                  s:'Warm Lead',      type:'Marketing Agency', country:'United States', brands:'Skylar, SPANX, Vibeology Co., EDJY Nails',        niche:['Fashion','Beauty'],        paidDeal:false, dealValue:1000,  lastDate:'2025-12-17', last:'Dec 17, 2025',  note:'Agency replied + asked to be added to their roster for future campaigns.' },
  { id:70, b:'ITA Airways',                    n:'Massimo Allegri',     e:'',                                    s:'Warm Lead',      type:'Brand Direct',     country:'United States', brands:'Italia Airways',                                   niche:['Travel'],                  paidDeal:false, dealValue:3000,  lastDate:'2026-01-02', last:'Jan 2, 2026',   note:'Proactive outreach after seeing their marketing campaign go live.' },
  { id:71, b:'Smile & Shine White Strips',     n:'—',                   e:'',                                    s:'Active Partner', type:'Brand Direct',     country:'United States', brands:'Smile & Shine',                                    niche:['Beauty'],                  paidDeal:true,  dealValue:300,   lastDate:null,         last:'—',            note:'Created 1x TikTok shop video.' },
  // ── CANADA ────────────────────────────────────────────────────
  { id:72, b:'The Influence Agency',           n:'—',                   e:'',                                    s:'Cold',           type:'Marketing Agency', country:'Canada',        brands:'Lowe\'s, Jamieson Vitamins, Napoleon',             niche:['Lifestyle','Fitness'],     paidDeal:false, dealValue:0,     lastDate:null,         last:'—',            note:'Filled submission form (requires min 10K following).' },
  // ── CHINA ─────────────────────────────────────────────────────
  { id:73, b:'GIMC',                           n:'Camille',             e:'notification@tobrands.cc',            s:'Cold',           type:'Marketing Agency', country:'China',         brands:'Cookware, drone, pet products',                    niche:['Lifestyle','Tech'],        paidDeal:false, dealValue:0,     lastDate:'2024-02-19', last:'Feb 19, 2024',  note:'Contact: Camille. Products: cookware set, drone, pet clothes.' },
];

const INIT_DELIVS = [
  { id:1, b:'Magic Mind',    sc:'Video submitted 03.29', d:'TBC', s:'Awaiting Approval', pl:'UGC (2x)',     pay:'$1,000' },
  { id:2, b:'Flux Footwear', sc:'Content delivered',     d:'TBC', s:'Paid',              pl:'UGC',          pay:'$400'   },
  { id:3, b:'Red Note',      sc:'Rate card shared',      d:'TBC', s:'Pitching',          pl:'TikTok/IG/YT', pay:'$750'   },
  { id:4, b:'Xteink',        sc:'Quote sent 02.26',      d:'TBC', s:'Pitching',          pl:'TikTok',       pay:'$1,925' },
  { id:5, b:'AloSim',        sc:'Pitched $850',          d:'TBC', s:'Pitching',          pl:'TikTok',       pay:'$850'   },
  { id:6, b:'Darry Ring',    sc:'Quote sent',            d:'TBC', s:'Pitching',          pl:'TikTok/IG',    pay:'$1,250' },
  { id:7, b:'Perfit',        sc:'Rate requested',        d:'Apr', s:'Pitching',          pl:'TikTok',       pay:'$1,250' },
  { id:8, b:'Airalo',        sc:'Rate requested',        d:'Apr', s:'Pitching',          pl:'TikTok',       pay:'$1,250' },
];

const COMMENTS = [
  { id:1, u:'@travelwithsarah', t:'This is literally the only creator I trust for honest reviews. No BS ever.', p:'instagram', pos:true  },
  { id:2, u:'@marcojones92',    t:'Your editing has gotten SO good. Love the energy in every video',             p:'tiktok',    pos:true  },
  { id:3, u:'@adventures_eli',  t:'Been following for 2 years and you never miss. Keep going!!!',                p:'youtube',   pos:true  },
  { id:4, u:'@emilyklein',      t:'You literally inspired me to quit my job and travel. Thank you 🙏',           p:'tiktok',    pos:true  },
  { id:5, u:'@nico_g',          t:'This is actually really helpful content, sharing with everyone',              p:'youtube',   pos:true  },
  { id:6, u:'@curious_traveler',t:"When's the next travel video dropping?",                                      p:'instagram', pos:false },
];

const STAGE_COLS   = ['Pitching','Awaiting Approval','Delivered','Paid','Not Paid','Declined'];
// Date sort helper — most recent first, TBC pushed to bottom
function dealDateVal(d) {
  if (!d.d || d.d === 'TBC') return -1;
  const M = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
  const p = d.d.trim().split(/\s+/);
  const mo = M[p[0]] || 0;
  const yr = p[1] ? (parseInt(p[1]) < 100 ? 2000 + parseInt(p[1]) : parseInt(p[1])) : 2026;
  return yr * 100 + mo;
}
const STAGE_COLORS = { Pitching:'#9BBFCF','Awaiting Approval':'#D9D0A0',Delivered:'#A8D8E0',Paid:'#96C9AA','Not Paid':'#C9A0A0',Declined:'#999999' };
const CRM_STATUSES   = ['Active Partner','Warm Lead','Cold','Declined'];
const CRM_TYPES      = ['Marketing Agency','Creator Agency','Brand Direct','Creator Portal','Affiliate Agency'];
const CRM_COUNTRIES  = ['Australia','United States','Canada','China'];
const CRM_NICHES     = ['Travel','Beauty','Fashion','Food','Tech','Fitness','Lifestyle','Finance','Entertainment'];
const DELIV_STATUSES = ['Pitching','Scripting','In Production','Awaiting Approval','Delivered','Paid','Not Paid','Declined'];
const EMPTY_DEAL = { b:'', v:'', p:'TikTok', s:'Pitching', d:'TBC', del:'', col:'#A8D8E0', nextStep:'', remindDate:'', videoLink:'', invoiceUrl:'' };

// ── Shared components ─────────────────────────────────────────
function Card({ children, style }) {
  return <div style={{ background:CARD, border:`1px solid ${BDR}`, borderRadius:8, padding:20, boxShadow:'0 1px 3px rgba(26,39,68,0.06)', ...style }}>{children}</div>;
}
function Label({ children }) {
  return <div style={{ fontSize:10, color:'#1A2744', textTransform:'uppercase', letterSpacing:'2.5px', marginBottom:14, fontWeight:700 }}>{children}</div>;
}
function Tag({ children, color = BLUE }) {
  return <span style={{ fontSize:9, fontWeight:700, color, border:`1px solid ${color}44`, padding:'2px 8px', borderRadius:20, background:`${color}18`, whiteSpace:'nowrap' }}>{children}</span>;
}
function Inp({ value, onChange, type='text', placeholder='', style={} }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width:'100%', background:'#F8FAFC', border:`1px solid ${BDR}`, borderRadius:8, padding:'9px 12px', color:TEXT, fontSize:13, fontFamily:'inherit', outline:'none', ...style }} />
  );
}
function Sel({ value, onChange, options, style={} }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width:'100%', background:'#F8FAFC', border:`1px solid ${BDR}`, borderRadius:8, padding:'9px 12px', color:TEXT, fontSize:13, fontFamily:'inherit', outline:'none', ...style }}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── Platform Logos ────────────────────────────────────────────
function YTLogo({ size = 22 }) {
  return <svg width={size} height={size * 0.72} viewBox="0 0 24 17" fill="none"><rect width="24" height="17" rx="4" fill="#FF0000"/><path d="M9.5 4.5l7.5 4-7.5 4V4.5z" fill="white"/></svg>;
}
function IGLogo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs><linearGradient id="ig-g" x1="0" y1="24" x2="24" y2="0"><stop offset="0%" stopColor="#FFDC80"/><stop offset="30%" stopColor="#F77737"/><stop offset="65%" stopColor="#C13584"/><stop offset="100%" stopColor="#833AB4"/></linearGradient></defs>
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#ig-g)"/>
      <circle cx="12" cy="12" r="4.6" stroke="white" strokeWidth="1.8" fill="none"/>
      <circle cx="17.3" cy="6.7" r="1.3" fill="white"/>
    </svg>
  );
}
function TTLogo({ size = 22 }) {
  const p = "M17.5 2h-3v11a2.5 2.5 0 01-2.5 2.5 2.5 2.5 0 01-2.5-2.5A2.5 2.5 0 0112 10.5c.2 0 .38.03.5.06V7.56A5.5 5.5 0 0012 7.5 5.5 5.5 0 006.5 13 5.5 5.5 0 0012 18.5 5.5 5.5 0 0017.5 13V7.28A7.48 7.48 0 0021 8.25V5.3A4.5 4.5 0 0117.5 2z";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#010101"/>
      <path d={p} fill="#69C9D0" transform="translate(-0.6,0)"/>
      <path d={p} fill="#EE1D52" transform="translate(0.6,0)"/>
      <path d={p} fill="white"/>
    </svg>
  );
}

// ── Deal Modal ────────────────────────────────────────────────
function DealModal({ initial, onSave, onDelete, onClose, isMobile }) {
  const [form, setForm] = useState({ ...initial });
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const isNew = !initial.id;
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:isMobile?'flex-end':'center',justifyContent:'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:'#FFFFFF',border:`1px solid ${OCEAN}88`,borderRadius:isMobile?'20px 20px 0 0':16,padding:isMobile?'24px 20px 32px':28,width:isMobile?'100%':480,maxWidth:'100vw',maxHeight:'90vh',overflowY:'auto',boxSizing:'border-box' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:16,fontWeight:800,marginBottom:20 }}>{isNew ? 'New Brand Deal' : `Edit: ${initial.b}`}</div>
        {[['Brand Name','b','text'],['Value ($)','v','number'],['Platform','p','text'],['Deliverables','del','text']].map(([lbl,key,type]) => (
          <div key={key} style={{ marginBottom:14 }}>
            <div style={{ fontSize:10,color:SLATE,textTransform:'uppercase',letterSpacing:'2px',marginBottom:6 }}>{lbl}</div>
            <Inp type={type} value={form[key] ?? ''} onChange={v => upd(key, v)} placeholder={lbl} />
          </div>
        ))}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10,color:SLATE,textTransform:'uppercase',letterSpacing:'2px',marginBottom:6 }}>Due Date</div>
          <input type="date" value={form.d && form.d !== 'TBC' ? form.d : ''} onChange={e => upd('d', e.target.value || 'TBC')}
            style={{ width:'100%',background:'#F8FAFC',border:`1px solid ${BDR}`,borderRadius:8,padding:'9px 12px',color: form.d && form.d !== 'TBC' ? '#fff' : '#555',fontSize:13,fontFamily:'inherit',outline:'none',colorScheme:'light',cursor:'pointer' }} />
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10,color:SLATE,textTransform:'uppercase',letterSpacing:'2px',marginBottom:6 }}>Stage</div>
          <Sel value={form.s} onChange={v => upd('s', v)} options={STAGE_COLS} />
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10,color:SLATE,textTransform:'uppercase',letterSpacing:'2px',marginBottom:6 }}>📹 Video Link (Google Drive)</div>
          <Inp value={form.videoLink ?? ''} onChange={v => upd('videoLink', v)} placeholder="https://drive.google.com/..." />
          {form.videoLink && (
            <a href={form.videoLink} target="_blank" rel="noreferrer" style={{ fontSize:11,color:'#88EAF6',marginTop:5,display:'inline-block' }}>↗ Open video</a>
          )}
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10,color:SLATE,textTransform:'uppercase',letterSpacing:'2px',marginBottom:6 }}>🧾 Invoice (link or file URL)</div>
          <Inp value={form.invoiceUrl ?? ''} onChange={v => upd('invoiceUrl', v)} placeholder="https://drive.google.com/... or invoice URL" />
          {form.invoiceUrl && (
            <a href={form.invoiceUrl} target="_blank" rel="noreferrer" style={{ fontSize:11,color:'#88EAF6',marginTop:5,display:'inline-block' }}>↗ Open invoice</a>
          )}
        </div>
        <div style={{ background:`${OCEAN}55`, border:`1px solid ${OCEAN}99`, borderRadius:10, padding:'14px', marginBottom:20 }}>
          <div style={{ fontSize:10,color:BLUE,textTransform:'uppercase',letterSpacing:'2px',marginBottom:10,fontWeight:700 }}>🔔 Follow-Up Reminder</div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10,color:SLATE,textTransform:'uppercase',letterSpacing:'2px',marginBottom:6 }}>Next Step</div>
            <Inp value={form.nextStep ?? ''} onChange={v => upd('nextStep', v)} placeholder="e.g. Chase payment, send invoice, follow up on approval..." />
          </div>
          <div>
            <div style={{ fontSize:10,color:SLATE,textTransform:'uppercase',letterSpacing:'2px',marginBottom:6 }}>Remind Me On</div>
            <Inp type="date" value={form.remindDate ?? ''} onChange={v => upd('remindDate', v)} placeholder="Reminder date" style={{ colorScheme:'light' }} />
          </div>
          {form.remindDate && (
            <div style={{ fontSize:11,color:YELL,marginTop:10 }}>
              📧 A reminder will be sent to paulferrante84@gmail.com on {new Date(form.remindDate + 'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
            </div>
          )}
        </div>
        <div style={{ display:'flex',gap:10 }}>
          <button onClick={() => onSave({ ...form, v: parseFloat(form.v) || 0 })}
            style={{ flex:1,background:BLUE,color:TEXT,border:'none',borderRadius:10,padding:'13px',fontWeight:800,fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>
            {isNew ? 'Add Deal' : 'Save Changes'}
          </button>
          {!isNew && (
            <button onClick={() => { if (window.confirm(`Delete ${form.b}?`)) onDelete(form.id); }}
              style={{ background:'#1a0808',color:'#f87171',border:`1px solid #f8717144`,borderRadius:10,padding:'13px 16px',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>
              Delete
            </button>
          )}
          <button onClick={onClose}
            style={{ flex:1,background:'#F7F9FC',color:TEXT,border:`1px solid ${BDR}`,borderRadius:10,padding:'13px',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Follower Modal ────────────────────────────────────────────
function FollowerModal({ label, current, onSave, onClose, isMobile }) {
  const [val, setVal] = useState(String(current));
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:isMobile?'flex-end':'center',justifyContent:'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:'#FFFFFF',border:`1px solid ${OCEAN}88`,borderRadius:isMobile?'20px 20px 0 0':16,padding:isMobile?'28px 20px 32px':28,width:isMobile?'100%':320,maxWidth:'100vw',boxSizing:'border-box' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:15,fontWeight:700,marginBottom:6 }}>Update {label}</div>
        <div style={{ fontSize:12,color:SLATE,marginBottom:16 }}>Current: {Number(current).toLocaleString()}</div>
        <Inp value={val} onChange={setVal} type="number" placeholder="New follower count" style={{ fontSize:16 }} />
        <div style={{ display:'flex',gap:10,marginTop:16 }}>
          <button onClick={() => onSave(parseInt(val.replace(/[^0-9]/g,'')) || current)}
            style={{ flex:1,background:BLUE,color:TEXT,border:'none',borderRadius:10,padding:'14px',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'inherit' }}>Save</button>
          <button onClick={onClose}
            style={{ flex:1,background:'#F7F9FC',color:TEXT,border:`1px solid ${BDR}`,borderRadius:10,padding:'14px',fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:'inherit' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Hook tag with hover tooltip ───────────────────────────────
function HookTag({ hook }) {
  const [show, setShow] = useState(false);
  const color = HOOK_COLORS[hook] || '#6E6E6E';
  const def   = HOOK_DEFS[hook];
  return (
    <span style={{ position:'relative', display:'inline-block' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}>
      <Tag color={color}>{hook}</Tag>
      {show && def && (
        <div style={{
          position:'absolute', bottom:'calc(100% + 6px)', left:'50%', transform:'translateX(-50%)',
          background:'#0e1c28', border:`1px solid ${color}55`, borderRadius:10,
          padding:'10px 13px', fontSize:11, color:'#4A6080', lineHeight:1.6,
          width:230, zIndex:99999, pointerEvents:'none', whiteSpace:'normal', textAlign:'left',
          boxShadow:'0 4px 20px rgba(0,0,0,0.6)',
        }}>
          <div style={{ fontWeight:800, color, marginBottom:4 }}>{hook} hook</div>
          {def}
        </div>
      )}
    </span>
  );
}

// ── Video Detail Modal ────────────────────────────────────────
function VideoModal({ video, avgViews, avgEngRate, onClose, isMobile }) {
  const hook        = detectHookType(video.title);
  const hookColor   = HOOK_COLORS[hook] || SLATE;
  const viewsDelta  = avgViews > 0 ? Math.round((video.viewCount / avgViews - 1) * 100) : 0;
  const engDelta    = avgEngRate > 0 ? Math.round((video.engagementRate / avgEngRate - 1) * 100) : 0;
  const likeRate    = video.viewCount > 0 ? ((video.likeCount / video.viewCount) * 100).toFixed(2) : '0';
  const commentRate = video.viewCount > 0 ? ((video.commentCount / video.viewCount) * 100).toFixed(2) : '0';

  const hookInsights = {
    'Question':    'Question hooks create a curiosity gap — viewers feel compelled to watch to get the answer. This is one of the highest-converting hook formats on YouTube.',
    'Number':      'Number hooks set a clear expectation upfront. Viewers know exactly what they\'re getting, which reduces drop-off in the first 30 seconds.',
    'Story':       'First-person story hooks build immediate personal connection. "I tried / I went / I spent" signals authenticity and lived experience.',
    'Review':      'Honest review hooks attract high-intent viewers who are actively researching. These audiences tend to engage more and share more.',
    'Educational': 'How-to and educational hooks attract viewers with a specific goal. These videos earn the most saves and return viewers.',
    'Standard':    'This video uses a more standard title format. Consider A/B testing a question or number hook to see if performance improves.',
  };

  return (
    <div
      style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:9999,display:'flex',alignItems:isMobile?'flex-start':'center',justifyContent:'center',overflowY:'auto',padding:isMobile?0:20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        style={{ background:'#FFFFFF',border:`1px solid ${OCEAN}88`,borderRadius:isMobile?0:18,width:'100%',maxWidth:1060,maxHeight:isMobile?'100vh':'90vh',overflowY:'auto',boxSizing:'border-box',padding:isMobile?'20px 16px 32px':28,position:'relative' }}
        onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button onClick={onClose} style={{ position:'absolute',top:16,right:16,background:'none',border:`1px solid ${BDR}`,borderRadius:8,color:'#94A3B8',padding:'6px 12px',fontSize:12,cursor:'pointer',fontFamily:'inherit',zIndex:1 }}>✕ Close</button>

        {/* Title row */}
        <div style={{ paddingRight:60, marginBottom:16 }}>
          <div style={{ fontSize:isMobile?14:17, fontWeight:800, lineHeight:1.4, marginBottom:8 }}>{video.title}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
            <Tag color={hookColor}>{hook} hook</Tag>
            <span style={{ fontSize:11, color:SLATE }}>{new Date(video.publishedAt).toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}</span>
            <span style={{ fontSize:11, color:SLATE }}>· {video.duration}</span>
            {viewsDelta > 50 && <Tag color={BLUE}>★ Top performer</Tag>}
          </div>
        </div>

        {/* Main content: player + stats */}
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1.1fr 0.9fr', gap:isMobile?20:24, alignItems:'start' }}>

          {/* ── Left: YouTube embed ── */}
          <div>
            <div style={{ position:'relative', paddingBottom:'56.25%', height:0, borderRadius:12, overflow:'hidden', background:'#000' }}>
              <iframe
                src={`https://www.youtube.com/embed/${video.id}?rel=0&modestbranding=1`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', border:'none' }}
              />
            </div>
            {/* Hook insight */}
            <div style={{ marginTop:14, background:`${OCEAN}33`, borderRadius:10, padding:'14px 16px', borderLeft:`3px solid ${hookColor}` }}>
              <div style={{ fontSize:10, color:hookColor, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:6 }}>Why this hook works</div>
              <div style={{ fontSize:12, color:'#4A6080', lineHeight:1.6 }}>{hookInsights[hook]}</div>
            </div>
          </div>

          {/* ── Right: Stats ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Core metrics */}
            <div style={{ background:`${OCEAN}22`, borderRadius:12, padding:'16px', border:`1px solid ${OCEAN}55` }}>
              <div style={{ fontSize:10, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:14 }}>Video Metrics</div>
              {[
                { label:'Views',          value:fmtFull(video.viewCount),   sub: viewsDelta >= 0 ? `+${viewsDelta}% vs your avg` : `${viewsDelta}% vs your avg`, subColor: viewsDelta >= 0 ? '#96C9AA' : '#C9A0A0' },
                { label:'Likes',          value:fmtFull(video.likeCount),   sub:`${likeRate}% like rate`, subColor: parseFloat(likeRate) > 3 ? '#96C9AA' : SLATE },
                { label:'Comments',       value:fmtFull(video.commentCount),sub:`${commentRate}% comment rate`, subColor: parseFloat(commentRate) > 0.4 ? '#96C9AA' : SLATE },
                { label:'Engagement Rate',value:`${video.engagementRate}%`, sub: engDelta >= 0 ? `+${engDelta}% vs your avg` : `${engDelta}% vs your avg`, subColor: engDelta >= 0 ? '#96C9AA' : '#C9A0A0' },
              ].map(({ label, value, sub, subColor }) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'9px 0', borderBottom:`1px solid ${OCEAN}33` }}>
                  <div style={{ fontSize:12, color:SLATE }}>{label}</div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:15, fontWeight:800 }}>{value}</div>
                    <div style={{ fontSize:10, color:subColor, marginTop:1 }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* vs Channel Average */}
            <div style={{ background:`${OCEAN}22`, borderRadius:12, padding:'16px', border:`1px solid ${OCEAN}55` }}>
              <div style={{ fontSize:10, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:14 }}>vs Channel Average</div>
              <div style={{ display:'flex', gap:12 }}>
                <div style={{ flex:1, textAlign:'center', background:`${OCEAN}33`, borderRadius:10, padding:'14px 8px' }}>
                  <div style={{ fontSize:22, fontWeight:900, color: viewsDelta >= 0 ? '#96C9AA' : '#C9A0A0' }}>{viewsDelta >= 0 ? '+' : ''}{viewsDelta}%</div>
                  <div style={{ fontSize:10, color:SLATE, marginTop:4 }}>Views</div>
                </div>
                <div style={{ flex:1, textAlign:'center', background:`${OCEAN}33`, borderRadius:10, padding:'14px 8px' }}>
                  <div style={{ fontSize:22, fontWeight:900, color: engDelta >= 0 ? '#96C9AA' : '#C9A0A0' }}>{engDelta >= 0 ? '+' : ''}{engDelta}%</div>
                  <div style={{ fontSize:10, color:SLATE, marginTop:4 }}>Engagement</div>
                </div>
              </div>
            </div>

            {/* Tags */}
            {video.tags?.length > 0 && (
              <div style={{ background:`${OCEAN}22`, borderRadius:12, padding:'14px 16px', border:`1px solid ${OCEAN}55` }}>
                <div style={{ fontSize:10, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:10 }}>Tags</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {video.tags.slice(0, 8).map(t => <Tag key={t} color={SLATE}>{t}</Tag>)}
                </div>
              </div>
            )}

            {/* Open in YouTube */}
            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display:'block', textAlign:'center', background:'none', border:`1px solid ${OCEAN}`, borderRadius:10, color:BLUE, padding:'12px', fontSize:12, fontWeight:700, textDecoration:'none', transition:'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background=`${OCEAN}44`}
              onMouseLeave={e => e.currentTarget.style.background='none'}>
              ↗ Open in YouTube
            </a>

          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ── Main App
// ─────────────────────────────────────────────────────────────
function LoginScreen({ onAuth }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (data.ok) { localStorage.setItem('pf_session', data.token); onAuth(); }
      else setError(data.error || 'Incorrect email or password.');
    } catch { setError('Network error — try again.'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:'100vh', background:'#0a0f14', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Inter', system-ui, sans-serif" }}>
      <div style={{ width:'100%', maxWidth:400, padding:'0 24px' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:22, fontWeight:900, letterSpacing:'-0.5px', color:TEXT }}>paul_ferrante</div>
          <div style={{ fontSize:11, color:'#4a7a8a', letterSpacing:'3px', textTransform:'uppercase', marginTop:4 }}>command center</div>
        </div>
        <form onSubmit={submit} style={{ background:'#FFFFFF', border:'1px solid #1e3040', borderRadius:16, padding:'28px 24px' }}>
          <div style={{ fontSize:14, fontWeight:700, color:TEXT, marginBottom:20 }}>Sign in</div>
          <div style={{ marginBottom:12 }}>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required
              style={{ width:'100%', background:'#0a0f14', border:'1px solid #1e3040', borderRadius:8, padding:'10px 12px', color:TEXT, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
          </div>
          <div style={{ marginBottom:20 }}>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" required
              style={{ width:'100%', background:'#0a0f14', border:'1px solid #1e3040', borderRadius:8, padding:'10px 12px', color:TEXT, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
          </div>
          {error && <div style={{ fontSize:12, color:'#f87171', marginBottom:14 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width:'100%', background:'#2a9fd6', border:'none', borderRadius:8, padding:'11px', color:TEXT, fontSize:13, fontWeight:700, cursor: loading?'not-allowed':'pointer', fontFamily:'inherit', opacity: loading?0.7:1 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════
// PROPOSALS TAB — Rate Card Calculator & Proposal Generator
// ════════════════════════════════════════════════════════════════════

const DELIVERABLES_DEF = [
  { id:'tt_personal',  platform:'TikTok',    name:'TikTok Personal Video',              defaultRate:1250 },
  { id:'tt_sponsored', platform:'TikTok',    name:'TikTok Sponsored Video',             defaultRate:750  },
  { id:'tt_story',     platform:'TikTok',    name:'TikTok Story',                       defaultRate:300  },
  { id:'tt_lib_24h',   platform:'TikTok',    name:'Link in Bio – 24hr',                 defaultRate:200  },
  { id:'tt_lib_3d',    platform:'TikTok',    name:'Link in Bio – 3 days',               defaultRate:250  },
  { id:'tt_lib_1w',    platform:'TikTok',    name:'Link in Bio – 1 week',               defaultRate:300  },
  { id:'tt_lib_1m',    platform:'TikTok',    name:'Link in Bio – 1 month',              defaultRate:400  },
  { id:'ig_reel_p',    platform:'Instagram', name:'IG Reel Personal',                   defaultRate:850  },
  { id:'ig_reel_s',    platform:'Instagram', name:'IG Reel Sponsored',                  defaultRate:650  },
  { id:'ig_photo',     platform:'Instagram', name:'IG Photo',                           defaultRate:400  },
  { id:'ig_carousel',  platform:'Instagram', name:'IG Carousel (3 images)',             defaultRate:600  },
  { id:'ig_story',     platform:'Instagram', name:'IG Story',                           defaultRate:250  },
  { id:'ig_lib_24h',   platform:'Instagram', name:'Link in Bio – 24hr',                 defaultRate:200  },
  { id:'ig_lib_3d',    platform:'Instagram', name:'Link in Bio – 3 days',               defaultRate:250  },
  { id:'ig_lib_1w',    platform:'Instagram', name:'Link in Bio – 1 week',               defaultRate:300  },
  { id:'ig_lib_1m',    platform:'Instagram', name:'Link in Bio – 1 month',              defaultRate:400  },
  { id:'yt_personal',  platform:'YouTube',   name:'YouTube Personal Video',             defaultRate:650  },
  { id:'yt_sponsored', platform:'YouTube',   name:'YouTube Sponsored Video',            defaultRate:450  },
  { id:'yt_lib_24h',   platform:'YouTube',   name:'Link in Bio – 24hr',                 defaultRate:200  },
  { id:'yt_lib_3d',    platform:'YouTube',   name:'Link in Bio – 3 days',               defaultRate:250  },
  { id:'yt_lib_1w',    platform:'YouTube',   name:'Link in Bio – 1 week',               defaultRate:300  },
  { id:'yt_lib_1m',    platform:'YouTube',   name:'Link in Bio – 1 month',              defaultRate:400  },
  { id:'ugc_photo',    platform:'UGC',       name:'UGC Photo (3 images)',               defaultRate:500  },
  { id:'ugc_vid1',     platform:'UGC',       name:'UGC Video x1 (30-sec)',              defaultRate:650  },
  { id:'ugc_vid3',     platform:'UGC',       name:'UGC Video x3 (30-sec, multi-hook)',  defaultRate:1800 },
];

const DEFAULT_PROPOSAL_RATES = Object.fromEntries(DELIVERABLES_DEF.map(d => [d.id, d.defaultRate]));

const PROPOSAL_BUNDLES = [
  { id:'mini_ugc',      emoji:'🎬', name:'Mini UGC Starter',        standardValue:1475, clientCost:1200, savings:275,
    description:'1 UGC Video, 1 UGC Photo Set (3 images), Usage Rights 30 days',
    deliverables:{ ugc_vid1:{checked:true,qty:1}, ugc_photo:{checked:true,qty:1} },
    addOns:{ usageEnabled:true, usageMode:'30' } },
  { id:'tt_ig_combo',   emoji:'📱', name:'TikTok + IG Story Combo',  standardValue:1700, clientCost:1450, savings:250,
    description:'1 TikTok Sponsored Video, 1 IG Story, Link in Bio 24hr',
    deliverables:{ tt_sponsored:{checked:true,qty:1}, ig_story:{checked:true,qty:1}, tt_lib_24h:{checked:true,qty:1} },
    addOns:{} },
  { id:'full_takeover', emoji:'🚀', name:'Full Social Takeover',     standardValue:3175, clientCost:2750, savings:425,
    description:'1 IG Reel, 1 TikTok Personal Video, 1 IG Story, Link in Bio, Usage 30 days',
    deliverables:{ ig_reel_p:{checked:true,qty:1}, tt_personal:{checked:true,qty:1}, ig_story:{checked:true,qty:1}, ig_lib_24h:{checked:true,qty:1} },
    addOns:{ usageEnabled:true, usageMode:'30' } },
];

const RATE_BENCHMARKS = {
  tt_personal:  [[0,300,700],[10000,700,1500],[50000,1500,3000],[100000,3000,6000]],
  tt_sponsored: [[0,200,500],[10000,500,1000],[50000,1000,2000],[100000,2000,4000]],
  tt_story:     [[0,80,180],[10000,150,300],[50000,300,600],[100000,600,1200]],
  ig_reel_p:    [[0,250,600],[10000,600,1200],[50000,1200,2500],[100000,2500,5000]],
  ig_reel_s:    [[0,200,450],[10000,450,900],[50000,900,1800],[100000,1800,3500]],
  ig_photo:     [[0,150,350],[10000,300,600],[50000,600,1200],[100000,1200,2500]],
  ig_carousel:  [[0,200,450],[10000,400,800],[50000,800,1600],[100000,1600,3000]],
  ig_story:     [[0,80,180],[10000,150,300],[50000,300,600],[100000,600,1200]],
  yt_personal:  [[0,200,500],[5000,400,900],[20000,900,2000],[100000,2000,5000]],
  yt_sponsored: [[0,150,350],[5000,300,700],[20000,700,1500],[100000,1500,3500]],
  ugc_photo:    [[0,200,400],[10000,350,700],[50000,700,1200],[100000,1200,2000]],
  ugc_vid1:     [[0,300,600],[10000,500,1000],[50000,1000,1800],[100000,1800,3000]],
  ugc_vid3:     [[0,800,1500],[10000,1500,2500],[50000,2500,4500],[100000,4500,8000]],
};

function getBenchmark(delId, followers) {
  const tiers = RATE_BENCHMARKS[delId]; if (!tiers) return null;
  let tier = tiers[0];
  for (const t of tiers) { if (followers >= t[0]) tier = t; else break; }
  return { min: tier[1], max: tier[2] };
}

function calcUsagePct(days) {
  if (days <= 0) return 0;
  const t = [[0,0],[30,50],[90,75],[180,100],[365,150]];
  if (days >= 365) return 150;
  for (let i = 1; i < t.length; i++) {
    if (days <= t[i][0]) { const [d1,r1]=t[i-1],[d2,r2]=t[i]; return r1+((days-d1)/(d2-d1))*(r2-r1); }
  }
  return 150;
}

function calcExclPct(days) {
  if (days <= 0) return 0;
  const t = [[0,0],[30,60],[60,80],[90,100]];
  if (days >= 90) return 100;
  for (let i = 1; i < t.length; i++) {
    if (days <= t[i][0]) { const [d1,r1]=t[i-1],[d2,r2]=t[i]; return r1+((days-d1)/(d2-d1))*(r2-r1); }
  }
  return 100;
}


// ════════════════════════════════════════════════════════════════════
// RATE HEALTH MONITOR — 6-Signal Logic
// ════════════════════════════════════════════════════════════════════

function computeRateAlerts({ rates, deals, igFollowers, ttFollowers, ytSubs, ytAnalytics, igAnalytics, ttAnalytics, dismissedAlerts }) {
  const NICHE_MULT = 1.30;
  const GOAL_LOW = 45000;
  const DR = DEFAULT_PROPOSAL_RATES;

  // Platform follower/view data
  const followers = { TikTok:ttFollowers||0, Instagram:igFollowers||0, YouTube:ytSubs||0, UGC:Math.max(igFollowers||0,ttFollowers||0) };
  const avgViews = {
    TikTok: ttAnalytics?.aggregates?.avgViews || Math.round((ttFollowers||0)*0.08),
    Instagram: igAnalytics?.aggregates?.avgViews || Math.round((igFollowers||0)*0.12),
    YouTube: ytAnalytics?.aggregates?.avgViews || Math.round((ytSubs||0)*0.25),
    UGC: Math.round(Math.max(igFollowers||0,ttFollowers||0)*0.10),
  };
  const cpmBench = { TikTok:{min:15,max:30}, Instagram:{min:20,max:35}, YouTube:{min:10,max:30}, UGC:{min:15,max:25} };

  // Signal 1 — Deal history by platform from paid deals
  const paidDeals = (deals||[]).filter(d=>d.s==='Paid'&&d.v>0);
  const totalPaid = paidDeals.reduce((s,d)=>s+d.v,0);
  const avgDealVal = paidDeals.length>0 ? totalPaid/paidDeals.length : 800;
  const monthlyGoal = GOAL_LOW/12;
  const dealsNeededNow = Math.ceil(monthlyGoal/Math.max(avgDealVal,1));

  const histByPlatform = {};
  paidDeals.forEach(d => {
    const p = (d.p||'').toLowerCase(), del = (d.del||'').toLowerCase();
    const key = p.includes('ugc')||del.includes('ugc') ? 'UGC'
      : p.includes('tiktok')||p.includes('tt')||del.includes('tiktok') ? 'TikTok'
      : p.includes('instagram')||p.includes('ig')||del.includes('instagram') ? 'Instagram'
      : p.includes('youtube')||del.includes('youtube') ? 'YouTube' : null;
    if (key) histByPlatform[key] = [...(histByPlatform[key]||[]), d.v];
  });
  const histAvg = plat => histByPlatform[plat]?.length>0
    ? Math.round(histByPlatform[plat].reduce((s,v)=>s+v,0)/histByPlatform[plat].length) : null;

  // Signal 4 — Internal cohesion issues
  const coherence = {};
  const r = rates;
  const v = id => r[id]||DR[id]||0;
  if (v('ugc_vid3') < v('ugc_vid1')*2.5)
    coherence['ugc_vid3'] = { msg:`UGC Video x3 should be ≥ 2.5× UGC Video x1 ($${v('ugc_vid1').toLocaleString()})`, suggest:Math.round(v('ugc_vid1')*2.75) };
  if (v('tt_personal') <= v('tt_sponsored'))
    coherence['tt_personal'] = { msg:'TikTok Personal should be higher than TikTok Sponsored', suggest:Math.round(v('tt_sponsored')*1.65) };
  if (v('ig_reel_p') <= v('ig_reel_s'))
    coherence['ig_reel_p'] = { msg:'IG Reel Personal should be higher than IG Reel Sponsored', suggest:Math.round(v('ig_reel_s')*1.35) };

  const alerts = [];
  for (const d of DELIVERABLES_DEF) {
    if ((dismissedAlerts||[]).includes(d.id)) continue;
    const plat = d.platform;
    const follow = followers[plat]||0;
    const curRate = v(d.id);
    const bm = getBenchmark(d.id, follow);

    const nicheFloor = bm ? Math.round(bm.min*NICHE_MULT) : null;
    const nicheCeil  = bm ? Math.round(bm.max*NICHE_MULT) : null;
    const belowBench = nicheFloor ? (nicheFloor - curRate)/nicheFloor >= 0.15 : false;
    const coh = coherence[d.id];
    const hist = histAvg(plat);
    const belowHist = hist && curRate < hist*0.85;

    if (!belowBench && !coh && !belowHist) continue;

    const transRate = nicheFloor ? Math.round((curRate + nicheFloor)/2) : (coh?.suggest||curRate);
    const pctInc = curRate>0 ? (transRate-curRate)/curRate : 0;
    const pushback = pctInc>0.5?'High':pctInc>0.25?'Medium':'Low';

    const views = avgViews[plat]||1;
    const impliedCPM = Math.round((curRate/views)*1000);
    const transitionCPM = Math.round((transRate/views)*1000);
    const bmCPM = cpmBench[plat];

    const dealsAtCur  = Math.ceil(monthlyGoal/Math.max(curRate,1));
    const dealsAtTrans = Math.ceil(monthlyGoal/Math.max(transRate,1));

    alerts.push({ ...d, curRate, nicheFloor, nicheCeil, transRate,
      hist, belowHist, belowBench, coh, impliedCPM, transitionCPM, bmCPM,
      dealsAtCur, dealsAtTrans, dealsDiff:dealsAtCur-dealsAtTrans,
      pushback, pctInc, avgDealVal, dealsNeededNow });
  }
  return alerts;
}

function RateAlertPanel({ alert: a, onUpdate, onDismiss, isMobile }) {
  const [open, setOpen] = useState(false);
  const [riskTip, setRiskTip] = useState(false);
  const riskClr = { Low:'#1A7A40', Medium:'#8A6A10', High:'#A32D2D' };
  const riskBg  = { Low:'#E6F8EF',  Medium:'#FFF3D0', High:'#FDEAEA'  };
  const pctFmt = n => n>=0?`+${Math.round(n*100)}%`:`${Math.round(n*100)}%`;
  const riskDesc = {
    Low: 'Less than 25% increase from your current rate. Brands in your niche commonly pay this — minimal pushback expected. Safe to pitch immediately.',
    Medium: 'A 25–50% increase from your current rate. Some brands may negotiate down or pass. Worth testing on your next 2–3 pitches before making it your standard ask.',
    High: 'More than 50% increase from your current rate. A significant jump — most brands at your follower tier may decline outright. Start with the Transition rate instead and work up.',
  };

  return (
    <div style={{ border:`1px solid ${BDR}`,borderRadius:10,overflow:'hidden',marginBottom:8 }}>
      {/* Header row */}
      <div onClick={()=>setOpen(p=>!p)} style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',background:`${OCEAN}22`,transition:'background 0.15s' }}
        onMouseEnter={e=>e.currentTarget.style.background=`${OCEAN}44`}
        onMouseLeave={e=>e.currentTarget.style.background=`${OCEAN}22`}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12,fontWeight:700,color:TEXT }}>{a.name}</div>
          <div style={{ fontSize:11,color:SLATE,marginTop:2 }}>
            <span style={{ color:YELL }}>${a.curRate.toLocaleString()}</span>
            {a.transRate>a.curRate && <> → <span style={{ color:BLUE }}>${a.transRate.toLocaleString()}</span> transition → <span style={{ color:'#96C9AA' }}>${(a.nicheCeil||a.transRate).toLocaleString()}</span> market</>}
            {a.coh && !a.nicheFloor && <> → <span style={{ color:BLUE }}>${a.coh.suggest.toLocaleString()}</span> suggested</>}
          </div>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:8,flexShrink:0 }}>
          <div style={{ position:'relative',flexShrink:0 }}
            onMouseEnter={()=>setRiskTip(true)} onMouseLeave={()=>setRiskTip(false)}>
            <span style={{ fontSize:10,fontWeight:700,color:riskClr[a.pushback],background:riskBg[a.pushback],border:`1px solid ${riskClr[a.pushback]}44`,borderRadius:20,padding:'3px 8px',cursor:'help' }}>
              {a.pushback} Risk ⓘ
            </span>
            {riskTip && (
              <div style={{ position:'absolute',right:0,top:'calc(100% + 6px)',width:220,background:'#FFFFFF',border:`1px solid ${riskClr[a.pushback]}66`,borderRadius:8,padding:'10px 12px',fontSize:11,color:'#4A6080',lineHeight:1.5,zIndex:999,boxShadow:'0 8px 24px #000a',pointerEvents:'none' }}>
                <div style={{ fontWeight:700,color:riskClr[a.pushback],marginBottom:4 }}>{a.pushback} Risk</div>
                {riskDesc[a.pushback]}
              </div>
            )}
          </div>
          <span style={{ fontSize:12,color:SLATE }}>{open?'▲':'▼'}</span>
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div style={{ padding:'14px 16px',display:'flex',flexDirection:'column',gap:12 }}>

          {/* Signal 1 — Deal History */}
          {(a.hist||a.belowHist) && (
            <div style={{ background:`${OCEAN}33`,borderRadius:8,padding:10 }}>
              <div style={{ fontSize:10,color:BLUE,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:5,fontWeight:700 }}>📊 Signal 1 — Your Deal History</div>
              {a.belowHist
                ? <div style={{ fontSize:12,color:'#2E4A66',lineHeight:1.5 }}>
                    You've closed <strong>{a.platform}</strong> deals at an average of <strong style={{color:'#96C9AA'}}>${a.hist.toLocaleString()}</strong>. Your current rate of <strong style={{color:YELL}}>${a.curRate.toLocaleString()}</strong> is set <strong style={{color:'#f87171'}}>${(a.hist-a.curRate).toLocaleString()} below</strong> what brands have already paid you.
                  </div>
                : <div style={{ fontSize:12,color:'#4A6080' }}>Historical close avg for {a.platform}: <strong style={{color:'#96C9AA'}}>${a.hist.toLocaleString()}</strong> — rate is consistent ✓</div>}
            </div>
          )}

          {/* Signal 2 — CPM/CPE */}
          {a.bmCPM && (
            <div style={{ background:`${OCEAN}33`,borderRadius:8,padding:10 }}>
              <div style={{ fontSize:10,color:BLUE,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:5,fontWeight:700 }}>📡 Signal 2 — CPM Value Translation</div>
              <div style={{ fontSize:12,color:'#2E4A66',lineHeight:1.6 }}>
                At <strong style={{color:YELL}}>${a.curRate.toLocaleString()}</strong>, you're delivering an estimated CPM of <strong style={{color:a.impliedCPM<a.bmCPM.min?'#f87171':a.impliedCPM>a.bmCPM.max?'#96C9AA':YELL}}>${a.impliedCPM}</strong> — {a.impliedCPM<a.bmCPM.min?'below':'within'} paid media average (${a.bmCPM.min}–${a.bmCPM.max} for {a.platform}).
                {a.impliedCPM < a.bmCPM.min && <strong style={{color:'#96C9AA'}}> You have room to raise your rate.</strong>}
                <br/><span style={{color:SLATE,fontSize:11}}>At transition rate ${a.transRate.toLocaleString()}: implied CPM = ${a.transitionCPM}</span>
              </div>
            </div>
          )}

          {/* Signal 3 — Niche Multiplier */}
          {a.nicheFloor && (
            <div style={{ background:`${OCEAN}33`,borderRadius:8,padding:10 }}>
              <div style={{ fontSize:10,color:BLUE,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:5,fontWeight:700 }}>🌍 Signal 3 — Niche Adjustment</div>
              <div style={{ fontSize:12,color:'#2E4A66',lineHeight:1.5 }}>
                Travel/lifestyle creators index <strong style={{color:'#96C9AA'}}>+30%</strong> above generic benchmarks. Niche-adjusted range for your audience size: <strong style={{color:BLUE}}>${a.nicheFloor.toLocaleString()}–${a.nicheCeil.toLocaleString()}</strong>
                <span style={{color:SLATE}}> (base benchmark adjusted for niche premium)</span>
              </div>
            </div>
          )}

          {/* Signal 4 — Internal Cohesion */}
          {a.coh && (
            <div style={{ background:`#f87171`, opacity:1, borderRadius:8, padding:10, background:`rgba(248,113,113,0.1)`, border:`1px solid rgba(248,113,113,0.3)` }}>
              <div style={{ fontSize:10,color:'#f87171',textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:5,fontWeight:700 }}>⚠️ Signal 4 — Rate Card Coherence</div>
              <div style={{ fontSize:12,color:'#2E4A66',lineHeight:1.5 }}>
                {a.coh.msg}. Suggested: <strong style={{color:BLUE}}>${a.coh.suggest.toLocaleString()}</strong>
              </div>
            </div>
          )}

          {/* Signal 5 — Goal Pacing */}
          <div style={{ background:`${OCEAN}33`,borderRadius:8,padding:10 }}>
            <div style={{ fontSize:10,color:BLUE,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:5,fontWeight:700 }}>🎯 Signal 5 — $45K Goal Pacing</div>
            <div style={{ fontSize:12,color:'#2E4A66',lineHeight:1.6 }}>
              At your current rate of <strong style={{color:YELL}}>${a.curRate.toLocaleString()}</strong>, you need <strong style={{color:'#f87171'}}>{a.dealsAtCur} deals/month</strong> to hit $45K/year.
              {a.dealsDiff > 0 && <> Raising to <strong style={{color:BLUE}}>${a.transRate.toLocaleString()}</strong> reduces that to <strong style={{color:'#96C9AA'}}>{a.dealsAtTrans} deal{a.dealsAtTrans!==1?'s':''}/month</strong> — saving you {a.dealsDiff} deal{a.dealsDiff!==1?'s':''}/month in required volume.</>}
            </div>
          </div>

          {/* Signal 6 — Rate tiers + pushback */}
          <div style={{ background:`${OCEAN}33`,borderRadius:8,padding:10 }}>
            <div style={{ fontSize:10,color:BLUE,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:8,fontWeight:700 }}>🎚 Signal 6 — Recommended Rate Tiers</div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:8,marginBottom:10 }}>
              {[
                ['Current',YELL,a.curRate,'Where you are now'],
                ['Transition',BLUE,a.transRate,'Test on next 2–3 pitches'],
                ['Market',  '#96C9AA',a.nicheCeil||a.transRate,'Niche ceiling for your size'],
              ].map(([lbl,clr,val,sub]) => (
                <div key={lbl} style={{ textAlign:'center',background:'#F8FAFC',borderRadius:8,padding:'10px 8px',border:`1px solid ${clr}33` }}>
                  <div style={{ fontSize:9,color:clr,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:4,fontWeight:700 }}>{lbl}</div>
                  <div style={{ fontSize:18,fontWeight:900,color:clr }}>${(val||0).toLocaleString()}</div>
                  <div style={{ fontSize:9,color:SLATE,marginTop:3,lineHeight:1.3 }}>{sub}</div>
                </div>
              ))}
            </div>
            {a.pctInc > 0.5 && (
              <div style={{ fontSize:11,color:YELL,padding:'8px 10px',background:`${YELL}18`,borderRadius:6,lineHeight:1.5 }}>
                ⚠️ This is a significant jump ({Math.round(a.pctInc*100)}% increase). Consider testing the transition rate on your next 2–3 pitches before moving to market rate. For context, typical {a.platform} brand budgets for creators your size range ${(a.nicheFloor||a.curRate).toLocaleString()}–${(a.nicheCeil||a.transRate).toLocaleString()}.
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display:'flex',gap:8,paddingTop:4 }}>
            <button onClick={()=>onUpdate(a.id, a.transRate)} style={{ flex:1,background:BLUE,color:TEXT,border:'none',borderRadius:8,padding:'10px',fontWeight:800,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>
              Update to ${a.transRate.toLocaleString()} (transition)
            </button>
            <button onClick={()=>onDismiss(a.id)} style={{ background:'#F7F9FC',color:'#94A3B8',border:`1px solid ${BDR}`,borderRadius:8,padding:'10px 14px',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function ProposalsTab({ crm, setDeals, setCrm, deals, igFollowers, ttFollowers, ytSubs, ytAnalytics, igAnalytics, ttAnalytics, showToast, isMobile }) {
  const today = new Date().toISOString().split('T')[0];
  const [hdr, setHdr] = useState({ campaign:'', brand:'', contact:'', email:'', date:today });
  const updH = (k,v) => setHdr(p=>({...p,[k]:v}));

  const [rates, setRates] = useState(() => load('pf_prop_rates', DEFAULT_PROPOSAL_RATES));
  const [rateTs, setRateTs] = useState(() => load('pf_prop_rate_ts', {}));
  const [editingRC, setEditingRC] = useState(false);

  const [sel, setSel] = useState({});
  const toggleSel = id => setSel(p=>({...p,[id]:{checked:!p[id]?.checked, qty:p[id]?.qty||1}}));
  const setQty = (id,q) => setSel(p=>({...p,[id]:{...p[id],checked:true,qty:Math.max(1,parseInt(q)||1)}}));

  const [usageOn, setUsageOn] = useState(false);
  const [usageMode, setUsageMode] = useState('30');
  const [usageCustom, setUsageCustom] = useState('');
  const [exclOn, setExclOn] = useState(false);
  const [exclMode, setExclMode] = useState('30');
  const [exclCustom, setExclCustom] = useState('');
  const [libFlat, setLibFlat] = useState(false);
  const [addOnsOpen, setAddOnsOpen] = useState(true);

  const [discVal, setDiscVal] = useState('');
  const [discType, setDiscType] = useState('percent');

  const [showProposal, setShowProposal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const proposalRef = useRef(null);

  const downloadSnapshot = async () => {
    if (!proposalRef.current) return;
    setSnapping(true);
    try {
      const el = proposalRef.current;
      const canvas = await html2canvas(el, {
        backgroundColor: '#0e1e28',
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: doc => {
          // Give the cloned element a clean padding so nothing clips
          const clone = doc.querySelector('[data-proposal-snapshot]');
          if (clone) clone.style.padding = '32px';
        },
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `RGG-Proposal-${(hdr.brand||'Draft').replace(/\s+/g,'-')}-${hdr.date||'today'}.png`;
      a.click();
      showToast('Proposal image downloaded!');
    } catch (e) {
      showToast('Snapshot failed — try again');
    } finally {
      setSnapping(false);
    }
  };

  const [dealForm, setDealForm] = useState(null);
  const [dealSaved, setDealSaved] = useState(false);

  const [crmStatus, setCrmStatus] = useState(null);
  const [crmFound, setCrmFound] = useState(null);
  const [showCrmAdd, setShowCrmAdd] = useState(false);
  const [crmBuf2, setCrmBuf2] = useState({});

  const [savedPkgs, setSavedPkgs] = useState(() => load('pf_saved_pkgs', []));
  const [showSavePkg, setShowSavePkg] = useState(false);
  const [pkgName, setPkgName] = useState('');

  const [bundleHint, setBundleHint] = useState(null);
  const [dismissedHint, setDismissedHint] = useState(null);
  const [dismissedAlerts, setDismissedAlerts] = useState(() => load('pf_dismissed_rate_alerts', []));

  // ── Calculations ─────────────────────────────────────────────
  const delivSub = DELIVERABLES_DEF.reduce((s,d) => {
    const v = sel[d.id]; return v?.checked ? s + (rates[d.id]||d.defaultRate)*(v.qty||1) : s;
  }, 0);

  const usageDays = usageMode === 'perpetuity' ? 99999 : usageMode === 'custom' ? (parseInt(usageCustom)||0) : parseInt(usageMode);
  const usagePct  = usageOn ? (usageMode === 'perpetuity' ? 300 : calcUsagePct(usageDays)) : 0;
  const usageFee  = Math.round(delivSub * usagePct / 100);

  const exclDays = exclMode === 'custom' ? (parseInt(exclCustom)||0) : parseInt(exclMode);
  const exclPct  = exclOn ? calcExclPct(exclDays) : 0;
  const exclFee  = Math.round(delivSub * exclPct / 100);

  const libFee = libFlat ? 150 : 0;
  const totalWithAddons = delivSub + usageFee + exclFee + libFee;

  const discAmt = discVal
    ? discType === 'percent' ? Math.round(totalWithAddons * (parseFloat(discVal)||0) / 100)
    : parseFloat(discVal)||0
    : 0;

  const clientCost = Math.max(0, totalWithAddons - discAmt);

  // Bundle suggestion
  useEffect(() => {
    const checkedIds = Object.entries(sel).filter(([,v])=>v?.checked).map(([k])=>k).sort().join(',');
    if (!checkedIds) { setBundleHint(null); return; }
    for (const b of PROPOSAL_BUNDLES) {
      const bIds = Object.keys(b.deliverables).sort().join(',');
      if (bIds === checkedIds && clientCost > b.clientCost) {
        if (dismissedHint !== b.id) setBundleHint({ bundle:b, save: Math.round(clientCost - b.clientCost) });
        return;
      }
    }
    setBundleHint(null);
  }, [sel, clientCost, dismissedHint]);

  // Rate alerts — 6-signal logic
  const [showEmailCopied, setShowEmailCopied] = useState(false);

  const rateAlerts = computeRateAlerts({ rates, deals, igFollowers, ttFollowers, ytSubs, ytAnalytics, igAnalytics, ttAnalytics, dismissedAlerts });

  const dismissAlert = id => {
    const u = [...dismissedAlerts, id];
    setDismissedAlerts(u);
    localStorage.setItem('pf_dismissed_rate_alerts', JSON.stringify(u));
  };

  const updateRateFromAlert = (id, val) => {
    updateRate(id, val);
    showToast('Rate updated to $' + val.toLocaleString() + '!');
  };

  const copyRateHealthEmail = () => {
    if (!rateAlerts.length) return;
    const lines = [
      'Subject: RGG Media Rate Card Health Review', '',
      'Hi Paul,', '',
      "Here's your monthly rate card health summary. The following deliverables are flagged for review:", '',
    ];
    rateAlerts.forEach((a, i) => {
      lines.push((i+1) + '. ' + a.name);
      lines.push('   Current: $' + a.curRate.toLocaleString() + ' → Transition: $' + a.transRate.toLocaleString() + ' → Market: $' + ((a.nicheCeil||a.transRate)).toLocaleString());
      if (a.belowHist) lines.push('   ⚠ Below your historical close rate of $' + a.hist.toLocaleString());
      if (a.bmCPM) lines.push('   Implied CPM at current rate: $' + a.impliedCPM + ' (benchmark $' + a.bmCPM.min + '–$' + a.bmCPM.max + ')');
      lines.push('   Goal impact: ' + a.dealsAtCur + ' deals/month now → ' + a.dealsAtTrans + ' at transition rate');
      lines.push('   Pushback risk: ' + a.pushback);
      lines.push('');
    });
    lines.push('Review at: https://paulferrante-dashboard-deploy.vercel.app');
    lines.push('', '— RGG Media Rate Health Monitor');
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setShowEmailCopied(true);
      setTimeout(() => setShowEmailCopied(false), 3000);
      showToast('Email summary copied!');
    });
  };

  // Apply bundle
  const applyBundle = b => {
    setSel(b.deliverables);
    if (b.addOns?.usageEnabled) { setUsageOn(true); setUsageMode(b.addOns.usageMode||'30'); }
    const sub = Object.entries(b.deliverables).reduce((s,[id,v]) => {
      const def = DELIVERABLES_DEF.find(d=>d.id===id);
      return s + (rates[id]||def?.defaultRate||0) * (v.qty||1);
    }, 0);
    const uFee = b.addOns?.usageEnabled ? Math.round(sub * 0.5) : 0;
    const diff = (sub + uFee) - b.clientCost;
    if (diff > 0) { setDiscVal(String(diff)); setDiscType('flat'); }
    else { setDiscVal(''); }
  };

  const savePackage = () => {
    if (!pkgName.trim()) return;
    const pkg = { id:Date.now(), emoji:'📦', name:pkgName.trim(), standardValue:totalWithAddons,
      clientCost, savings:discAmt, deliverables:{...sel},
      addOns:{usageOn,usageMode,exclOn,exclMode,libFlat}, discount:{discVal,discType} };
    const u = [...savedPkgs, pkg];
    setSavedPkgs(u); localStorage.setItem('pf_saved_pkgs', JSON.stringify(u));
    setShowSavePkg(false); setPkgName(''); showToast('Package saved!');
  };

  const updateRate = (id, val) => {
    const nr = {...rates, [id]: parseFloat(val)||0};
    const nt = {...rateTs, [id]: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})};
    setRates(nr); setRateTs(nt);
    localStorage.setItem('pf_prop_rates', JSON.stringify(nr));
    localStorage.setItem('pf_prop_rate_ts', JSON.stringify(nt));
  };

  const openDealSave = () => {
    if (!showProposal) return;
    const platforms = [...new Set(DELIVERABLES_DEF.filter(d=>sel[d.id]?.checked).map(d=>d.platform))].join('/');
    const delSummary = DELIVERABLES_DEF.filter(d=>sel[d.id]?.checked)
      .map(d=>{ const s=sel[d.id]; return s.qty>1?`${s.qty}x ${d.name}`:d.name; }).join(', ');
    if (hdr.brand) {
      const found = crm.find(c=>c.b?.toLowerCase()===hdr.brand.toLowerCase());
      if (found) { setCrmStatus('found'); setCrmFound(found); }
      else setCrmStatus('not_found');
    }
    setDealForm({ b:hdr.brand||'', v:clientCost, p:platforms, del:delSummary, d:'TBC', s:'Pitching', col:'#9BBFCF', nextStep:'', remindDate:'' });
    setDealSaved(false);
  };

  const confirmDeal = () => {
    if (!dealForm) return;
    setDeals(prev=>[...prev, { ...dealForm, id:Date.now(), v:parseFloat(dealForm.v)||0 }]);
    setDealForm(null); setDealSaved(true); showToast('Deal added to pipeline!');
  };

  const confirmCrmAdd = () => {
    const id = Date.now();
    const entry = { id, b:hdr.brand||crmBuf2.b||'', n:hdr.contact||'—', e:hdr.email||crmBuf2.e||'',
      s:crmBuf2.s||'Warm Lead', type:crmBuf2.type||'Brand Direct', country:crmBuf2.country||'United States',
      niche:[], paidDeal:false, dealValue:clientCost||0,
      lastDate:new Date().toISOString().slice(0,10),
      last:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      note:`Added from proposal: ${hdr.campaign||'—'}`,brands:hdr.brand||'' };
    setCrm(p=>[...p, entry]);
    localStorage.setItem('pf_crm', JSON.stringify([...crm, entry]));
    setShowCrmAdd(false); setCrmStatus(null); showToast('Added to CRM!');
  };

  const copyEmail = () => {
    const fmtMoney = n => '$' + Math.round(n).toLocaleString();
    const lines = [
      `PROPOSAL: ${hdr.campaign||'Creator Partnership'}`,
      `Brand: ${hdr.brand||'—'}`,
      `Contact: ${hdr.contact||'—'}${hdr.email ? ' <'+hdr.email+'>' : ''}`,
      `Date: ${new Date(hdr.date+'T00:00:00').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}`,
      '', '─── DELIVERABLES ────────────────────────────────────',
    ];
    for (const platform of ['TikTok','Instagram','YouTube','UGC']) {
      const items = DELIVERABLES_DEF.filter(d=>sel[d.id]?.checked && d.platform===platform);
      if (!items.length) continue;
      lines.push('', platform.toUpperCase());
      items.forEach(d => {
        const s=sel[d.id], rate=rates[d.id]||d.defaultRate;
        lines.push(`  ${d.name}${s.qty>1?` ×${s.qty}`:''}  ·  ${fmtMoney(rate)} each  =  ${fmtMoney(rate*s.qty)}`);
      });
    }
    lines.push('', '─── ADD-ONS ─────────────────────────────────────────');
    if (usageOn) { const lbl = usageMode==='perpetuity'?'In Perpetuity':usageMode==='custom'?`${usageCustom} days`:usageMode+' days'; lines.push(`  Usage Rights (${lbl})  ·  ${fmtMoney(usageFee)}`); }
    if (exclOn) { const lbl = exclMode==='custom'?`${exclCustom} days`:exclMode+' days'; lines.push(`  Exclusivity (${lbl})  ·  ${fmtMoney(exclFee)}`); }
    if (libFlat) lines.push('  Link in Bio 24hr (flat)  ·  $150');
    if (!usageOn && !exclOn && !libFlat) lines.push('  None');
    lines.push('', '─── PRICING ─────────────────────────────────────────',
      `  Deliverables Subtotal:     ${fmtMoney(delivSub)}`);
    if (usageFee) lines.push(`  Usage Rights:             ${fmtMoney(usageFee)}`);
    if (exclFee) lines.push(`  Exclusivity:              ${fmtMoney(exclFee)}`);
    if (libFee) lines.push('  Link in Bio (flat):       $150');
    if (discAmt) lines.push(`  Discount${discType==='percent'?` (${discVal}%)`:' (flat)'}:        -${fmtMoney(discAmt)}`);
    lines.push('', `  Standard Value:   ${fmtMoney(totalWithAddons)}`, `  YOUR INVESTMENT: ${fmtMoney(clientCost)}`);
    if (discAmt > 0) lines.push(`  You Save:        ${fmtMoney(discAmt)}`);
    lines.push('', 'Rates based on current RGG Media rate card. Valid for 14 days.', '', '— Paul Ferrante | RGG Media');
    navigator.clipboard.writeText(lines.join('\n')).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2500); showToast('Copied!'); });
  };

  // ── Styles ────────────────────────────────────────────────────
  const INP = { width:'100%',background:'#F8FAFC',border:`1px solid ${BDR}`,borderRadius:8,padding:'9px 12px',color:TEXT,fontSize:13,fontFamily:'inherit',outline:'none' };
  const BTN_BLUE = { background:BLUE,color:TEXT,border:'none',borderRadius:10,padding:'12px 20px',fontWeight:800,fontSize:13,cursor:'pointer',fontFamily:'inherit' };
  const BTN_GHOST = { background:'#F7F9FC',color:'#4A6080',border:`1px solid ${BDR}`,borderRadius:10,padding:'10px 16px',fontWeight:600,fontSize:12,cursor:'pointer',fontFamily:'inherit' };
  const SECTION_HDR = { fontSize:10,color:'#1A2744',textTransform:'uppercase',letterSpacing:'2.5px',marginBottom:14,fontWeight:700 };
  const PLAT_COLORS = { TikTok:'#69C9D0', Instagram:'#C13584', YouTube:'#FF0000', UGC:YELL };

  const allBundles = [...PROPOSAL_BUNDLES, ...savedPkgs];
  const checkedItems = DELIVERABLES_DEF.filter(d=>sel[d.id]?.checked);

  return (
    <div style={{ display:'flex', flexDirection:isMobile?'column':'row', gap:isMobile?16:20, alignItems:'flex-start' }}>

      {/* ── Main column ─────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:16, minWidth:0 }}>

        {/* Rate Alerts Banner */}
        {rateAlerts.length > 0 && (
          <div style={{ background:`${YELL}12`,border:`1px solid ${YELL}44`,borderRadius:14,padding:16 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
              <div>
                <div style={{ fontSize:12,fontWeight:800,color:YELL }}>📈 Rate Card Alert — {rateAlerts.length} deliverable{rateAlerts.length>1?'s':''} flagged</div>
                <div style={{ fontSize:10,color:SLATE,marginTop:2 }}>Click any row to see the full 6-signal breakdown · Travel/lifestyle niche premium applied</div>
              </div>
              <button onClick={copyRateHealthEmail} style={{ ...BTN_GHOST,fontSize:10,padding:'6px 12px',flexShrink:0 }}>
                {showEmailCopied?'✓ Copied!':'📋 Copy Email Summary'}
              </button>
            </div>
            {rateAlerts.map(a => (
              <RateAlertPanel key={a.id} alert={a}
                onUpdate={updateRateFromAlert}
                onDismiss={dismissAlert}
                isMobile={isMobile} />
            ))}
          </div>
        )}

        {/* Section 1 — Header */}
        <Card>
          <div style={SECTION_HDR}>Proposal Details</div>
          <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:10 }}>
            {[['campaign','Campaign / Proposal Name'],['brand','Brand / Agency Name'],['contact','Contact Name'],['email','Contact Email']].map(([k,lbl]) => (
              <div key={k}>
                <div style={{ fontSize:10,color:SLATE,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:5 }}>{lbl}</div>
                <input value={hdr[k]} onChange={e=>updH(k,e.target.value)} placeholder={lbl} style={INP} />
              </div>
            ))}
            <div>
              <div style={{ fontSize:10,color:SLATE,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:5 }}>Proposal Date</div>
              <input type="date" value={hdr.date} onChange={e=>updH('date',e.target.value)} style={{ ...INP,colorScheme:'light',cursor:'pointer' }} />
            </div>
          </div>
        </Card>

        {/* Section 3 — Bundles (above deliverables for UX) */}
        <Card>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
            <div style={SECTION_HDR}>Quick-Select Packages</div>
            {checkedItems.length > 0 && <button onClick={()=>setShowSavePkg(true)} style={{ ...BTN_GHOST,fontSize:10,padding:'5px 10px' }}>💾 Save as Package</button>}
          </div>
          {showSavePkg && (
            <div style={{ display:'flex',gap:8,marginBottom:14,padding:10,background:'#F8FAFC',borderRadius:8,border:`1px solid ${OCEAN}55` }}>
              <input value={pkgName} onChange={e=>setPkgName(e.target.value)} placeholder="Package name…" style={{ ...INP,flex:1 }} onKeyDown={e=>{ if(e.key==='Enter')savePackage(); }} />
              <button onClick={savePackage} style={{ ...BTN_BLUE,padding:'9px 14px' }}>Save</button>
              <button onClick={()=>{setShowSavePkg(false);setPkgName('');}} style={{ ...BTN_GHOST,padding:'9px 10px' }}>✕</button>
            </div>
          )}
          <div style={{ display:'flex',flexWrap:'wrap',gap:10 }}>
            {allBundles.map(b => (
              <button key={b.id} onClick={()=>applyBundle(b)} style={{
                background:`${OCEAN}44`,border:`1px solid ${OCEAN}`,borderRadius:12,padding:'12px 16px',
                cursor:'pointer',fontFamily:'inherit',textAlign:'left',flex:'0 1 auto',transition:'all 0.15s',
              }}
                onMouseEnter={e=>{e.currentTarget.style.background=`${OCEAN}88`;e.currentTarget.style.borderColor=BLUE;}}
                onMouseLeave={e=>{e.currentTarget.style.background=`${OCEAN}44`;e.currentTarget.style.borderColor=OCEAN;}}>
                <div style={{ fontSize:13,fontWeight:800,color:TEXT,marginBottom:3 }}>{b.emoji} {b.name}</div>
                <div style={{ fontSize:10,color:SLATE,marginBottom:6,lineHeight:1.4 }}>{b.description}</div>
                <div style={{ display:'flex',gap:12,fontSize:11 }}>
                  <span style={{ color:SLATE }}>Value: <span style={{color:TEXT}}>${(b.standardValue||0).toLocaleString()}</span></span>
                  <span style={{ color:BLUE }}>Cost: <strong>${(b.clientCost||0).toLocaleString()}</strong></span>
                  <span style={{ color:'#96C9AA' }}>Save ${(b.savings||0).toLocaleString()}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Bundle suggestion banner */}
        {bundleHint && (
          <div style={{ background:`#96C9AA22`,border:`1px solid #96C9AA55`,borderRadius:10,padding:'10px 14px',display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ fontSize:12,flex:1,color:'#2E4A66' }}>
              💡 This looks like <strong style={{color:BLUE}}>{bundleHint.bundle.name}</strong> — switch to that package and save <strong style={{color:'#96C9AA'}}>${bundleHint.save.toLocaleString()}</strong>
            </div>
            <button onClick={()=>applyBundle(bundleHint.bundle)} style={{ ...BTN_BLUE,padding:'6px 12px',fontSize:11 }}>Switch</button>
            <button onClick={()=>setDismissedHint(bundleHint.bundle.id)} style={{ ...BTN_GHOST,padding:'6px 8px',fontSize:11 }}>✕</button>
          </div>
        )}

        {/* Section 2 — Deliverable Selector */}
        <Card>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
            <div style={SECTION_HDR}>Deliverables</div>
            <button onClick={()=>setEditingRC(p=>!p)} style={{ ...BTN_GHOST,fontSize:10,padding:'5px 12px',borderColor:editingRC?BLUE:BDR,color:editingRC?BLUE:'#888' }}>
              {editingRC ? '🔒 Lock Rate Card' : '✏️ Edit Rate Card'}
            </button>
          </div>
          {['TikTok','Instagram','YouTube','UGC'].map(platform => {
            const items = DELIVERABLES_DEF.filter(d=>d.platform===platform);
            return (
              <div key={platform} style={{ marginBottom:16 }}>
                <div style={{ fontSize:10,fontWeight:800,color:PLAT_COLORS[platform]||BLUE,textTransform:'uppercase',letterSpacing:'2px',marginBottom:8,paddingBottom:4,borderBottom:`1px solid ${OCEAN}33` }}>{platform}</div>
                {items.map(d => {
                  const checked = !!sel[d.id]?.checked;
                  const qty = sel[d.id]?.qty || 1;
                  const rate = rates[d.id] || d.defaultRate;
                  return (
                    <div key={d.id} style={{ display:'grid',gridTemplateColumns:'18px 1fr 120px 80px',alignItems:'center',gap:10,padding:'6px 0',borderBottom:`1px solid ${BDR}22` }}>
                      <input type="checkbox" checked={checked} onChange={()=>toggleSel(d.id)} style={{ width:14,height:14,cursor:'pointer',accentColor:BLUE }} />
                      <div style={{ fontSize:12,color:checked?'#fff':'#888',fontWeight:checked?600:400 }}>{d.name}</div>
                      <div style={{ textAlign:'right' }}>
                        {editingRC ? (
                          <div>
                            <input type="number" value={rate} onChange={e=>updateRate(d.id,e.target.value)}
                              style={{ ...INP,padding:'4px 8px',fontSize:11,width:'100%',textAlign:'right' }} />
                            {rateTs[d.id] && <div style={{ fontSize:8,color:SLATE,marginTop:2 }}>Updated {rateTs[d.id]}</div>}
                          </div>
                        ) : (
                          <span style={{ fontSize:12,color:checked?YELL:SLATE }}>${rate.toLocaleString()}</span>
                        )}
                      </div>
                      <div style={{ display:'flex',alignItems:'center',gap:4 }}>
                        {checked ? (
                          <>
                            <button onClick={()=>setQty(d.id,qty-1)} style={{ width:22,height:22,background:'#F7F9FC',border:`1px solid ${BDR}`,borderRadius:4,color:TEXT,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,lineHeight:1 }}>−</button>
                            <span style={{ fontSize:12,width:16,textAlign:'center' }}>{qty}</span>
                            <button onClick={()=>setQty(d.id,qty+1)} style={{ width:22,height:22,background:'#F7F9FC',border:`1px solid ${BDR}`,borderRadius:4,color:TEXT,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,lineHeight:1 }}>+</button>
                          </>
                        ) : <span style={{ fontSize:10,color:'#94A3B8',marginLeft:4 }}>qty</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </Card>

        {/* Section 4 — Add-Ons */}
        <Card>
          <button onClick={()=>setAddOnsOpen(p=>!p)} style={{ background:'none',border:'none',cursor:'pointer',width:'100%',textAlign:'left',padding:0,fontFamily:'inherit' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={SECTION_HDR}>Add-Ons</div>
              <div style={{ fontSize:12,color:SLATE,marginBottom:14 }}>{addOnsOpen?'▲':'▼'}</div>
            </div>
          </button>
          {addOnsOpen && (
            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>

              {/* Usage Rights */}
              <div style={{ background:`${OCEAN}22`,borderRadius:10,padding:14 }}>
                <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:usageOn?12:0 }}>
                  <input type="checkbox" checked={usageOn} onChange={e=>setUsageOn(e.target.checked)} style={{ accentColor:BLUE,cursor:'pointer' }} />
                  <div style={{ fontSize:13,fontWeight:700,flex:1 }}>Usage Rights</div>
                  {usageOn && delivSub > 0 && <div style={{ fontSize:13,color:YELL,fontWeight:700 }}>${usageFee.toLocaleString()} <span style={{ fontSize:10,color:SLATE }}>({Math.round(usagePct)}% of deliverables)</span></div>}
                </div>
                {usageOn && (
                  <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
                    {[['30','30 days · 50%'],['90','90 days · 75%'],['180','6 months · 100%'],['365','12 months · 150%'],['perpetuity','In Perpetuity · 300%'],['custom','Custom']].map(([val,lbl]) => (
                      <button key={val} onClick={()=>setUsageMode(val)} style={{ background:usageMode===val?`${BLUE}22`:'#0d0d0d',border:`1px solid ${usageMode===val?BLUE:BDR}`,borderRadius:8,padding:'6px 12px',color:usageMode===val?BLUE:'#aaa',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:usageMode===val?700:400 }}>{lbl}</button>
                    ))}
                    {usageMode === 'custom' && (
                      <div style={{ display:'flex',alignItems:'center',gap:8,width:'100%',marginTop:4 }}>
                        <input type="number" value={usageCustom} onChange={e=>setUsageCustom(e.target.value)} placeholder="Enter days" style={{ ...INP,width:120,fontSize:12 }} />
                        <span style={{ fontSize:11,color:SLATE }}>days → {Math.round(calcUsagePct(parseInt(usageCustom)||0))}% = ${Math.round(delivSub*(calcUsagePct(parseInt(usageCustom)||0)/100)).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Exclusivity */}
              <div style={{ background:`${OCEAN}22`,borderRadius:10,padding:14 }}>
                <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:exclOn?12:0 }}>
                  <input type="checkbox" checked={exclOn} onChange={e=>setExclOn(e.target.checked)} style={{ accentColor:BLUE,cursor:'pointer' }} />
                  <div style={{ fontSize:13,fontWeight:700,flex:1 }}>Exclusivity</div>
                  {exclOn && delivSub > 0 && <div style={{ fontSize:13,color:YELL,fontWeight:700 }}>${exclFee.toLocaleString()} <span style={{ fontSize:10,color:SLATE }}>({Math.round(exclPct)}% of deliverables)</span></div>}
                </div>
                {exclOn && (
                  <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
                    {[['30','30 days · 60%'],['60','60 days · 80%'],['90','90 days · 100%'],['custom','Custom']].map(([val,lbl]) => (
                      <button key={val} onClick={()=>setExclMode(val)} style={{ background:exclMode===val?`${BLUE}22`:'#0d0d0d',border:`1px solid ${exclMode===val?BLUE:BDR}`,borderRadius:8,padding:'6px 12px',color:exclMode===val?BLUE:'#aaa',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:exclMode===val?700:400 }}>{lbl}</button>
                    ))}
                    {exclMode === 'custom' && (
                      <div style={{ display:'flex',alignItems:'center',gap:8,width:'100%',marginTop:4 }}>
                        <input type="number" value={exclCustom} onChange={e=>setExclCustom(e.target.value)} placeholder="Enter days" style={{ ...INP,width:120,fontSize:12 }} />
                        <span style={{ fontSize:11,color:SLATE }}>days → {Math.round(calcExclPct(parseInt(exclCustom)||0))}% = ${Math.round(delivSub*(calcExclPct(parseInt(exclCustom)||0)/100)).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Link in Bio flat */}
              <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:`${OCEAN}22`,borderRadius:10 }}>
                <input type="checkbox" checked={libFlat} onChange={e=>setLibFlat(e.target.checked)} style={{ accentColor:BLUE,cursor:'pointer' }} />
                <div style={{ fontSize:13,fontWeight:700,flex:1 }}>Link in Bio – 24hr (flat fee)</div>
                <div style={{ fontSize:13,color:libFlat?YELL:SLATE,fontWeight:libFlat?700:400 }}>$150</div>
              </div>
            </div>
          )}
        </Card>

        {/* Section 5 — Discount */}
        <Card>
          <div style={SECTION_HDR}>Discount</div>
          <div style={{ display:'flex',gap:10,alignItems:'center' }}>
            <div style={{ display:'flex',background:'#F8FAFC',border:`1px solid ${BDR}`,borderRadius:8,overflow:'hidden' }}>
              {[['percent','%'],['flat','$']].map(([t,lbl]) => (
                <button key={t} onClick={()=>setDiscType(t)} style={{ padding:'9px 14px',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:12,background:discType===t?BLUE:'transparent',color:discType===t?BG:'#888',transition:'all 0.15s' }}>{lbl}</button>
              ))}
            </div>
            <input type="number" value={discVal} onChange={e=>setDiscVal(e.target.value)} placeholder={discType==='percent'?'e.g. 10':'e.g. 200'} style={{ ...INP,flex:1 }} />
            {discAmt > 0 && <div style={{ fontSize:13,color:'#96C9AA',fontWeight:700,whiteSpace:'nowrap' }}>−${discAmt.toLocaleString()}</div>}
          </div>
        </Card>

        {/* Section 7 — Generate */}
        <div style={{ display:'flex',gap:10 }}>
          <button onClick={()=>{ if(delivSub===0){showToast('Select at least one deliverable first');return;} setShowProposal(true); }} style={{ ...BTN_BLUE,flex:1,fontSize:14,padding:'14px' }}>
            ✦ Generate Proposal
          </button>
          {showProposal && (
            <button onClick={()=>setShowProposal(false)} style={{ ...BTN_GHOST,padding:'14px 16px' }}>Reset</button>
          )}
        </div>

        {/* Proposal Output */}
        {showProposal && (
          <div style={{ background:`#0e1e28`,border:`1px solid ${BLUE}44`,borderRadius:16,overflow:'hidden' }}>
          <div ref={proposalRef} data-proposal-snapshot style={{ padding:isMobile?16:28 }}>
            {/* Header */}
            <div style={{ borderBottom:`1px solid ${OCEAN}66`,paddingBottom:16,marginBottom:16 }}>
              <div style={{ fontSize:10,color:BLUE,textTransform:'uppercase',letterSpacing:'3px',marginBottom:6 }}>paulferrante · creator proposal</div>
              <div style={{ fontSize:20,fontWeight:900,marginBottom:4 }}>{hdr.campaign || 'Creator Partnership Proposal'}</div>
              <div style={{ fontSize:13,color:SLATE }}>
                {hdr.brand && <span style={{ color:YELL,fontWeight:700 }}>{hdr.brand}</span>}
                {hdr.contact && <span> · {hdr.contact}</span>}
                {hdr.email && <span> · {hdr.email}</span>}
                <span> · {new Date(hdr.date+'T00:00:00').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</span>
              </div>
            </div>

            {/* Deliverables breakdown */}
            {['TikTok','Instagram','YouTube','UGC'].map(platform => {
              const items = DELIVERABLES_DEF.filter(d=>sel[d.id]?.checked && d.platform===platform);
              if (!items.length) return null;
              return (
                <div key={platform} style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10,fontWeight:800,color:PLAT_COLORS[platform],textTransform:'uppercase',letterSpacing:'2px',marginBottom:8 }}>{platform}</div>
                  {items.map(d => {
                    const s=sel[d.id], rate=rates[d.id]||d.defaultRate;
                    return (
                      <div key={d.id} style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${BDR}22`,fontSize:12 }}>
                        <span style={{ color:'#2E4A66' }}>{d.name}{s.qty>1?<span style={{color:SLATE}}> ×{s.qty}</span>:''}</span>
                        <div style={{ display:'flex',gap:16,textAlign:'right' }}>
                          <span style={{ color:SLATE }}>${rate.toLocaleString()}{s.qty>1?` ×${s.qty}`:''}</span>
                          <span style={{ color:YELL,fontWeight:700,minWidth:60 }}>${(rate*s.qty).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Add-ons */}
            {(usageOn || exclOn || libFlat) && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:10,fontWeight:800,color:BLUE,textTransform:'uppercase',letterSpacing:'2px',marginBottom:8 }}>Add-Ons</div>
                {usageOn && <div style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${BDR}22`,fontSize:12 }}>
                  <span style={{ color:'#2E4A66' }}>Usage Rights ({usageMode==='perpetuity'?'In Perpetuity':usageMode==='custom'?`${usageCustom} days`:usageMode+' days'}) · {Math.round(usagePct)}%</span>
                  <span style={{ color:YELL,fontWeight:700 }}>${usageFee.toLocaleString()}</span>
                </div>}
                {exclOn && <div style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${BDR}22`,fontSize:12 }}>
                  <span style={{ color:'#2E4A66' }}>Exclusivity ({exclMode==='custom'?`${exclCustom} days`:exclMode+' days'}) · {Math.round(exclPct)}%</span>
                  <span style={{ color:YELL,fontWeight:700 }}>${exclFee.toLocaleString()}</span>
                </div>}
                {libFlat && <div style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:12 }}>
                  <span style={{ color:'#2E4A66' }}>Link in Bio – 24hr (flat)</span>
                  <span style={{ color:YELL,fontWeight:700 }}>$150</span>
                </div>}
              </div>
            )}

            {/* Totals */}
            <div style={{ borderTop:`1px solid ${OCEAN}88`,paddingTop:16 }}>
              {[
                ['Deliverables Subtotal', delivSub, false],
                usageFee ? ['Usage Rights', usageFee, false] : null,
                exclFee  ? ['Exclusivity', exclFee, false] : null,
                libFee   ? ['Link in Bio (flat)', libFee, false] : null,
                discAmt  ? [`Discount${discType==='percent'?` (${discVal}%)`:' (flat)'}`, -discAmt, 'red'] : null,
              ].filter(Boolean).map(([label, val, color]) => (
                <div key={label} style={{ display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:12,color:color==='red'?'#96C9AA':SLATE }}>
                  <span>{label}</span><span>${Math.abs(val).toLocaleString()}{color==='red'?' saved':''}</span>
                </div>
              ))}
              <div style={{ display:'flex',justifyContent:'space-between',padding:'12px 0',borderTop:`1px solid ${OCEAN}55`,marginTop:8 }}>
                <div>
                  <div style={{ fontSize:10,color:SLATE,textTransform:'uppercase',letterSpacing:'2px',marginBottom:2 }}>Standard Value</div>
                  <div style={{ fontSize:16,color:'#94A3B8',textDecoration:'line-through' }}>${totalWithAddons.toLocaleString()}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:10,color:BLUE,textTransform:'uppercase',letterSpacing:'2px',marginBottom:2 }}>Your Investment</div>
                  <div style={{ fontSize:26,fontWeight:900,color:TEXT }}>${clientCost.toLocaleString()}</div>
                  {discAmt > 0 && <div style={{ fontSize:11,color:'#96C9AA',fontWeight:700 }}>You save ${discAmt.toLocaleString()}</div>}
                </div>
              </div>
            </div>

            <div style={{ fontSize:10,color:SLATE,textAlign:'center',marginTop:8,marginBottom:20,fontStyle:'italic' }}>
              Rates based on current RGG Media rate card. Valid for 14 days.
            </div>

          </div>{/* end snapshot div */}

            {/* Actions — outside snapshot */}
            <div style={{ display:'flex',gap:10,flexWrap:'wrap',padding:'14px 16px',borderTop:`1px solid ${OCEAN}44` }}>
              <button onClick={downloadSnapshot} disabled={snapping} style={{ ...BTN_BLUE,flex:1,opacity:snapping?0.7:1 }}>{snapping ? '⏳ Generating…' : '📸 Save as Image'}</button>
              {!dealSaved
                ? <button onClick={openDealSave} style={{ ...BTN_GHOST,flex:1 }}>+ Add to Deals</button>
                : <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#96C9AA',fontWeight:700 }}>✓ Added to Deals</div>}
            </div>
          </div>
        )}

        {/* Section 8 — Deal save inline form */}
        {dealForm && (
          <div style={{ background:'#FFFFFF',border:`1px solid ${OCEAN}88`,borderRadius:14,padding:20 }}>
            <div style={{ fontSize:15,fontWeight:800,marginBottom:16 }}>Add to Deal Pipeline</div>
            <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:10,marginBottom:14 }}>
              {[['Brand Name','b','text'],['Value ($)','v','number'],['Platform','p','text'],['Deliverables','del','text']].map(([lbl,k,t]) => (
                <div key={k}>
                  <div style={{ fontSize:10,color:SLATE,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:5 }}>{lbl}</div>
                  <input type={t} value={dealForm[k]||''} onChange={e=>setDealForm(p=>({...p,[k]:e.target.value}))} placeholder={lbl} style={INP} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10,color:SLATE,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:5 }}>Stage</div>
              <select value={dealForm.s} onChange={e=>setDealForm(p=>({...p,s:e.target.value}))} style={{ ...INP }}>
                {['Pitching','Awaiting Approval','Negotiating','In Production','Delivered','Paid'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={confirmDeal} style={{ ...BTN_BLUE,flex:1 }}>✓ Add Deal</button>
              <button onClick={()=>setDealForm(null)} style={{ ...BTN_GHOST }}>Cancel</button>
            </div>

            {/* CRM check result */}
            {crmStatus === 'found' && crmFound && (
              <div style={{ marginTop:12,padding:'10px 14px',background:`#96C9AA18`,border:`1px solid #96C9AA44`,borderRadius:8,fontSize:12 }}>
                ✓ <strong>{hdr.brand}</strong> is already in your CRM as <span style={{ color:'#96C9AA',fontWeight:700 }}>{crmFound.s}</span>
              </div>
            )}
            {crmStatus === 'not_found' && !showCrmAdd && (
              <div style={{ marginTop:12,padding:'10px 14px',background:`${YELL}18`,border:`1px solid ${YELL}44`,borderRadius:8 }}>
                <div style={{ fontSize:12,marginBottom:8,color:'#2E4A66' }}>
                  <strong>{hdr.brand}</strong> isn't in your CRM yet — add them?
                </div>
                <div style={{ display:'flex',gap:8 }}>
                  <button onClick={()=>{ setCrmBuf2({ s:'Warm Lead',type:'Brand Direct',country:'United States' }); setShowCrmAdd(true); }} style={{ ...BTN_GHOST,fontSize:11,padding:'6px 12px' }}>+ Add to CRM</button>
                  <button onClick={()=>setCrmStatus(null)} style={{ ...BTN_GHOST,fontSize:11,padding:'6px 10px' }}>Skip</button>
                </div>
              </div>
            )}
            {showCrmAdd && (
              <div style={{ marginTop:12,padding:14,background:'#F8FAFC',border:`1px solid ${BDR}`,borderRadius:10 }}>
                <div style={{ fontSize:13,fontWeight:700,marginBottom:10,color:BLUE }}>Add to CRM</div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10 }}>
                  {[['Status','s'],['Type','type'],['Country','country']].map(([lbl,k]) => (
                    <div key={k}>
                      <div style={{ fontSize:10,color:SLATE,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:4 }}>{lbl}</div>
                      <input value={crmBuf2[k]||''} onChange={e=>setCrmBuf2(p=>({...p,[k]:e.target.value}))} placeholder={lbl} style={INP} />
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex',gap:8 }}>
                  <button onClick={confirmCrmAdd} style={{ ...BTN_BLUE,flex:1 }}>Save to CRM</button>
                  <button onClick={()=>setShowCrmAdd(false)} style={{ ...BTN_GHOST }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Live Summary Sidebar ─────────────────────────────── */}
      <div style={{ width:isMobile?'100%':280, flexShrink:0, position:isMobile?'static':'sticky', top:80 }}>
        <Card style={{ border:`1px solid ${BLUE}33`, background:`${OCEAN}33` }}>
          <div style={SECTION_HDR}>Live Cost Summary</div>
          {delivSub === 0 ? (
            <div style={{ fontSize:12,color:SLATE,textAlign:'center',padding:'20px 0' }}>Select deliverables to see pricing</div>
          ) : (
            <>
              <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:16 }}>
                {[
                  ['Deliverables', delivSub, YELL],
                  usageFee ? ['Usage Rights', usageFee, '#ccc'] : null,
                  exclFee  ? ['Exclusivity', exclFee, '#ccc'] : null,
                  libFee   ? ['Link in Bio (flat)', 150, '#ccc'] : null,
                  discAmt  ? [`Discount`, -discAmt, '#96C9AA'] : null,
                ].filter(Boolean).map(([label, val, color]) => (
                  <div key={label} style={{ display:'flex',justifyContent:'space-between',fontSize:12 }}>
                    <span style={{ color:SLATE }}>{label}</span>
                    <span style={{ color, fontWeight:600 }}>{val < 0 ? '−$' : '$'}{Math.abs(val).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop:`1px solid ${OCEAN}88`,paddingTop:14 }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:12 }}>
                  <span style={{ color:SLATE }}>Standard value</span>
                  <span style={{ color:'#94A3B8',textDecoration:discAmt?'line-through':'' }}>${totalWithAddons.toLocaleString()}</span>
                </div>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline' }}>
                  <span style={{ fontSize:11,color:BLUE,textTransform:'uppercase',letterSpacing:'1.5px',fontWeight:700 }}>Client cost</span>
                  <span style={{ fontSize:26,fontWeight:900,color:TEXT }}>${clientCost.toLocaleString()}</span>
                </div>
                {discAmt > 0 && (
                  <div style={{ textAlign:'right',fontSize:11,color:'#96C9AA',fontWeight:700,marginTop:2 }}>
                    Their savings: ${discAmt.toLocaleString()}
                  </div>
                )}
              </div>
              <div style={{ marginTop:16,padding:'10px 12px',background:`${OCEAN}44`,borderRadius:8 }}>
                <div style={{ fontSize:10,color:BLUE,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:6,fontWeight:700 }}>Selected ({checkedItems.length})</div>
                {checkedItems.map(d => {
                  const s=sel[d.id]; return (
                    <div key={d.id} style={{ fontSize:11,color:'#4A6080',display:'flex',justifyContent:'space-between',padding:'2px 0' }}>
                      <span>{d.name}{s.qty>1?` ×${s.qty}`:''}</span>
                      <span style={{ color:YELL }}>${((rates[d.id]||d.defaultRate)*s.qty).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

    </div>
  );
}



// ─────────────────────────────────────────────────────────────
// 🎬 REALITY TV CASTING — Phase 1 (feed + fit score + filters)
// ─────────────────────────────────────────────────────────────
const CASTING_FORMAT_BUCKETS = {
  'social-strategy':       'yes',
  'big-cast-hybrid':       'yes',
  'race-travel':           'yes',
  'couples-only':          'yes',
  'creator-targeted':      'yes',
  'hybrid-physical-social':'yes',
  'one-off-game':          'maybe',
  'stunt-physical':        'maybe',
  'pure-athletic':         'no',
  'cooking':               'no',
  'creative-maker':        'no',
  'talent':                'no',
  'dating':                'no',
  'renovation':            'no',
  'business-pitch':        'no',
  'therapy':               'no',
  'fear-horror':           'no',
};
const CASTING_FORMAT_LABELS = {
  'social-strategy':'Social Strategy','big-cast-hybrid':'Big-Cast Hybrid','race-travel':'Race / Travel',
  'couples-only':'Couples','creator-targeted':'Creator-Targeted','hybrid-physical-social':'Hybrid Physical+Social',
  'one-off-game':'One-off Game Show','stunt-physical':'Stunt Physical',
};

function castingFitScore(i) {
  const bucket = CASTING_FORMAT_BUCKETS[i.formatType] || 'no';
  if (bucket === 'no') {
    return { score:1, bucket:'no', reasoning:`${CASTING_FORMAT_LABELS[i.formatType]||i.formatType} — auto-archived (format mismatch).` };
  }
  const t = Math.max(1, Math.min(10, 11 - Math.floor((i.timeCommitmentDays||14)/7)));
  const n = Math.max(4, Math.min(10, 11 - Math.floor((i.ndaMonths||12)/3)));
  const p = ({low:4,mid:6,high:8,top:10})[i.payTier] || 5;
  const e = i.eligibility==='duo-only' ? 8 : 10;
  let raw = (i.careerUpside??5)*0.25 + (i.exposureValue??5)*0.22 + (i.audienceOverlap??5)*0.12
          + p*0.12 + (i.networkEcosystem??5)*0.10 + t*0.08 + (i.brandFit??5)*0.05 + n*0.03 + e*0.03;
  if (bucket==='maybe') raw = Math.min(raw, 6);
  const score = Math.round(raw*10)/10;
  return { score, bucket, reasoning: castingReasoning(score, i, bucket) };
}
function castingReasoning(score, i, bucket) {
  const hits = [];
  if (bucket==='maybe') hits.push('format = maybe (DQ risk)');
  if ((i.careerUpside??0)>=9) hits.push('career-launching');
  else if ((i.careerUpside??0)>=7) hits.push('strong post-show upside');
  if ((i.exposureValue??0)>=9) hits.push('massive reach');
  else if ((i.exposureValue??0)>=7) hits.push(`high reach (${i.network||'top network'})`);
  if ((i.networkEcosystem??0)>=8) hits.push('opens doors at this network');
  if ((i.audienceOverlap??0)>=9) hits.push('exact audience match');
  else if ((i.audienceOverlap??0)>=7) hits.push('audience overlap');
  if (i.payTier==='top') hits.push('top payout');
  else if (i.payTier==='high') hits.push('strong payout');
  if (i.timeCommitmentDays && i.timeCommitmentDays<=14) hits.push('short shoot');
  if (i.eligibility==='duo-only' || i.eligibility==='either') hits.push('Dan-eligible');
  return `${score}: ${hits.slice(0,4).join(', ') || 'partial fit'}.`;
}

const CASTING_TODAY_REF = new Date('2026-05-03');
const castingDaysFromNow = (d) => { const x = new Date(CASTING_TODAY_REF); x.setDate(x.getDate()+d); return x.toISOString().slice(0,10); };
function makeCasting(c) {
  const r = castingFitScore({ ...c.scoreInputs, formatType:c.formatType, network:c.network });
  return { ...c, fitScore:r.score, fitReasoning:r.reasoning, bucket:r.bucket };
}
const SEED_CASTINGS = [
  makeCasting({ id:'c1', showName:'The Traitors US — Season 5', network:'Peacock', formatType:'social-strategy', market:'US', deadline:castingDaysFromNow(4),  pipelineStatus:'researching', applyLink:'https://www.peacocktv.com/casting', oneLineWhy:'Lead format for social game readers. Squid Game finalist credit + creator audience = strong tape angle.', flags:['solo'], dqRisk:false, scoreInputs:{ brandFit:9, audienceOverlap:8, exposureValue:9, careerUpside:8, networkEcosystem:6, timeCommitmentDays:21, ndaMonths:12, payTier:'high', eligibility:'solo-only' } }),
  makeCasting({ id:'c2', showName:'The Amazing Race — Season 38 (US)', network:'CBS', formatType:'race-travel', market:'US', deadline:castingDaysFromNow(11), pipelineStatus:'researching', applyLink:'https://www.cbs.com/shows/amazing_race/casting/', oneLineWhy:'Highest-fit show on the board. Travel creator + 10-yr Dan dynamic = exact CBS template.', flags:['duo-eligible','apply-with-dan'], dqRisk:false, scoreInputs:{ brandFit:10, audienceOverlap:9, exposureValue:10, careerUpside:9, networkEcosystem:10, timeCommitmentDays:28, ndaMonths:12, payTier:'top', eligibility:'duo-only' } }),
  makeCasting({ id:'c3', showName:'Beast Games — Season 2', network:'Prime Video / MrBeast', formatType:'creator-targeted', market:'US', deadline:castingDaysFromNow(2), pipelineStatus:'researching', applyLink:'https://beastgames.com/apply', oneLineWhy:'Creator-first cast. 65k cross-platform + Squid Game pedigree fits the producer brief exactly.', flags:['solo','closing-soon'], dqRisk:false, scoreInputs:{ brandFit:8, audienceOverlap:9, exposureValue:9, careerUpside:7, networkEcosystem:5, timeCommitmentDays:14, ndaMonths:18, payTier:'top', eligibility:'solo-only' } }),
  makeCasting({ id:'c4', showName:'Squid Game: The Challenge — Season 3', network:'Netflix', formatType:'big-cast-hybrid', market:'INTL', deadline:null, pipelineStatus:'researching', applyLink:'', oneLineWhy:'Returning finalist angle + show alumni credibility. Watchlist now, prep tape early.', flags:['solo','annual','returnee-angle'], dqRisk:true, dqRiskNotes:'Confirm returnee policy with casting before tape — some Netflix series block S1 finalists.', scoreInputs:{ brandFit:9, audienceOverlap:9, exposureValue:10, careerUpside:9, networkEcosystem:10, timeCommitmentDays:28, ndaMonths:18, payTier:'top', eligibility:'solo-only' } }),
  makeCasting({ id:'c5', showName:'The Amazing Race Australia — Season 8', network:'Channel 10', formatType:'race-travel', market:'AU', deadline:castingDaysFromNow(18), pipelineStatus:'researching', applyLink:'https://10play.com.au/the-amazing-race-australia/casting', oneLineWhy:'AU passport route. Travel + Dan duo + strong AU follower base = home-market home-run.', flags:['duo-eligible','apply-with-dan'], dqRisk:false, scoreInputs:{ brandFit:10, audienceOverlap:10, exposureValue:8, careerUpside:8, networkEcosystem:7, timeCommitmentDays:30, ndaMonths:12, payTier:'high', eligibility:'duo-only' } }),
  makeCasting({ id:'c6', showName:'The Traitors Australia — Season 4', network:'Channel 10', formatType:'social-strategy', market:'AU', deadline:castingDaysFromNow(22), pipelineStatus:'applied', applyLink:'https://10play.com.au/the-traitors-australia/casting', oneLineWhy:'AU eligibility. Strong audience overlap (49% AU). Squid Game finalist = camera-ready credit.', flags:['solo'], dqRisk:false, scoreInputs:{ brandFit:9, audienceOverlap:10, exposureValue:7, careerUpside:8, networkEcosystem:7, timeCommitmentDays:21, ndaMonths:12, payTier:'mid', eligibility:'solo-only' } }),
  makeCasting({ id:'c7', showName:'Big Brother — Season 27 (US)', network:'CBS', formatType:'social-strategy', market:'US', deadline:castingDaysFromNow(25), pipelineStatus:'researching', applyLink:'https://www.cbs.com/shows/big_brother/casting/', oneLineWhy:'Long-form social game with massive fanbase. Time commitment is the gate, not fit.', flags:['solo','long-shoot'], dqRisk:false, scoreInputs:{ brandFit:8, audienceOverlap:7, exposureValue:9, careerUpside:8, networkEcosystem:10, timeCommitmentDays:100, ndaMonths:24, payTier:'high', eligibility:'solo-only' } }),
  makeCasting({ id:'c8', showName:'The Mole — Season 4', network:'Netflix', formatType:'social-strategy', market:'US', deadline:castingDaysFromNow(31), pipelineStatus:'researching', applyLink:'https://www.netflix.com/casting', oneLineWhy:'Pure deception game — character-driven, strong showreel material. Travel-shoot format suits travel creator.', flags:['solo'], dqRisk:false, scoreInputs:{ brandFit:9, audienceOverlap:8, exposureValue:9, careerUpside:7, networkEcosystem:9, timeCommitmentDays:21, ndaMonths:18, payTier:'high', eligibility:'solo-only' } }),
  makeCasting({ id:'c9', showName:'Race Across the World — Series 6 (UK/AU)', network:'BBC / SBS', formatType:'race-travel', market:'INTL', deadline:castingDaysFromNow(45), pipelineStatus:'researching', applyLink:'https://www.bbc.co.uk/programmes/articles/casting', oneLineWhy:'Slow-travel format — exactly the RGG Media brand. Dan duo angle is producer catnip.', flags:['duo-eligible','apply-with-dan'], dqRisk:false, scoreInputs:{ brandFit:10, audienceOverlap:8, exposureValue:7, careerUpside:6, networkEcosystem:5, timeCommitmentDays:49, ndaMonths:12, payTier:'mid', eligibility:'duo-only' } }),
  makeCasting({ id:'c10', showName:'Deal or No Deal Island — Season 3', network:'NBC', formatType:'big-cast-hybrid', market:'US', deadline:castingDaysFromNow(60), pipelineStatus:'researching', applyLink:'https://www.nbc.com/casting', oneLineWhy:'Travel-set big-cast hybrid. Tropical shoot + social strategy = high content cross-pollination.', flags:['solo'], dqRisk:false, scoreInputs:{ brandFit:8, audienceOverlap:7, exposureValue:8, careerUpside:7, networkEcosystem:7, timeCommitmentDays:21, ndaMonths:12, payTier:'high', eligibility:'solo-only' } }),
  makeCasting({ id:'c11', showName:'Pressure Cooker — Season 2', network:'Hulu', formatType:'hybrid-physical-social', market:'US', deadline:castingDaysFromNow(7), pipelineStatus:'researching', applyLink:'https://www.hulu.com/casting', oneLineWhy:'Hybrid social-strategy show with cooking layer. Verify food vs social weighting before committing tape time.', flags:['solo','review-format'], dqRisk:false, scoreInputs:{ brandFit:6, audienceOverlap:6, exposureValue:7, careerUpside:5, networkEcosystem:5, timeCommitmentDays:14, ndaMonths:12, payTier:'mid', eligibility:'solo-only' } }),
  makeCasting({ id:'c12', showName:'The Quiz With Balls — Season 2', network:'Fox', formatType:'one-off-game', market:'US', deadline:castingDaysFromNow(10), pipelineStatus:'researching', applyLink:'https://foxcasting.com', oneLineWhy:'Low-time one-off. DQ risk for full-season casts — confirm before taping.', flags:['solo','review-dq-risk'], dqRisk:true, dqRiskNotes:'One-off appearances can disqualify you from full-season reality casts for 12-24 months at some networks. Confirm with show casting.', scoreInputs:{ brandFit:5, audienceOverlap:5, exposureValue:6, careerUpside:3, networkEcosystem:4, timeCommitmentDays:3, ndaMonths:6, payTier:'low', eligibility:'solo-only' } }),
  makeCasting({ id:'c13', showName:'The Challenge: Global Championship — Season 3', network:'CBS / Paramount+', formatType:'hybrid-physical-social', market:'INTL', deadline:null, pipelineStatus:'researching', applyLink:'', oneLineWhy:'Squid Game alumni route. Heavy physical but social strategy carries equal weight.', flags:['solo','annual','returnee-angle'], dqRisk:false, scoreInputs:{ brandFit:7, audienceOverlap:7, exposureValue:8, careerUpside:9, networkEcosystem:9, timeCommitmentDays:35, ndaMonths:18, payTier:'high', eligibility:'solo-only' } }),
];
function castingDaysUntil(d) { if (!d) return null; return Math.ceil((new Date(d) - CASTING_TODAY_REF) / 86400000); }
function castingDeadlineLabel(d) {
  if (!d) return 'Annual cycle — TBA';
  const days = castingDaysUntil(d);
  if (days < 0)  return 'Closed';
  if (days === 0) return 'Closes today';
  if (days === 1) return 'Closes tomorrow';
  if (days <= 7)  return `Closes in ${days} days`;
  if (days <= 30) return `Closes ${d}`;
  return `Open until ${d}`;
}
function castingScoreColor(s) {
  if (s >= 8) return { bg:`${BLUE}33`, color:'#0E6A80', border:BLUE };
  if (s >= 7) return { bg:`${YELL}55`, color:'#8A6A10', border:YELL };
  if (s >= 6) return { bg:`${YELL}33`, color:'#8A6A10', border:`${YELL}AA` };
  if (s >= 5) return { bg:'#F4F6F9',   color:SLATE,    border:BDR };
  return        { bg:'#F4F6F9',         color:'#94A3B8', border:BDR };
}

function RealityCastingTab() {
  const [cards, setCards] = useState(SEED_CASTINGS);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('open');
  const [filters, setFilters] = useState({ market:'all', format:'all', deadline:'all', eligibility:'all', scoreFloor:5 });
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const visible = cards.filter(c => {
    if (c.bucket === 'no') return false;
    if (activeTab === 'open' && c.deadline === null) return false;
    if (activeTab === 'closing' && (!c.deadline || castingDaysUntil(c.deadline) > 7 || castingDaysUntil(c.deadline) < 0)) return false;
    if (activeTab === 'watchlist' && !c.flags.includes('watchlist') && !c.flags.includes('returnee-angle')) return false;
    if (activeTab === 'annual' && c.deadline !== null) return false;
    if (filters.market !== 'all' && c.market !== filters.market) return false;
    if (filters.format !== 'all' && c.formatType !== filters.format) return false;
    if (filters.eligibility === 'duo' && !c.flags.includes('duo-eligible') && !c.flags.includes('apply-with-dan')) return false;
    if (filters.eligibility === 'solo' && (c.flags.includes('duo-eligible') || c.flags.includes('apply-with-dan'))) return false;
    if (c.fitScore < filters.scoreFloor) return false;
    if (filters.deadline !== 'all' && c.deadline) {
      const d = castingDaysUntil(c.deadline);
      if (filters.deadline === 'week' && d > 7) return false;
      if (filters.deadline === 'month' && d > 30) return false;
      if (filters.deadline === 'open' && d <= 30) return false;
    }
    return true;
  }).sort((a,b) => b.fitScore - a.fitScore || (a.deadline ? castingDaysUntil(a.deadline) : 999) - (b.deadline ? castingDaysUntil(b.deadline) : 999));

  const formatOptions = [...new Set(cards.filter(c => c.bucket !== 'no').map(c => c.formatType))];
  const open       = cards.filter(c => c.bucket !== 'no' && c.deadline);
  const inFlight   = cards.filter(c => ['applied','first-tape','callback','producer-interview'].includes(c.pipelineStatus));
  const urgent     = open.filter(c => castingDaysUntil(c.deadline) <= 7 && castingDaysUntil(c.deadline) >= 0);
  const topScore   = open.length ? Math.max(...open.map(c => c.fitScore)) : 0;
  const topCard    = open.filter(c => c.fitScore === topScore).sort((a,b) => castingDaysUntil(a.deadline) - castingDaysUntil(b.deadline))[0];
  const avg        = open.length ? Math.round(open.reduce((s,c) => s + c.fitScore, 0) / open.length * 10) / 10 : 0;

  const updatePipeline = (id, stage) => {
    setCards(cards.map(c => c.id === id ? { ...c, pipelineStatus:stage } : c));
    if (selected && selected.id === id) setSelected({ ...selected, pipelineStatus:stage });
  };
  const addQuickCasting = (text) => {
    if (!text.trim()) return;
    const newCard = makeCasting({
      id: `c${Date.now()}`,
      showName: text.split('\n')[0].slice(0,60) || 'Untitled casting',
      network: 'TBD', formatType:'social-strategy', market:'US',
      deadline: castingDaysFromNow(14), pipelineStatus:'researching',
      applyLink: '', oneLineWhy:'Just added — review fields and adjust scoring inputs.',
      flags:['solo'], dqRisk:false,
      scoreInputs:{ brandFit:6, audienceOverlap:6, exposureValue:6, careerUpside:6, networkEcosystem:6, timeCommitmentDays:14, ndaMonths:12, payTier:'mid', eligibility:'solo-only' }
    });
    setCards([newCard, ...cards]);
  };

  const Pill = ({ active, children, onClick }) => (
    <button onClick={onClick} style={{
      padding:'6px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
      background: active ? TEXT : '#FFFFFF', color: active ? '#FFFFFF' : SLATE,
      border: `1px solid ${active ? TEXT : BDR}`, whiteSpace:'nowrap',
    }}>{children}</button>
  );

  return (
    <div>
      <div style={{ marginBottom:18 }}>
        <Label>reality tv casting</Label>
        <div style={{ fontSize:24, fontWeight:700, color:TEXT, lineHeight:1.1, letterSpacing:'-0.5px' }}>What's open. What scores. What you should tape this week.</div>
      </div>

      {/* Stat tiles */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:12, marginBottom:18 }}>
        <div style={{ background:`linear-gradient(135deg, #B6F2F9 0%, ${BLUE} 100%)`, borderRadius:8, padding:18, border:`1px solid ${BLUE}66` }}>
          <div style={{ fontSize:10, color:TEXT, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700 }}>Highest open fit score</div>
          <div style={{ fontSize:30, fontWeight:800, color:TEXT, marginTop:4, lineHeight:1 }}>{topScore.toFixed(1)}</div>
          <div style={{ fontSize:11, color:TEXT, marginTop:4 }}>this week</div>
        </div>
        <Card>
          <div style={{ fontSize:10, color:SLATE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700 }}>Live applications</div>
          <div style={{ fontSize:30, fontWeight:800, color:TEXT, marginTop:4, lineHeight:1 }}>{inFlight.length}</div>
          <div style={{ fontSize:11, color:SLATE, marginTop:4 }}>in flight</div>
        </Card>
        <Card>
          <div style={{ fontSize:10, color:SLATE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700 }}>Open castings</div>
          <div style={{ fontSize:30, fontWeight:800, color:TEXT, marginTop:4, lineHeight:1 }}>{open.length}</div>
          <div style={{ fontSize:11, color:SLATE, marginTop:4 }}>tracked</div>
        </Card>
        <Card>
          <div style={{ fontSize:10, color:SLATE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700 }}>Avg fit score</div>
          <div style={{ fontSize:30, fontWeight:800, color:TEXT, marginTop:4, lineHeight:1 }}>{avg.toFixed(1)}</div>
          <div style={{ fontSize:11, color:SLATE, marginTop:4 }}>across open queue</div>
        </Card>
      </div>

      {/* Persona summary */}
      <Card style={{ marginBottom:14 }}>
        <div style={{ fontSize:10, color:SLATE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:6 }}>What's casting right now that fits you</div>
        {topCard ? (
          <>
            <div style={{ fontSize:16, fontWeight:600, color:TEXT, lineHeight:1.4 }}>
              Top of your queue this week: <span style={{ fontWeight:800 }}>{topCard.showName}</span> ({topCard.network}, {castingDeadlineLabel(topCard.deadline).toLowerCase()}). Scored <span style={{ fontWeight:800 }}>{topCard.fitScore}/10</span> — {topCard.oneLineWhy.toLowerCase()}
            </div>
            <div style={{ fontSize:12, color:SLATE, marginTop:8 }}>{open.length} open castings tracked · {urgent.length} closing in the next 7 days.</div>
          </>
        ) : (
          <div style={{ fontSize:14, color:TEXT }}>Nothing in the open queue scores above your floor — quiet week. Watchlist below has annual cycles to prep tapes for.</div>
        )}
      </Card>

      {/* Paste & score */}
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:14 }}>
          <div>
            <div style={{ fontSize:10, color:SLATE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700 }}>Paste &amp; score</div>
            <div style={{ fontSize:12, color:SLATE, marginTop:4 }}>Drop a casting URL or brief — gets scored against your profile and added to the feed.</div>
          </div>
          {!pasteOpen && <button onClick={() => setPasteOpen(true)} style={{ background:BLUE, color:TEXT, border:'none', borderRadius:10, padding:'9px 18px', fontWeight:800, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>+ Add casting</button>}
        </div>
        {pasteOpen && (
          <div style={{ marginTop:12 }}>
            <textarea rows="3" placeholder="Paste a casting URL, producer email, or copied brief here..." value={pasteText} onChange={e => setPasteText(e.target.value)}
              style={{ width:'100%', background:'#F8FAFC', border:`1px solid ${BDR}`, borderRadius:8, padding:'10px 12px', fontSize:13, fontFamily:'inherit', color:TEXT, outline:'none', resize:'vertical' }} />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
              <button onClick={() => { setPasteOpen(false); setPasteText(''); }} style={{ background:'#F7F9FC', color:TEXT, border:`1px solid ${BDR}`, borderRadius:8, padding:'8px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={() => { addQuickCasting(pasteText); setPasteText(''); setPasteOpen(false); }} style={{ background:TEXT, color:'#FFFFFF', border:'none', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Score &amp; add</button>
            </div>
            <div style={{ fontSize:10, color:'#94A3B8', marginTop:6 }}>Phase 1: opens a quick-add stub. Phase 2 wires AI extraction so a URL auto-fills everything.</div>
          </div>
        )}
      </Card>

      {/* Sub-tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${BDR}`, marginBottom:14 }}>
        {[['open','Open Now'],['closing','Closing Soon'],['watchlist','Watchlist'],['annual','Annual Cycles']].map(([k,l]) => (
          <div key={k} onClick={() => setActiveTab(k)} style={{
            padding:'10px 18px', fontSize:12, fontWeight:600, cursor:'pointer',
            color: activeTab===k ? TEXT : SLATE, borderBottom: activeTab===k ? `2px solid ${TEXT}` : '2px solid transparent', marginBottom:'-1px',
          }}>{l}</div>
        ))}
      </div>

      {/* Filters */}
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ fontSize:10, color:SLATE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700 }}>Filters</div>
          <div style={{ fontSize:10, color:'#94A3B8' }}>Showing {visible.length} of {cards.filter(c => c.bucket!=='no').length} (auto-archived hidden)</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div>
            <div style={{ fontSize:10, color:SLATE, textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:600, marginBottom:6 }}>Market</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['all','US','AU','CA','INTL'].map(m => <Pill key={m} active={filters.market===m} onClick={() => setFilters({...filters, market:m})}>{m==='all'?'All':m}</Pill>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, color:SLATE, textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:600, marginBottom:6 }}>Format</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Pill active={filters.format==='all'} onClick={() => setFilters({...filters, format:'all'})}>All</Pill>
              {formatOptions.map(f => <Pill key={f} active={filters.format===f} onClick={() => setFilters({...filters, format:f})}>{CASTING_FORMAT_LABELS[f]}</Pill>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, color:SLATE, textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:600, marginBottom:6 }}>Deadline</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {[['all','Any'],['week','This week'],['month','This month'],['open','Open later']].map(([k,l]) => <Pill key={k} active={filters.deadline===k} onClick={() => setFilters({...filters, deadline:k})}>{l}</Pill>)}
            </div>
          </div>
          <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:10, color:SLATE, textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:600, marginBottom:6 }}>Eligibility</div>
              <div style={{ display:'flex', gap:6 }}>
                {[['all','Any'],['solo','Solo'],['duo','+ Dan']].map(([k,l]) => <Pill key={k} active={filters.eligibility===k} onClick={() => setFilters({...filters, eligibility:k})}>{l}</Pill>)}
              </div>
            </div>
            <div>
              <div style={{ fontSize:10, color:SLATE, textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:600, marginBottom:6 }}>Fit score floor</div>
              <div style={{ display:'flex', gap:6 }}>
                {[3,5,7,8].map(n => <Pill key={n} active={filters.scoreFloor===n} onClick={() => setFilters({...filters, scoreFloor:n})}>{n}+</Pill>)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Feed */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px,1fr))', gap:14 }}>
        {visible.length === 0 ? (
          <Card style={{ gridColumn:'1/-1', textAlign:'center', padding:40 }}>
            <div style={{ color:SLATE, fontSize:13 }}>Nothing matches these filters. Try lowering the fit score floor or switching tabs.</div>
          </Card>
        ) : visible.map(c => {
          const sc = castingScoreColor(c.fitScore);
          const sev = !c.deadline ? 'open' : (castingDaysUntil(c.deadline) <= 7 ? 'urgent' : (castingDaysUntil(c.deadline) <= 21 ? 'soon' : 'open'));
          const dlColor = sev==='urgent' ? '#A32D2D' : sev==='soon' ? '#8A6A10' : SLATE;
          return (
            <Card key={c.id} style={{ cursor:'pointer', padding:16 }}>
              <div onClick={() => setSelected(c)} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ width:42, height:42, borderRadius:'50%', background:sc.bg, color:sc.color, border:`2px solid ${sc.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, flexShrink:0 }}>{c.fitScore}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:TEXT, lineHeight:1.3 }}>{c.showName}</div>
                      <div style={{ fontSize:11, color:SLATE, marginTop:2 }}>{c.network} · {c.market}</div>
                    </div>
                    {c.dqRisk && <Tag color="#A32D2D">DQ risk</Tag>}
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
                    <Tag color={SLATE}>{CASTING_FORMAT_LABELS[c.formatType]}</Tag>
                    <Tag color={dlColor}>{castingDeadlineLabel(c.deadline)}</Tag>
                    {c.flags.includes('apply-with-dan') && <Tag color={SLATE}>+ Dan</Tag>}
                    {c.flags.includes('annual') && <Tag color={SLATE}>Annual</Tag>}
                  </div>
                  <div style={{ fontSize:12, color:SLATE, marginTop:10, lineHeight:1.4 }}>{c.oneLineWhy}</div>
                  <div style={{ fontSize:10, color:'#94A3B8', marginTop:8, fontStyle:'italic' }}>{c.fitReasoning}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ fontSize:10, color:'#94A3B8', marginTop:18, paddingBottom:8 }}>
        Phase 1 — feed, fit score, filters. Auto-archived shows (cooking / dating / athletic / etc.) hidden by default.
      </div>

      {/* Detail modal */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position:'fixed', inset:0, background:'rgba(26,39,68,0.5)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'5vh 16px', overflowY:'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#FFFFFF', borderRadius:12, maxWidth:620, width:'100%', boxShadow:'0 20px 50px -10px rgba(26,39,68,0.3)' }}>
            <div style={{ padding:24, borderBottom:`1px solid ${BDR}`, display:'flex', alignItems:'flex-start', gap:14 }}>
              <div style={{ width:42, height:42, borderRadius:'50%', background:castingScoreColor(selected.fitScore).bg, color:castingScoreColor(selected.fitScore).color, border:`2px solid ${castingScoreColor(selected.fitScore).border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, flexShrink:0 }}>{selected.fitScore}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:18, fontWeight:700, color:TEXT, lineHeight:1.3 }}>{selected.showName}</div>
                <div style={{ fontSize:12, color:SLATE, marginTop:4 }}>{selected.network} · {selected.market}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background:'#F7F9FC', color:TEXT, border:`1px solid ${BDR}`, borderRadius:8, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Close</button>
            </div>
            <div style={{ padding:24 }}>
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:10, color:SLATE, textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:700, marginBottom:6 }}>Why this scored</div>
                <div style={{ fontSize:13, color:TEXT }}>{selected.fitReasoning}</div>
                <div style={{ fontSize:13, color:SLATE, marginTop:8 }}>{selected.oneLineWhy}</div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18 }}>
                {[
                  ['Format', CASTING_FORMAT_LABELS[selected.formatType]],
                  ['Deadline', castingDeadlineLabel(selected.deadline)],
                  ['Career upside', `${selected.scoreInputs.careerUpside ?? '—'}/10`],
                  ['Exposure value', `${selected.scoreInputs.exposureValue}/10`],
                  ['Network ecosystem', `${selected.scoreInputs.networkEcosystem ?? '—'}/10`],
                  ['Audience overlap', `${selected.scoreInputs.audienceOverlap}/10`],
                  ['Brand fit', `${selected.scoreInputs.brandFit}/10`],
                  ['Pay tier', selected.scoreInputs.payTier],
                  ['Eligibility', selected.scoreInputs.eligibility],
                  ['Time commitment', `${selected.scoreInputs.timeCommitmentDays} days`],
                  ['NDA length', `${selected.scoreInputs.ndaMonths} months`],
                ].map(([k,v]) => (
                  <div key={k}>
                    <div style={{ fontSize:9, color:SLATE, textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:600 }}>{k}</div>
                    <div style={{ fontSize:13, color:TEXT, marginTop:3 }}>{v}</div>
                  </div>
                ))}
              </div>
              {selected.dqRisk && (
                <div style={{ background:'#FBF1DC', border:'1px solid #ECD9AC', borderRadius:8, padding:12, marginBottom:18 }}>
                  <div style={{ fontSize:10, color:'#8A6A10', textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:700 }}>DQ risk</div>
                  <div style={{ fontSize:12, color:TEXT, marginTop:4 }}>{selected.dqRiskNotes}</div>
                </div>
              )}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, color:SLATE, textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:700, marginBottom:6 }}>Pipeline stage</div>
                <select value={selected.pipelineStatus} onChange={e => updatePipeline(selected.id, e.target.value)}
                  style={{ width:'100%', background:'#F8FAFC', border:`1px solid ${BDR}`, borderRadius:8, padding:'9px 12px', color:TEXT, fontSize:13, fontFamily:'inherit', outline:'none' }}>
                  {['researching','applied','first-tape','callback','producer-interview','booked','rejected','ghosted'].map(s => <option key={s} value={s}>{s.split('-').map(w => w[0].toUpperCase()+w.slice(1)).join(' ')}</option>)}
                </select>
              </div>
              {selected.applyLink && (
                <a href={selected.applyLink} target="_blank" rel="noreferrer" style={{ display:'inline-block', background:TEXT, color:'#FFFFFF', textDecoration:'none', borderRadius:8, padding:'9px 16px', fontSize:13, fontWeight:700 }}>Open apply link →</a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function App() {
  const width = useWindowWidth();
  const isMobile = width < 768;
  const pad = isMobile ? '16px' : '24px 28px';
  const gutter = isMobile ? 12 : 14;
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('pf_session'));

  if (!authed) return <LoginScreen onAuth={() => setAuthed(true)} />;

  // ── All state (must be declared before any effects that reference them) ──────
  const [deals,      setDeals]      = useState(() => load('pf_deals',      INIT_DEALS));
  const [crm,        setCrm]        = useState(INIT_CRM);
  const [delivs,     setDelivs]     = useState(() => load('pf_delivs',     INIT_DELIVS));
  const [milestones, setMilestones] = useState(() => load('pf_milestones', INIT_MILESTONES));
  const [revenue,    setRevenue]    = useState(() => load('pf_revenue',    INIT_REVENUE));
  const [igFollowers, setIgFollowers] = useState(() => load('pf_ig_followers', 12900));
  const [ttFollowers, setTtFollowers] = useState(() => load('pf_tt_followers', 50900));
  const [ytSubs,      setYtSubs]      = useState(() => load('pf_yt_subs',      1730));
  const [ytConnected, setYtConnected] = useState(false);
  const [igConnected, setIgConnected] = useState(false);
  const [ytAnalytics,        setYtAnalytics]        = useState(null);
  const [ytAnalyticsLoading, setYtAnalyticsLoading] = useState(false);
  const [ytAnalyticsError,   setYtAnalyticsError]   = useState(null);
  const [selectedYtVideo,    setSelectedYtVideo]    = useState(null);
  const [igAnalytics,        setIgAnalytics]        = useState(null);
  const [igAnalyticsLoading, setIgAnalyticsLoading] = useState(false);
  const [igAnalyticsError,   setIgAnalyticsError]   = useState(null);
  const [ttAnalytics,        setTtAnalytics]        = useState(null);
  const [ttAnalyticsLoading, setTtAnalyticsLoading] = useState(false);
  const [ttAnalyticsError,   setTtAnalyticsError]   = useState(null);
  const [ttConnected, setTtConnected] = useState(false);
  const [flash,       setFlash]       = useState(null);
  const [tab,          setTab]          = useState('overview');
  const [toast,        setToast]        = useState(null);
  const [dragId,       setDragId]       = useState(null);
  const [dragOver,     setDragOver]     = useState(null);
  const [commFilter,   setCommFilter]   = useState('all');
  const [mobileStage,  setMobileStage]  = useState('Pitching');
  const [dealModal,    setDealModal]    = useState(null);
  const [followerEdit, setFollowerEdit] = useState(null);
  const [editCrmId,       setEditCrmId]       = useState(null);
  const [crmBuf,          setCrmBuf]          = useState({});
  const [crmFilter,       setCrmFilter]       = useState({ search:'', status:'All', type:'All', country:'All', niche:'All' });
  const [pendingCrmBrand, setPendingCrmBrand] = useState(null); // { b, v, del } after deal save
  const [editDelivId,  setEditDelivId]  = useState(null);
  const [delivBuf,     setDelivBuf]     = useState({});
  const [editMsId,     setEditMsId]     = useState(null);
  const [editMsVal,    setEditMsVal]    = useState('');
  const [syncStatus,   setSyncStatus]   = useState('idle');

  // ── Feature 1: Analytics sort ──────────────────────────────
  const [ytSort, setYtSort] = useState('views'); // 'views' | 'engRate' | 'likes' | 'comments' | 'date'

  // ── Feature 2: Posting Cadence ─────────────────────────────
  const getWeekStart = () => {
    const d = new Date(); d.setHours(0,0,0,0);
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
    return d.toISOString().split('T')[0];
  };
  const [weeklyPosts, setWeeklyPosts] = useState(() => {
    const stored = load('pf_weekly_posts', { count: 0, weekStart: '' });
    if (stored.weekStart !== getWeekStart()) return { count: 0, weekStart: getWeekStart() };
    return stored;
  });

  // ── Feature 4: Content Intel ───────────────────────────────
  const [ciReddit, setCiReddit] = useState({ data: null, loading: false, error: null, fetchedAt: null });
  const [ciVideos, setCiVideos] = useState({ data: null, loading: false, error: null, fetchedAt: null });
  const [ciCreators, setCiCreators] = useState({ data: null, loading: false, error: null, fetchedAt: null });
  const [ciExpandedVideo, setCiExpandedVideo] = useState(null);
  const [ciFavorites, setCiFavorites] = useState(() => load('pf_ci_favorites', []));
  const [ciIdeas, setCiIdeas] = useState(() => load('pf_ci_ideas', { saved: [], prioritized: [], created: [] }));
  const [ciToast, setCiToast] = useState(null);

  const syncTimer       = useRef(null);
  const cloudReady      = useRef(false);
  const isApplyingCloud = useRef(false);

  // ── Cloud sync: load from cloud and apply state ──────────────
  const applyCloudState = (state, quiet = false) => {
    if (!state) return;
    // Block pushToCloud from firing while we apply cloud data — prevents feedback loop
    isApplyingCloud.current = true;
    if (state.deals)       { setDeals(state.deals);             localStorage.setItem('pf_deals',        JSON.stringify(state.deals)); }
    if (state.crm) {
      // INIT_CRM is always the permanent base. Cloud data overrides any edited entries
      // and appends any manually-added contacts that aren't in the base set.
      const cloudByName = new Map(state.crm.map(c => [(c.b || '').toLowerCase(), c]));
      const merged = [
        ...INIT_CRM.map(c => cloudByName.get((c.b || '').toLowerCase()) || c),
        ...state.crm.filter(c => !INIT_CRM.some(ic => (ic.b || '').toLowerCase() === (c.b || '').toLowerCase())),
      ];
      setCrm(merged);
      localStorage.setItem('pf_crm', JSON.stringify(merged));
    }
    if (state.delivs)      { setDelivs(state.delivs);           localStorage.setItem('pf_delivs',       JSON.stringify(state.delivs)); }
    if (state.milestones)  { setMilestones(state.milestones);   localStorage.setItem('pf_milestones',   JSON.stringify(state.milestones)); }
    if (state.revenue)     { setRevenue(state.revenue);         localStorage.setItem('pf_revenue',      JSON.stringify(state.revenue)); }
    if (state.igFollowers) { setIgFollowers(state.igFollowers); localStorage.setItem('pf_ig_followers', JSON.stringify(state.igFollowers)); }
    if (state.ttFollowers) { setTtFollowers(state.ttFollowers); localStorage.setItem('pf_tt_followers', JSON.stringify(state.ttFollowers)); }
    // Reset flag after effects have had time to run (~200ms is plenty)
    setTimeout(() => { isApplyingCloud.current = false; }, 200);
    if (!quiet) { setSyncStatus('saved'); setTimeout(() => setSyncStatus('idle'), 2000); }
  };

  // ── Cloud sync: load on mount + poll every 30s ────────────────
  useEffect(() => {
    const fetchCloud = (isMount = false) => {
      if (isMount) setSyncStatus('syncing');
      // ?t= cache-buster ensures browser never serves a cached GET response
      fetch(`/api/sync?t=${Date.now()}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(({ state }) => {
          applyCloudState(state, !isMount);
          if (isMount) { cloudReady.current = true; setSyncStatus('saved'); setTimeout(() => setSyncStatus('idle'), 2000); }
        })
        .catch(() => { if (isMount) { cloudReady.current = true; setSyncStatus('error'); } });
    };
    fetchCloud(true);
    const poll = setInterval(() => { if (!syncTimer.current) fetchCloud(false); }, 15000);
    return () => clearInterval(poll);
  }, []);

  // ── Cloud sync: push on every change (debounced 1.5s) ────────
  const pushToCloud = (patch) => {
    if (!cloudReady.current || isApplyingCloud.current) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncTimer.current = null; // clear so poll can run again
      setSyncStatus('syncing');
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
        .then(() => { setSyncStatus('saved'); setTimeout(() => setSyncStatus('idle'), 2000); })
        .catch(() => setSyncStatus('error'));
    }, 1500);
  };

  useEffect(() => { localStorage.setItem('pf_deals',        JSON.stringify(deals));       pushToCloud({ deals, crm, delivs, milestones, revenue, igFollowers, ttFollowers }); }, [deals]);
  useEffect(() => { localStorage.setItem('pf_crm',          JSON.stringify(crm));         pushToCloud({ deals, crm, delivs, milestones, revenue, igFollowers, ttFollowers }); }, [crm]);
  useEffect(() => { localStorage.setItem('pf_delivs',       JSON.stringify(delivs));      pushToCloud({ deals, crm, delivs, milestones, revenue, igFollowers, ttFollowers }); }, [delivs]);
  useEffect(() => { localStorage.setItem('pf_milestones',   JSON.stringify(milestones));  pushToCloud({ deals, crm, delivs, milestones, revenue, igFollowers, ttFollowers }); }, [milestones]);
  useEffect(() => { localStorage.setItem('pf_revenue',      JSON.stringify(revenue));     pushToCloud({ deals, crm, delivs, milestones, revenue, igFollowers, ttFollowers }); }, [revenue]);
  useEffect(() => { localStorage.setItem('pf_ig_followers', JSON.stringify(igFollowers)); pushToCloud({ deals, crm, delivs, milestones, revenue, igFollowers, ttFollowers }); }, [igFollowers]);
  useEffect(() => { localStorage.setItem('pf_tt_followers', JSON.stringify(ttFollowers)); pushToCloud({ deals, crm, delivs, milestones, revenue, igFollowers, ttFollowers }); }, [ttFollowers]);
  useEffect(() => { localStorage.setItem('pf_weekly_posts', JSON.stringify(weeklyPosts)); }, [weeklyPosts]);
  useEffect(() => { localStorage.setItem('pf_ci_favorites', JSON.stringify(ciFavorites)); }, [ciFavorites]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  // ── Feature helpers ───────────────────────────────────────────
  const logPost = () => setWeeklyPosts(p => ({ ...p, count: p.count + 1 }));

  const fetchCI = async (section) => {
    const setters = { reddit: setCiReddit, videos: setCiVideos, creators: setCiCreators };
    const endpoints = { reddit: '/api/reddit-pulse', videos: '/api/trending-videos', creators: '/api/creator-watch' };
    const setter = setters[section];
    setter(p => ({ ...p, loading: true, error: null }));
    try {
      // Fresh seed every call — backend uses it to rotate sources/windows/prompts.
      // The &t= is a hard cache-buster so any intermediate cache is bypassed.
      const seed = Date.now();
      const r = await fetch(`${endpoints[section]}?seed=${seed}&t=${seed}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      // Defensive: drop any null/non-object entries before storing — previously crashed Content Intel
      const rawResults = Array.isArray(d.results) ? d.results : [];
      const results = rawResults.filter(x => x && typeof x === 'object');
      if (results.length === 0) {
        setter({ data: [], loading: false, error: 'No fresh content returned — try again in a moment.', fetchedAt: d.fetchedAt || new Date().toISOString() });
        return;
      }
      setter({ data: results, loading: false, error: null, fetchedAt: d.fetchedAt });
    } catch (e) {
      setter(p => ({ ...p, loading: false, error: e.message }));
    }
  };

  const toggleFavorite = (creator) => {
    setCiFavorites(prev => {
      const exists = prev.find(f => f.handle === creator.handle);
      if (exists) return prev.filter(f => f.handle !== creator.handle);
      return [...prev, creator];
    });
  };

  const saveIdeaToast = (msg) => {
    setCiToast(msg);
    setTimeout(() => setCiToast(null), 2500);
  };

  const saveIdea = (idea) => {
    setCiIdeas(prev => {
      const updated = { ...prev, saved: [{ ...idea, id: Date.now(), savedAt: new Date().toISOString() }, ...prev.saved] };
      save('pf_ci_ideas', updated);
      return updated;
    });
    saveIdeaToast('💡 Saved to ideas!');
  };

  const moveIdea = (id, from, to) => {
    setCiIdeas(prev => {
      const item = prev[from].find(i => i.id === id);
      if (!item) return prev;
      const updated = {
        ...prev,
        [from]: prev[from].filter(i => i.id !== id),
        [to]: to === 'created'
          ? [{ ...item, createdAt: new Date().toISOString() }, ...prev[to]]
          : [item, ...prev[to]],
      };
      save('pf_ci_ideas', updated);
      return updated;
    });
  };

  const deleteIdea = (id, from) => {
    setCiIdeas(prev => {
      const updated = { ...prev, [from]: prev[from].filter(i => i.id !== id) };
      save('pf_ci_ideas', updated);
      return updated;
    });
  };

  const getPillarTag = (text) => {
    const t = (text || '').toLowerCase();
    if (/pet|dog|cat|animal/.test(t)) return ['Pet', '#F5C6CB', '#8B3A3A'];
    if (/how|tip|hack|guide|budget|cost|save|pack|book|flight|visa|cheap/.test(t)) return ['Educational', '#EEF9FD', '#0E6A80'];
    if (/my life|i did|i went|i spent|i moved|i quit|story|happened|honest/.test(t)) return ['Storytime', '#E1D9AE', '#6B5E2A'];
    return ['Relatable', '#E8F0E8', '#2A6B2A'];
  };

  // ── Handlers ──────────────────────────────────────────────────
  const handleDrop = targetStatus => {
    if (dragId == null) return;
    setDeals(prev => prev.map(d => d.id === dragId ? { ...d, s: targetStatus } : d));
    setDragId(null); setDragOver(null);
    showToast(`Moved to ${targetStatus}`);
  };
  const saveDeal = form => {
    if (!form.b?.trim()) return;
    const isNew = !form.id;
    if (isNew) { setDeals(prev => [...prev, { ...form, id: Date.now() }]); }
    else { setDeals(prev => prev.map(d => d.id === form.id ? form : d)); }
    if (form.remindDate && form.nextStep) {
      const today = new Date().toISOString().slice(0,10);
      if (form.remindDate >= today) {
        fetch('/api/remind', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ brand:form.b, nextStep:form.nextStep, remindDate:form.remindDate, dealValue:form.v }) }).catch(()=>{});
        showToast(`✓ Saved + reminder set for ${form.remindDate}`);
      } else { showToast(isNew ? 'Deal added!' : 'Deal updated!'); }
    } else { showToast(isNew ? 'Deal added!' : 'Deal updated!'); }
    // After saving a NEW deal, check if brand is already in CRM
    if (isNew) {
      const brand = form.b.toLowerCase().trim();
      const inCrm = crm.some(c => c.b.toLowerCase().trim() === brand);
      if (!inCrm) setTimeout(() => setPendingCrmBrand({ b: form.b, v: form.v || 0, del: form.del || '' }), 400);
    }
    setDealModal(null);
  };
  const deleteDeal = id => { setDeals(prev => prev.filter(d => d.id !== id)); setDealModal(null); showToast('Deal removed'); };

  const startEditCrm = c => { setEditCrmId(c.id); setCrmBuf({ ...c }); };
  const saveCrm = () => { setCrm(prev => prev.map(c => c.id === editCrmId ? { ...crmBuf } : c)); setEditCrmId(null); showToast('CRM updated!'); };
  const addCrm = (prefill = {}) => {
    const id = Date.now();
    const today = new Date().toISOString().slice(0,10);
    const entry = { id, b: prefill.b||'New Brand', n:'—', e:'', s:'Warm Lead', type:'Brand Direct', country:'United States', brands: prefill.b||'', niche:[], paidDeal: prefill.paidDeal||false, dealValue: prefill.dealValue||0, lastDate: today, last: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}), note: prefill.note||'' };
    setCrm(prev => [...prev, entry]); setEditCrmId(id); setCrmBuf({ ...entry });
  };
  const deleteCrm = id => { setCrm(prev => prev.filter(c => c.id !== id)); setEditCrmId(null); showToast('Removed'); };

  const startEditDeliv = d => { setEditDelivId(d.id); setDelivBuf({ ...d }); };
  const saveDeliv = () => { setDelivs(prev => prev.map(d => d.id === editDelivId ? { ...delivBuf } : d)); setEditDelivId(null); showToast('Updated!'); };
  const addDeliv = () => {
    const id = Date.now();
    const entry = { id, b:'New Brand', sc:'Add notes', d:'TBC', s:'Pitching', pl:'TikTok', pay:'$0' };
    setDelivs(prev => [...prev, entry]); setEditDelivId(id); setDelivBuf({ ...entry });
  };
  const deleteDeliv = id => { setDelivs(prev => prev.filter(d => d.id !== id)); setEditDelivId(null); showToast('Removed'); };

  const startEditMs = m => { setEditMsId(m.id); setEditMsVal(m.cur || ''); };
  const saveMs = () => {
    setMilestones(prev => prev.map(m => {
      if (m.id !== editMsId) return m;
      const curNum = parseFloat(editMsVal.replace(/[^0-9.]/g, '')) || 0;
      const goalNum = parseFloat((m.goal || '').replace(/[^0-9.]/g, '')) || 1;
      return { ...m, cur: editMsVal, pct: Math.min(100, Math.round((curNum / goalNum) * 100)) };
    }));
    setEditMsId(null); showToast('Milestone updated!');
  };

  // ── YouTube API ───────────────────────────────────────────────
  useEffect(() => {
    const { YT_API_KEY, YT_CHANNEL_ID } = CONFIG;
    if (YT_API_KEY === 'YOUR_YOUTUBE_API_KEY') return;
    const fetchYT = () =>
      fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${YT_CHANNEL_ID}&key=${YT_API_KEY}`)
        .then(r => r.json())
        .then(d => { const n = parseInt(d?.items?.[0]?.statistics?.subscriberCount); if (!isNaN(n)) { setYtSubs(n); setYtConnected(true); } })
        .catch(() => {});
    fetchYT();
    const id = setInterval(fetchYT, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // ── Instagram analytics on startup (powers Overview + auto post count) ──
  useEffect(() => {
    fetch(`/api/instagram-stats?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setIgAnalytics(d);
          setIgConnected(true);
          if (d.profile?.followersCount) setIgFollowers(d.profile.followersCount);
        }
      })
      .catch(() => {});
  }, []);

  // ── TikTok analytics on startup (powers Overview + auto post count) ──
  useEffect(() => {
    fetch(`/api/tiktok-stats?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setTtAnalytics(d);
          setTtConnected(true);
          if (d.profile?.followerCount) setTtFollowers(d.profile.followerCount);
        }
      })
      .catch(() => {});
  }, []);

  // ── Auto-count posts published this week (Mon–Sun) across IG + TikTok + YouTube ──
  // Cross-posts (same video posted to multiple platforms on the same day) count as ONE post.
  // Dedupe by calendar day — matches Paul's workflow of posting the same video across platforms.
  const weeklyAutoCount = (() => {
    const weekStartMs = new Date(getWeekStart()).getTime();
    const days = new Set();
    const addIfThisWeek = (raw) => {
      if (!raw) return;
      const ms = new Date(raw).getTime();
      if (!ms || ms < weekStartMs) return;
      // Bucket by local calendar day so cross-posted videos on the same day collapse to 1
      const d = new Date(ms);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      days.add(key);
    };
    (igAnalytics?.posts  || []).forEach(p => addIfThisWeek(p.timestamp));
    (ttAnalytics?.videos || []).forEach(v => addIfThisWeek(v.createdAt));
    (ytAnalytics?.videos || []).forEach(v => addIfThisWeek(v.publishedAt));
    return days.size;
  })();

  // ── YouTube Analytics (fetched when Analytics tab is opened) ──
  const loadIgAnalytics = (force = false) => {
    setIgAnalyticsLoading(true); setIgAnalyticsError(null);
    fetch(`/api/instagram-stats?t=${Date.now()}${force ? '&force=true' : ''}`, { cache:'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setIgAnalytics(d);
          setIgConnected(true);
          if (d.profile?.followersCount) setIgFollowers(d.profile.followersCount);
          // If reach is still 0 (old cached data), auto force-refresh once to use updated metrics
          if (d.aggregates?.avgReach === 0 && !force) {
            setTimeout(() => loadIgAnalytics(true), 800);
          }
        } else setIgAnalyticsError(d.error || 'Failed');
      })
      .catch(() => setIgAnalyticsError('Network error'))
      .finally(() => setIgAnalyticsLoading(false));
  };
  const loadTtAnalytics = (force = false) => {
    setTtAnalyticsLoading(true); setTtAnalyticsError(null);
    fetch(`/api/tiktok-stats?t=${Date.now()}${force ? '&force=true' : ''}`, { cache:'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setTtAnalytics(d);
          setTtConnected(true);
          if (d.profile?.followerCount) setTtFollowers(d.profile.followerCount);
        } else if (!d.notConnected) {
          setTtAnalyticsError(d.error || 'Failed');
        }
      })
      .catch(() => setTtAnalyticsError('Network error'))
      .finally(() => setTtAnalyticsLoading(false));
  };
  const loadYtAnalytics = (force = false) => {
    setYtAnalyticsLoading(true);
    setYtAnalyticsError(null);
    fetch(`/api/youtube-stats?t=${Date.now()}${force ? '&force=true' : ''}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (data.ok) { setYtAnalytics(data); }
        else { setYtAnalyticsError(data.error || 'Failed to load analytics'); }
      })
      .catch(() => setYtAnalyticsError('Network error — check connection'))
      .finally(() => setYtAnalyticsLoading(false));
  };
  useEffect(() => {
    if (tab !== 'analytics') return;
    if (!ytAnalytics && !ytAnalyticsLoading) loadYtAnalytics();
    if (!igAnalytics && !igAnalyticsLoading) loadIgAnalytics();
    if (!ttAnalytics && !ttAnalyticsLoading) loadTtAnalytics();
  }, [tab]);

  // ── Content Intel auto-fetch on tab change ────────────────────
  useEffect(() => {
    if (tab === 'content-intel') {
      if (!ciReddit.data && !ciReddit.loading) fetchCI('reddit');
      if (!ciVideos.data && !ciVideos.loading) fetchCI('videos');
      if (!ciCreators.data && !ciCreators.loading) fetchCI('creators');
    }
  }, [tab]);

  // ── Live pulse ────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.random();
      if (r < 0.38 && !igConnected)      { setFlash('ig'); setTimeout(() => setFlash(null), 700); }
      else if (r < 0.76 && !ttConnected) { setFlash('tt'); setTimeout(() => setFlash(null), 700); }
      else if (!ytConnected)             { setFlash('yt'); setTimeout(() => setFlash(null), 700); }
    }, 4000);
    return () => clearInterval(id);
  }, [igConnected, ttConnected, ytConnected]);

  // ── Derived ───────────────────────────────────────────────────
  const paidDeals     = deals.filter(d => d.s === 'Paid');
  const totalRevenue  = paidDeals.reduce((s, d) => s + (d.v || 0), 0);
  const pipelineValue = deals.filter(d => ['Pitching','Awaiting Approval'].includes(d.s)).reduce((s, d) => s + (d.v || 0), 0);
  const filteredComments = commFilter === 'positive' ? COMMENTS.filter(c => c.pos) : commFilter === 'questions' ? COMMENTS.filter(c => !c.pos) : COMMENTS;

// BOOKS TAB — AI-Powered Expense Tracker
// Paste this entire block above the main dashboard component's `return ()` in
// paul_ferrante_dashboard.jsx (e.g., somewhere between line 2500 and 2530, just
// before `const TABS = ...`). All names are scoped to functions, no globals.
//
// Dependencies expected in scope: React (useState, useEffect, useRef), the existing
// color constants BG, CARD, BDR, BLUE, YELL, OCEAN, SLATE, TEXT, and `usd()`.
// ═══════════════════════════════════════════════════════════════════════════

// ── Books palette aliases (the spec's tokens mapped onto existing constants) ─
// "Ink"          → TEXT  ('#1A2744')
// "Parchment"    → BG    ('#FFFFFF')   plus CARD ('#F7F9FC') for surfaces
// "Bright Sky"   → BLUE  ('#88EAF6')   accent (use sparingly)
// "Deep Ocean"   → SLATE ('#2E4A66')   secondary accent / accent on Sand
// "Slate"        → '#94A3B8' for muted (the existing dashboard uses this directly)
// "Sand"         → YELL  ('#E1D9AE')   warm surface
const BOOKS = {
  ink: TEXT, parchment: BG, surface: CARD, border: BDR,
  brightSky: BLUE, deepOcean: SLATE, sand: YELL, muted: '#94A3B8',
};

const BOOKS_API = '/api/sync';

const FLAG_META = {
  extraction_failed:        { color: '#DC2626', label: 'Extraction failed', tip: 'AI could not read this receipt. Manual entry required.' },
  low_confidence_extraction:{ color: '#D97706', label: 'Low confidence',    tip: 'AI flagged this extraction as uncertain — verify the fields.' },
  auto_link_pending:        { color: '#2563EB', label: 'Auto-link pending', tip: 'A deal was auto-suggested. Confirm or change before reviewing.' },
  missing_purpose:          { color: '#64748B', label: 'No purpose',        tip: 'Add a business purpose (under 10 chars treated as missing).' },
  unlinked_high_value:      { color: '#7C3AED', label: 'Unlinked >$200',    tip: 'Travel category, over $200, no deal link, unreviewed.' },
  category_other:           { color: '#475569', label: 'Category: Other',   tip: 'AI fell back to "Other". Pick a more specific category.' },
  vendor_unknown:           { color: '#0891B2', label: 'New vendor',        tip: 'First time seeing this vendor. Confirm category to teach the system.' },
  over_30_days_unreviewed:  { color: '#B45309', label: '>30 days unreviewed', tip: 'Sitting in queue more than 30 days.' },
};

const CATEGORIES = [
  'Equipment & Hardware','Software & Subscriptions','Travel - Lodging','Travel - Transportation',
  'Travel - Meals','Meals & Entertainment','Home Office','Professional Services',
  'Marketing & Advertising','Internet & Phone','Production Costs','Education & Research',
  'Bank & Payment Fees','Office Supplies','Other',
];

const DEAL_STATUSES = ['Pitching','In Discussions','Sold In','Paid'];

// ── Helpers ──────────────────────────────────────────────────────────────────
function booksApi(action, opts = {}) {
  const { method = 'GET', body, query = {} } = opts;
  const params = new URLSearchParams({ action, ...query }).toString();
  return fetch(`${BOOKS_API}?${params}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => {
    const text = await r.text();
    let json = {};
    try { json = JSON.parse(text); } catch (_) {}
    if (!r.ok) throw new Error(json.error || text || `HTTP ${r.status}`);
    return json;
  });
}

function fmtDate(d) { return d ? String(d) : '—'; }
function fmtMoney(n, ccy = 'USD') {
  if (n === '' || n == null || isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy || 'USD' }).format(Number(n));
}
function withinYear(row, year) { return String(row.date || '').startsWith(String(year)); }

// sessionStorage helpers — let the current sub-tab and any draft edits survive
// any parent remount (the Books-tab component used to lose your in-progress
// typing if anything in the dashboard caused a refresh).
function _ssGet(key, fallback) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return fallback;
    var v = window.sessionStorage.getItem(key);
    if (v == null) return fallback;
    try { return JSON.parse(v); } catch (_) { return v; }
  } catch (_) { return fallback; }
}
function _ssSet(key, value) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch (_) { /* quota or privacy mode — silently ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// BooksTab — top-level component
// ─────────────────────────────────────────────────────────────────────────────
function BooksTab({ isMobile, showToast }) {
  const [year, setYearRaw] = useState(function () { return Number(_ssGet('books_year', new Date().getFullYear())) || new Date().getFullYear(); });
  const [sub, setSubRaw]   = useState(function () { return _ssGet('books_sub', 'inbox'); });
  const [data, setData]    = useState({ expenses: [], deals: [], vendorMemory: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Persist year + sub on every change so a remount restores the user's place.
  function setYear(v) { _ssSet('books_year', v); setYearRaw(v); }
  function setSub(v)  { _ssSet('books_sub',  v); setSubRaw(v);  }

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await booksApi('books-data', { query: { year } });
      setData({ expenses: j.expenses || [], deals: j.deals || [], vendorMemory: j.vendorMemory || [] });
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-line */ }, [year]);

  // KPIs
  const totalExpenses = data.expenses.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalRevenue  = data.deals.filter((d) => d.status === 'Paid').reduce((s, d) => s + Number(d.deal_value || 0), 0);
  const flaggedCount  = data.expenses.filter((r) => (r.flags_computed || []).length > 0).length;

  const SUB_TABS = [
    ['inbox',       'Inbox'],
    ['expenses',    'Expenses'],
    ['deals',       'Deals'],
    ['audit',       'Audit View'],
    ['export',      'Year-End Export'],
  ];

  const yearOptions = [];
  for (let y = new Date().getFullYear(); y >= 2024; y--) yearOptions.push(y);

  return (
    <div>
      {/* ── Header strip ──────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:18 }}>
        <div>
          <div style={{ fontSize: isMobile?20:24, fontWeight:800, color:BOOKS.ink, letterSpacing:'-0.5px' }}>Books</div>
          <div style={{ fontSize:11, color:BOOKS.muted, letterSpacing:'2px', textTransform:'uppercase', marginTop:2 }}>RGG Media · {year}</div>
        </div>
        <select
          value={year} onChange={(e) => setYear(Number(e.target.value))}
          style={{ background:BOOKS.parchment, border:`1px solid ${BOOKS.border}`, borderRadius:8, padding:'8px 12px', fontSize:13, fontFamily:'inherit', color:BOOKS.ink, cursor:'pointer' }}
        >
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* ── KPI strip ────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile?'repeat(2,1fr)':'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        <KpiCard label="Expenses YTD" value={fmtMoney(totalExpenses)} tone="ink" />
        <KpiCard label="Revenue YTD"  value={fmtMoney(totalRevenue)}  tone="deepOcean" />
        <KpiCard label="Net"          value={fmtMoney(totalRevenue - totalExpenses)} tone={totalRevenue >= totalExpenses ? 'green' : 'red'} />
        <KpiCard
          label="Needs review"
          value={String(flaggedCount)}
          tone="brightSky"
          onClick={() => setSub('inbox')}
          clickable={flaggedCount > 0}
        />
      </div>

      {/* ── Sub-nav ──────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${BOOKS.border}`, marginBottom:16, overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
        {SUB_TABS.map(([id, lbl]) => (
          <button
            key={id} onClick={() => setSub(id)}
            style={{
              background:'none', border:'none', cursor:'pointer', fontFamily:'inherit',
              padding:'10px 16px', fontSize:13, fontWeight: sub === id ? 700 : 500,
              color: sub === id ? BOOKS.ink : BOOKS.muted,
              borderBottom: sub === id ? `2px solid ${BOOKS.ink}` : '2px solid transparent',
              marginBottom:'-1px', whiteSpace:'nowrap', flexShrink:0,
            }}
          >{lbl}</button>
        ))}
      </div>

      {/* ── Sub-tab body ─────────────────────────────────────────── */}
      {error && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', color:'#991B1B', padding:'10px 14px', borderRadius:8, marginBottom:16, fontSize:12 }}>Error: {error}</div>}
      {loading && <div style={{ color:BOOKS.muted, fontSize:13, padding:'20px 0' }}>Loading {year} books…</div>}
      {!loading && !error && (
        <>
          {sub === 'inbox'    && <InboxTab    data={data} year={year} reload={reload} isMobile={isMobile} showToast={showToast} />}
          {sub === 'expenses' && <ExpensesTab data={data} year={year} reload={reload} isMobile={isMobile} showToast={showToast} />}
          {sub === 'deals'    && <DealsTab    data={data} year={year} reload={reload} isMobile={isMobile} showToast={showToast} />}
          {sub === 'audit'    && <AuditTab    data={data} year={year} isMobile={isMobile} />}
          {sub === 'export'   && <ExportTab   data={data} year={year} />}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────────────────────
function KpiCard({ label, value, tone, onClick, clickable }) {
  const toneColor = {
    ink: TEXT, deepOcean: SLATE, brightSky: BLUE, green: '#16A34A', red: '#DC2626',
  }[tone] || TEXT;
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        background: BOOKS.surface, border: `1px solid ${BOOKS.border}`, borderRadius:12,
        padding:'14px 16px', cursor: clickable ? 'pointer' : 'default',
        transition:'all 0.12s', minHeight:74,
      }}
      onMouseEnter={(e) => { if (clickable) e.currentTarget.style.borderColor = BOOKS.ink; }}
      onMouseLeave={(e) => { if (clickable) e.currentTarget.style.borderColor = BOOKS.border; }}
    >
      <div style={{ fontSize:10, color:BOOKS.muted, textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:700, marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:800, color:toneColor, letterSpacing:'-0.5px' }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FlagDots — small color dots for active flags
// ─────────────────────────────────────────────────────────────────────────────
function FlagDots({ flags }) {
  if (!flags || flags.length === 0) return null;
  return (
    <div style={{ display:'inline-flex', gap:4, alignItems:'center' }}>
      {flags.map((f) => {
        const meta = FLAG_META[f] || { color:'#6B7280', label:f, tip:f };
        return (
          <div key={f} title={`${meta.label}: ${meta.tip}`}
            style={{ width:8, height:8, borderRadius:'50%', background:meta.color, cursor:'help' }} />
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InboxTab — Paul's daily review surface
// ─────────────────────────────────────────────────────────────────────────────
const FLAG_PRIORITY = ['extraction_failed','low_confidence_extraction','auto_link_pending','missing_purpose','unlinked_high_value','category_other','vendor_unknown','over_30_days_unreviewed'];
function priorityScore(flags) {
  if (!flags || flags.length === 0) return 99;
  let best = 99;
  flags.forEach((f) => {
    const idx = FLAG_PRIORITY.indexOf(f);
    if (idx >= 0 && idx < best) best = idx;
  });
  return best;
}

function InboxTab({ data, reload, isMobile, showToast }) {
  // Show ALL unreviewed rows so every AI extraction lands in your approval queue.
  // Sorted by flag priority — flagged items bubble to top, clean ones below.
  const queue = data.expenses
    .filter((r) => String(r.reviewed).toLowerCase() !== 'true')
    .sort((a, b) => priorityScore(a.flags_computed) - priorityScore(b.flags_computed));

  const bulkConfirmHighConfidence = async () => {
    const targets = queue.filter((r) => r.extraction_confidence === 'high'
      && (r.flags_computed || []).every((f) => f === 'auto_link_pending' || f === 'vendor_unknown'));
    if (targets.length === 0) return;
    if (!confirm(`Confirm ${targets.length} high-confidence extractions and mark reviewed?`)) return;
    for (const r of targets) {
      try {
        await booksApi('update-expense', {
          method: 'POST',
          body: { expense_id: r.expense_id, patch: { reviewed: 'TRUE' }, confirm_vendor_category: true },
        });
      } catch (e) { /* keep going */ }
    }
    showToast && showToast(`Confirmed ${targets.length}`);
    reload();
  };

  if (queue.length === 0) {
    return (
      <div style={{ background:BOOKS.surface, border:`1px solid ${BOOKS.border}`, borderRadius:12, padding:'40px 24px', textAlign:'center' }}>
        <div style={{ fontSize:14, color:BOOKS.muted }}>Inbox is clear. Nothing needs review.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
        <div style={{ fontSize:13, color:BOOKS.muted }}>
          {queue.length} item{queue.length === 1 ? '' : 's'} need{queue.length === 1 ? 's' : ''} review · sorted by priority
        </div>
        <button onClick={bulkConfirmHighConfidence}
          style={{ background:BOOKS.ink, color:'#FFFFFF', border:'none', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          Confirm all high-confidence in view
        </button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {queue.map((row) => (
          <InboxCard key={row.expense_id} row={row} deals={data.deals} reload={reload} isMobile={isMobile} showToast={showToast} />
        ))}
      </div>
    </div>
  );
}

function InboxCard({ row, deals, reload, isMobile, showToast }) {
  // Edit drafts persist in sessionStorage so any parent remount/refresh
  // doesn't wipe in-progress typing.
  const _draftKey = 'books_draft_' + row.expense_id;
  const [edit, setEditRaw] = useState(function () {
    const saved = _ssGet(_draftKey, null);
    if (saved && typeof saved === 'object') return saved;
    return {
      vendor: row.vendor || '', date: row.date || '', amount: row.amount || '',
      category: row.category || 'Other', business_purpose: row.business_purpose || '',
      linked_deal_id: row.linked_deal_id || '',
    };
  });
  // Wrap setEdit so every keystroke is persisted to sessionStorage
  function setEdit(next) {
    const value = (typeof next === 'function') ? next(edit) : next;
    _ssSet(_draftKey, value);
    setEditRaw(value);
  }
  const [saving, setSaving] = useState(false);
  const flags = row.flags_computed || [];

  const confirm = async () => {
    setSaving(true);
    try {
      await booksApi('update-expense', {
        method: 'POST',
        body: {
          expense_id: row.expense_id,
          patch: { ...edit, reviewed: 'TRUE' },
          confirm_vendor_category: true,
        },
      });
      // Clear the saved draft once it's been committed to the Sheet
      try { if (typeof window !== 'undefined' && window.sessionStorage) window.sessionStorage.removeItem(_draftKey); } catch (_) {}
      showToast && showToast('Confirmed');
      reload();
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
    setSaving(false);
  };

  const dealOptions = deals
    .slice()
    .sort((a, b) => Number(b.deal_value || 0) - Number(a.deal_value || 0))
    .map((d) => ({ id: d.deal_id, label: `${d.brand} (${d.status})` }));

  const inputStyle = {
    background:BOOKS.parchment, border:`1px solid ${BOOKS.border}`, borderRadius:6,
    padding:'6px 10px', fontSize:12, fontFamily:'inherit', color:BOOKS.ink, width:'100%',
  };

  return (
    <div style={{
      background:BOOKS.parchment, border:`1px solid ${BOOKS.border}`, borderRadius:12,
      padding:14, display:'grid',
      gridTemplateColumns: isMobile ? '1fr' : '110px 1fr',
      gap:14,
    }}>
      {/* Left: thumbnail / receipt link */}
      <div style={{ alignSelf:'start' }}>
        {row.receipt_url ? (
          <a href={row.receipt_url} target="_blank" rel="noreferrer"
             style={{ display:'block', height: isMobile?80:110, background:BOOKS.surface, border:`1px solid ${BOOKS.border}`, borderRadius:8, color:BOOKS.muted, fontSize:11, textAlign:'center', lineHeight: (isMobile?80:110) + 'px', textDecoration:'none' }}>
            View receipt ↗
          </a>
        ) : (
          <div style={{ height: isMobile?80:110, background:BOOKS.surface, border:`1px dashed ${BOOKS.border}`, borderRadius:8, color:BOOKS.muted, fontSize:11, textAlign:'center', lineHeight: (isMobile?80:110) + 'px' }}>
            No receipt
          </div>
        )}
      </div>

      {/* Right: editable fields */}
      <div style={{ minWidth:0 }}>
        {/* Header line: confidence + flags */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
          <ConfidenceBadge level={row.extraction_confidence} />
          <FlagDots flags={flags} />
          {row.confidence_notes && (
            <div style={{ fontSize:11, color:BOOKS.muted, fontStyle:'italic' }}>{row.confidence_notes}</div>
          )}
        </div>

        {/* Field grid */}
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap:10, marginBottom:10 }}>
          <Field label="Vendor"><input style={inputStyle} value={edit.vendor} onChange={(e) => setEdit({ ...edit, vendor: e.target.value })} /></Field>
          <Field label="Date"><input type="date" style={inputStyle} value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></Field>
          <Field label="Amount"><input type="number" step="0.01" style={inputStyle} value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></Field>
          <Field label="Category">
            <select style={inputStyle} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        {row.category_reasoning && (
          <div style={{ fontSize:11, color:BOOKS.muted, marginBottom:8, fontStyle:'italic' }}>
            AI reasoning: {row.category_reasoning}
          </div>
        )}

        {/* Deal link suggestion */}
        {(row.auto_linked_deal_id || dealOptions.length > 0) && (
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, color:BOOKS.muted, textTransform:'uppercase', letterSpacing:'1.2px', fontWeight:600, marginBottom:4 }}>
              Linked deal {row.auto_linked_deal_id && '· auto-suggested'}
            </div>
            <select style={inputStyle} value={edit.linked_deal_id} onChange={(e) => setEdit({ ...edit, linked_deal_id: e.target.value })}>
              <option value="">— No link —</option>
              {dealOptions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
        )}

        <Field label="Business purpose (required for audit)">
          <input style={inputStyle} placeholder="e.g. Travel for sponsored Airbnb shoot — Tokyo Hotels deal"
            value={edit.business_purpose} onChange={(e) => setEdit({ ...edit, business_purpose: e.target.value })} />
        </Field>

        <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
          <button onClick={confirm} disabled={saving}
            style={{ background:BOOKS.ink, color:'#FFFFFF', border:'none', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, cursor: saving?'wait':'pointer', fontFamily:'inherit', opacity: saving?0.6:1 }}>
            {saving ? 'Saving…' : '✓ Confirm & mark reviewed'}
          </button>
          <div style={{ flex:1 }} />
          <div style={{ alignSelf:'center', fontSize:10, color:BOOKS.muted, fontFamily:'monospace' }}>
            {row.expense_id?.slice(0, 8)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display:'block' }}>
      <div style={{ fontSize:10, color:BOOKS.muted, textTransform:'uppercase', letterSpacing:'1.2px', fontWeight:600, marginBottom:4 }}>{label}</div>
      {children}
    </label>
  );
}

function ConfidenceBadge({ level }) {
  const map = {
    high:    { bg:'#DCFCE7', fg:'#15803D', label:'HIGH CONFIDENCE' },
    medium:  { bg:'#FEF3C7', fg:'#B45309', label:'MEDIUM CONFIDENCE' },
    low:     { bg:'#FEE2E2', fg:'#991B1B', label:'LOW CONFIDENCE' },
    __failed__: { bg:'#FEE2E2', fg:'#991B1B', label:'EXTRACTION FAILED' },
  };
  const m = map[level] || map.medium;
  return (
    <span style={{ background:m.bg, color:m.fg, fontSize:9, fontWeight:800, letterSpacing:'1px', padding:'3px 8px', borderRadius:6 }}>
      {m.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExpensesTab — full table view
// ─────────────────────────────────────────────────────────────────────────────
function ExpensesTab({ data, reload, isMobile, showToast }) {
  const [filterCat, setFilterCat]         = useState('');
  const [filterFlagged, setFilterFlagged] = useState(false);
  const [filterUnrev, setFilterUnrev]     = useState(false);
  const [filterEntered, setFilterEntered] = useState('');
  const [search, setSearch]               = useState('');
  const [selected, setSelected]           = useState(null);
  const [showManual, setShowManual]       = useState(false);

  const filtered = data.expenses.filter((r) => {
    if (filterCat && r.category !== filterCat) return false;
    if (filterFlagged && (r.flags_computed || []).length === 0) return false;
    if (filterUnrev && String(r.reviewed).toLowerCase() === 'true') return false;
    if (filterEntered && r.entered_by !== filterEntered) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!String(r.vendor || '').toLowerCase().includes(s)
        && !String(r.business_purpose || '').toLowerCase().includes(s)) return false;
    }
    return true;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const filterStyle = { background:BOOKS.parchment, border:`1px solid ${BOOKS.border}`, borderRadius:6, padding:'6px 10px', fontSize:12, fontFamily:'inherit', color:BOOKS.ink };

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        <input placeholder="Search vendor or purpose…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...filterStyle, minWidth:200 }} />
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={filterStyle}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterEntered} onChange={(e) => setFilterEntered(e.target.value)} style={filterStyle}>
          <option value="">All sources</option>
          <option value="ai">AI extracted</option>
          <option value="paul">Paul (manual)</option>
          <option value="husband">Husband (manual)</option>
        </select>
        <label style={{ fontSize:12, color:BOOKS.muted, display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
          <input type="checkbox" checked={filterFlagged} onChange={(e) => setFilterFlagged(e.target.checked)} /> Flagged only
        </label>
        <label style={{ fontSize:12, color:BOOKS.muted, display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
          <input type="checkbox" checked={filterUnrev} onChange={(e) => setFilterUnrev(e.target.checked)} /> Unreviewed only
        </label>
        <div style={{ flex:1 }} />
        <button onClick={() => setShowManual(true)}
          style={{ background:BOOKS.ink, color:'#FFFFFF', border:'none', borderRadius:6, padding:'7px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          + Add manually
        </button>
      </div>

      <div style={{ fontSize:12, color:BOOKS.muted, marginBottom:8 }}>
        Showing {filtered.length} of {data.expenses.length} expenses · total {fmtMoney(filtered.reduce((s, r) => s + Number(r.amount || 0), 0))}
      </div>

      {/* Table */}
      <div style={{ border:`1px solid ${BOOKS.border}`, borderRadius:10, overflow:'hidden', overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth: isMobile ? 700 : 'auto' }}>
          <thead style={{ background:BOOKS.surface }}>
            <tr style={{ textAlign:'left' }}>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Vendor</th>
              <th style={{ ...thStyle, textAlign:'right' }}>Amount</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Linked deal</th>
              <th style={thStyle}>Confidence</th>
              <th style={thStyle}>Reviewed</th>
              <th style={thStyle}>Flags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.expense_id} onClick={() => setSelected(r)}
                style={{ borderTop:`1px solid ${BOOKS.border}`, cursor:'pointer', background: selected?.expense_id === r.expense_id ? BOOKS.surface : 'transparent' }}>
                <td style={tdStyle}>{fmtDate(r.date)}</td>
                <td style={tdStyle}>{r.vendor || <span style={{ color:BOOKS.muted }}>—</span>}</td>
                <td style={{ ...tdStyle, textAlign:'right', fontVariantNumeric:'tabular-nums', fontWeight:600 }}>{fmtMoney(r.amount, r.currency)}</td>
                <td style={tdStyle}>{r.category || <span style={{ color:BOOKS.muted }}>—</span>}</td>
                <td style={tdStyle}>{linkedDealLabel(r.linked_deal_id, data.deals)}</td>
                <td style={tdStyle}><ConfidenceBadge level={r.extraction_confidence} /></td>
                <td style={tdStyle}>{String(r.reviewed).toLowerCase() === 'true' ? '✓' : '—'}</td>
                <td style={tdStyle}><FlagDots flags={r.flags_computed} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:'40px 0', color:BOOKS.muted, fontSize:13 }}>No expenses match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <ExpenseDetailPanel row={selected} deals={data.deals} onClose={() => setSelected(null)} reload={reload} showToast={showToast} />}
      {showManual && <ManualExpenseModal deals={data.deals} onClose={() => setShowManual(false)} reload={reload} showToast={showToast} />}
    </div>
  );
}

const thStyle = { padding:'10px 12px', fontWeight:700, fontSize:11, color:BOOKS.muted, textTransform:'uppercase', letterSpacing:'1px' };
const tdStyle = { padding:'10px 12px', color:BOOKS.ink, verticalAlign:'top' };

function linkedDealLabel(dealId, deals) {
  if (!dealId) return <span style={{ color:'#94A3B8' }}>—</span>;
  const d = deals.find((x) => x.deal_id === dealId);
  return d ? <span style={{ color:SLATE, fontWeight:600 }}>{d.brand}</span> : <span style={{ color:'#94A3B8' }}>{dealId.slice(0, 8)}</span>;
}

function ExpenseDetailPanel({ row, deals, onClose, reload, showToast }) {
  const [edit, setEdit] = useState({ ...row });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const patch = {};
      ['date','vendor','amount','currency','category','business_purpose','payment_method',
       'linked_deal_id','linked_deal_id_2','reviewed','notes'].forEach((k) => { patch[k] = edit[k] ?? ''; });
      await booksApi('update-expense', { method:'POST', body: { expense_id: row.expense_id, patch, confirm_vendor_category: edit.category !== row.category_auto } });
      showToast && showToast('Saved');
      reload(); onClose();
    } catch (e) { alert('Save failed: ' + e.message); }
    setSaving(false);
  };

  const inputStyle = { background:BOOKS.parchment, border:`1px solid ${BOOKS.border}`, borderRadius:6, padding:'6px 10px', fontSize:12, fontFamily:'inherit', color:BOOKS.ink, width:'100%' };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:200, display:'flex', justifyContent:'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width:'min(540px, 100vw)', height:'100%', background:BOOKS.parchment, padding:24, overflowY:'auto', boxShadow:'-4px 0 20px rgba(0,0,0,0.12)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:BOOKS.ink }}>Expense detail</div>
            <div style={{ fontSize:10, color:BOOKS.muted, fontFamily:'monospace' }}>{row.expense_id}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:BOOKS.muted }}>×</button>
        </div>

        {row.receipt_url && (
          <div style={{ marginBottom:14 }}>
            <a href={row.receipt_url} target="_blank" rel="noreferrer"
              style={{ display:'block', padding:'10px 14px', background:BOOKS.surface, border:`1px solid ${BOOKS.border}`, borderRadius:8, color:SLATE, fontSize:12, fontWeight:600, textDecoration:'none' }}>
              View receipt in Drive ↗
            </a>
          </div>
        )}

        <div style={{ display:'grid', gap:12 }}>
          <Field label="Date"><input type="date" style={inputStyle} value={edit.date || ''} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></Field>
          <Field label="Vendor"><input style={inputStyle} value={edit.vendor || ''} onChange={(e) => setEdit({ ...edit, vendor: e.target.value })} /></Field>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:8 }}>
            <Field label="Amount"><input type="number" step="0.01" style={inputStyle} value={edit.amount || ''} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></Field>
            <Field label="Currency"><input style={inputStyle} value={edit.currency || ''} onChange={(e) => setEdit({ ...edit, currency: e.target.value })} /></Field>
          </div>
          <Field label="Category">
            <select style={inputStyle} value={edit.category || ''} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
              <option value="">— pick —</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Business purpose">
            <textarea style={{ ...inputStyle, minHeight:60, fontFamily:'inherit' }} value={edit.business_purpose || ''} onChange={(e) => setEdit({ ...edit, business_purpose: e.target.value })} />
          </Field>
          <Field label="Linked deal (primary)">
            <select style={inputStyle} value={edit.linked_deal_id || ''} onChange={(e) => setEdit({ ...edit, linked_deal_id: e.target.value })}>
              <option value="">— No link —</option>
              {deals.map((d) => <option key={d.deal_id} value={d.deal_id}>{d.brand} ({d.status})</option>)}
            </select>
          </Field>
          <Field label="Linked deal (secondary)">
            <select style={inputStyle} value={edit.linked_deal_id_2 || ''} onChange={(e) => setEdit({ ...edit, linked_deal_id_2: e.target.value })}>
              <option value="">— No second link —</option>
              {deals.map((d) => <option key={d.deal_id} value={d.deal_id}>{d.brand} ({d.status})</option>)}
            </select>
          </Field>
          <Field label="Payment method"><input style={inputStyle} value={edit.payment_method || ''} onChange={(e) => setEdit({ ...edit, payment_method: e.target.value })} /></Field>
          <Field label="Notes">
            <textarea style={{ ...inputStyle, minHeight:50, fontFamily:'inherit' }} value={edit.notes || ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
          </Field>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:BOOKS.ink, cursor:'pointer' }}>
            <input type="checkbox" checked={String(edit.reviewed).toLowerCase() === 'true'} onChange={(e) => setEdit({ ...edit, reviewed: e.target.checked ? 'TRUE' : 'FALSE' })} />
            Mark reviewed
          </label>
        </div>

        <div style={{ marginTop:20, display:'flex', gap:8 }}>
          <button onClick={save} disabled={saving}
            style={{ flex:1, background:BOOKS.ink, color:'#FFFFFF', border:'none', borderRadius:8, padding:'10px', fontSize:13, fontWeight:700, cursor:saving?'wait':'pointer', fontFamily:'inherit', opacity:saving?0.6:1 }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button onClick={onClose}
            style={{ background:BOOKS.surface, color:BOOKS.ink, border:`1px solid ${BOOKS.border}`, borderRadius:8, padding:'10px 16px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            Cancel
          </button>
        </div>

        {row.extracted_text && (
          <details style={{ marginTop:18, fontSize:11, color:BOOKS.muted }}>
            <summary style={{ cursor:'pointer', fontWeight:600 }}>Raw OCR text (debug)</summary>
            <pre style={{ marginTop:8, whiteSpace:'pre-wrap', maxHeight:200, overflow:'auto', background:BOOKS.surface, padding:10, borderRadius:6 }}>{row.extracted_text}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

function ManualExpenseModal({ deals, onClose, reload, showToast }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    vendor: '', amount: '', currency: 'USD', category: 'Other',
    business_purpose: '', payment_method: '', linked_deal_id: '', notes: '',
    entered_by: 'paul',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.vendor || !form.amount || !form.date) { alert('Vendor, amount, and date are required.'); return; }
    setSaving(true);
    try {
      await booksApi('manual-expense', { method:'POST', body: form });
      showToast && showToast('Added');
      reload(); onClose();
    } catch (e) { alert('Save failed: ' + e.message); }
    setSaving(false);
  };

  const inputStyle = { background:BOOKS.parchment, border:`1px solid ${BOOKS.border}`, borderRadius:6, padding:'7px 10px', fontSize:12, fontFamily:'inherit', color:BOOKS.ink, width:'100%' };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background:BOOKS.parchment, borderRadius:14, padding:24, width:'min(480px, 100%)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ fontSize:16, fontWeight:800, color:BOOKS.ink, marginBottom:16 }}>Add expense manually</div>
        <div style={{ display:'grid', gap:10 }}>
          <Field label="Vendor"><input style={inputStyle} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Field label="Date"><input type="date" style={inputStyle} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Amount"><input type="number" step="0.01" style={inputStyle} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          </div>
          <Field label="Category">
            <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Business purpose">
            <textarea style={{ ...inputStyle, minHeight:60, fontFamily:'inherit' }} value={form.business_purpose} onChange={(e) => setForm({ ...form, business_purpose: e.target.value })} />
          </Field>
          <Field label="Linked deal (optional)">
            <select style={inputStyle} value={form.linked_deal_id} onChange={(e) => setForm({ ...form, linked_deal_id: e.target.value })}>
              <option value="">— No link —</option>
              {deals.map((d) => <option key={d.deal_id} value={d.deal_id}>{d.brand} ({d.status})</option>)}
            </select>
          </Field>
          <Field label="Payment method (optional)"><input style={inputStyle} value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} /></Field>
        </div>
        <div style={{ marginTop:16, display:'flex', gap:8 }}>
          <button onClick={save} disabled={saving}
            style={{ flex:1, background:BOOKS.ink, color:'#FFFFFF', border:'none', borderRadius:8, padding:'10px', fontSize:13, fontWeight:700, cursor:saving?'wait':'pointer', fontFamily:'inherit', opacity:saving?0.6:1 }}>
            {saving ? 'Saving…' : 'Add expense'}
          </button>
          <button onClick={onClose}
            style={{ background:BOOKS.surface, color:BOOKS.ink, border:`1px solid ${BOOKS.border}`, borderRadius:8, padding:'10px 16px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DealsTab — pipeline kanban
// ─────────────────────────────────────────────────────────────────────────────
function DealsTab({ data, reload, isMobile, showToast }) {
  const [editing, setEditing] = useState(null); // null | 'new' | dealObj
  const cols = DEAL_STATUSES;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ fontSize:13, color:BOOKS.muted }}>{data.deals.length} deal{data.deals.length === 1 ? '' : 's'} this year</div>
        <button onClick={() => setEditing({})}
          style={{ background:BOOKS.ink, color:'#FFFFFF', border:'none', borderRadius:6, padding:'7px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          + Add deal
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap:12 }}>
        {cols.map((status) => {
          const list = data.deals.filter((d) => d.status === status);
          const total = list.reduce((s, d) => s + Number(d.deal_value || 0), 0);
          return (
            <div key={status} style={{ background:BOOKS.surface, border:`1px solid ${BOOKS.border}`, borderRadius:10, padding:12, minHeight:200 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:BOOKS.ink, textTransform:'uppercase', letterSpacing:'1.5px' }}>{status}</div>
                <div style={{ fontSize:10, color:BOOKS.muted, fontVariantNumeric:'tabular-nums' }}>{list.length} · {fmtMoney(total)}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {list.map((d) => (
                  <div key={d.deal_id} onClick={() => setEditing(d)}
                    style={{ background:BOOKS.parchment, border:`1px solid ${BOOKS.border}`, borderRadius:8, padding:'10px 12px', cursor:'pointer', transition:'all 0.12s' }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = BOOKS.ink}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = BOOKS.border}>
                    <div style={{ fontSize:13, fontWeight:700, color:BOOKS.ink }}>{d.brand}</div>
                    <div style={{ fontSize:11, color:BOOKS.muted, marginTop:3, display:'flex', justifyContent:'space-between' }}>
                      <span>{d.platform || '—'}</span>
                      <span style={{ fontVariantNumeric:'tabular-nums', fontWeight:600, color:SLATE }}>{fmtMoney(d.deal_value)}</span>
                    </div>
                    {(d.shoot_start_date || d.shoot_end_date) && (
                      <div style={{ fontSize:10, color:BOOKS.muted, marginTop:3 }}>
                        Shoot: {d.shoot_start_date || '?'} → {d.shoot_end_date || '?'}
                      </div>
                    )}
                  </div>
                ))}
                {list.length === 0 && <div style={{ fontSize:11, color:BOOKS.muted, textAlign:'center', padding:'14px 0' }}>No deals</div>}
              </div>
            </div>
          );
        })}
      </div>

      {editing && <DealModal deal={editing.deal_id ? editing : null} expenses={data.expenses} onClose={() => setEditing(null)} reload={reload} showToast={showToast} />}
    </div>
  );
}

function DealModal({ deal, expenses, onClose, reload, showToast }) {
  const [form, setForm] = useState({
    deal_id: deal?.deal_id || '',
    brand: deal?.brand || '',
    deal_value: deal?.deal_value || '',
    status: deal?.status || 'Pitching',
    platform: deal?.platform || 'TikTok',
    deliverable_url: deal?.deliverable_url || '',
    invoice_url: deal?.invoice_url || '',
    shoot_start_date: deal?.shoot_start_date || '',
    shoot_end_date: deal?.shoot_end_date || '',
    usage_rights: deal?.usage_rights || '',
    paid_date: deal?.paid_date || '',
    notes: deal?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const linkedExp = deal ? expenses.filter((e) => e.linked_deal_id === deal.deal_id || e.linked_deal_id_2 === deal.deal_id) : [];
  const expensesTotal = linkedExp.reduce((s, e) => s + Number(e.amount || 0), 0);
  const profit = Number(form.deal_value || 0) - expensesTotal;

  // Show expenses in shoot window if no deal_id yet (preview)
  const previewExp = !deal && form.shoot_start_date && form.shoot_end_date
    ? expenses.filter((e) => e.date >= form.shoot_start_date && e.date <= form.shoot_end_date)
    : [];

  const save = async () => {
    if (!form.brand) { alert('Brand is required.'); return; }
    if (form.status === 'Paid' && !form.deliverable_url) {
      if (!confirm('Status is Paid but no deliverable URL. Save anyway?')) return;
    }
    setSaving(true);
    try {
      await booksApi('upsert-deal', { method:'POST', body: form });
      showToast && showToast(deal ? 'Deal updated' : 'Deal added');
      reload(); onClose();
    } catch (e) { alert('Save failed: ' + e.message); }
    setSaving(false);
  };

  const inputStyle = { background:BOOKS.parchment, border:`1px solid ${BOOKS.border}`, borderRadius:6, padding:'7px 10px', fontSize:12, fontFamily:'inherit', color:BOOKS.ink, width:'100%' };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background:BOOKS.parchment, borderRadius:14, padding:24, width:'min(560px, 100%)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ fontSize:16, fontWeight:800, color:BOOKS.ink, marginBottom:16 }}>{deal ? 'Edit deal' : 'Add deal'}</div>
        <div style={{ display:'grid', gap:10 }}>
          <Field label="Brand"><input style={inputStyle} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Field label="Status">
              <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {DEAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Deal value"><input type="number" step="0.01" style={inputStyle} value={form.deal_value} onChange={(e) => setForm({ ...form, deal_value: e.target.value })} /></Field>
          </div>
          <Field label="Platform">
            <select style={inputStyle} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
              <option>TikTok</option><option>IG</option><option>YouTube</option><option>UGC</option><option>Bundle</option>
            </select>
          </Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Field label="Shoot start"><input type="date" style={inputStyle} value={form.shoot_start_date} onChange={(e) => setForm({ ...form, shoot_start_date: e.target.value })} /></Field>
            <Field label="Shoot end"><input type="date" style={inputStyle} value={form.shoot_end_date} onChange={(e) => setForm({ ...form, shoot_end_date: e.target.value })} /></Field>
          </div>
          <Field label="Usage rights"><input style={inputStyle} placeholder="e.g. 30-day, paid social only" value={form.usage_rights} onChange={(e) => setForm({ ...form, usage_rights: e.target.value })} /></Field>
          <Field label="Deliverable URL"><input style={inputStyle} placeholder="Posted link (required when Paid)" value={form.deliverable_url} onChange={(e) => setForm({ ...form, deliverable_url: e.target.value })} /></Field>
          <Field label="Invoice URL"><input style={inputStyle} placeholder="Required from Sold In onward" value={form.invoice_url} onChange={(e) => setForm({ ...form, invoice_url: e.target.value })} /></Field>
          <Field label="Paid date"><input type="date" style={inputStyle} value={form.paid_date} onChange={(e) => setForm({ ...form, paid_date: e.target.value })} /></Field>
          <Field label="Notes">
            <textarea style={{ ...inputStyle, minHeight:50, fontFamily:'inherit' }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>

        {(linkedExp.length > 0 || previewExp.length > 0) && (
          <div style={{ marginTop:16, padding:12, background:BOOKS.surface, borderRadius:8 }}>
            <div style={{ fontSize:11, fontWeight:700, color:BOOKS.ink, textTransform:'uppercase', letterSpacing:'1.2px', marginBottom:8 }}>
              {deal ? 'Linked expenses' : 'Expenses in shoot window (preview)'}
            </div>
            {(linkedExp.length > 0 ? linkedExp : previewExp).slice(0, 8).map((e) => (
              <div key={e.expense_id} style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:BOOKS.ink, padding:'4px 0' }}>
                <span>{e.date} · {e.vendor}</span>
                <span style={{ fontWeight:600 }}>{fmtMoney(e.amount)}</span>
              </div>
            ))}
            {deal && (
              <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${BOOKS.border}`, display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, color:BOOKS.ink }}>
                <span>Profitability</span>
                <span style={{ color: profit >= 0 ? '#16A34A' : '#DC2626' }}>{fmtMoney(profit)}</span>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop:16, display:'flex', gap:8 }}>
          <button onClick={save} disabled={saving}
            style={{ flex:1, background:BOOKS.ink, color:'#FFFFFF', border:'none', borderRadius:8, padding:'10px', fontSize:13, fontWeight:700, cursor:saving?'wait':'pointer', fontFamily:'inherit', opacity:saving?0.6:1 }}>
            {saving ? 'Saving…' : (deal ? 'Save changes' : 'Add deal')}
          </button>
          <button onClick={onClose}
            style={{ background:BOOKS.surface, color:BOOKS.ink, border:`1px solid ${BOOKS.border}`, borderRadius:8, padding:'10px 16px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AuditTab — searchable audit cards
// ─────────────────────────────────────────────────────────────────────────────
function AuditTab({ data, isMobile }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const matches = data.expenses.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return String(r.vendor || '').toLowerCase().includes(s)
      || String(r.business_purpose || '').toLowerCase().includes(s)
      || String(r.category || '').toLowerCase().includes(s);
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const inputStyle = { background:BOOKS.parchment, border:`1px solid ${BOOKS.border}`, borderRadius:6, padding:'8px 12px', fontSize:13, fontFamily:'inherit', color:BOOKS.ink, width:'100%', maxWidth:320 };

  return (
    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap:16 }}>
      <div>
        <input placeholder="Search vendor / purpose / category…" value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} />
        <div style={{ marginTop:12, maxHeight: isMobile ? 240 : 600, overflowY:'auto', border:`1px solid ${BOOKS.border}`, borderRadius:8 }}>
          {matches.map((r) => (
            <div key={r.expense_id} onClick={() => setSelected(r)}
              style={{
                padding:'10px 12px', borderBottom:`1px solid ${BOOKS.border}`, cursor:'pointer',
                background: selected?.expense_id === r.expense_id ? BOOKS.surface : 'transparent',
              }}>
              <div style={{ fontSize:12, fontWeight:600, color:BOOKS.ink }}>{r.vendor || '(no vendor)'}</div>
              <div style={{ fontSize:11, color:BOOKS.muted, display:'flex', justifyContent:'space-between', marginTop:2 }}>
                <span>{fmtDate(r.date)}</span>
                <span>{fmtMoney(r.amount, r.currency)}</span>
              </div>
            </div>
          ))}
          {matches.length === 0 && <div style={{ padding:'30px 12px', textAlign:'center', color:BOOKS.muted, fontSize:12 }}>No matches.</div>}
        </div>
      </div>
      {selected
        ? <AuditCard row={selected} deals={data.deals} />
        : <div style={{ padding:30, textAlign:'center', color:BOOKS.muted, fontSize:13 }}>Pick an expense to view its audit card.</div>}
    </div>
  );
}

function AuditCard({ row, deals }) {
  const linked = row.linked_deal_id ? deals.find((d) => d.deal_id === row.linked_deal_id) : null;
  const linked2 = row.linked_deal_id_2 ? deals.find((d) => d.deal_id === row.linked_deal_id_2) : null;

  const printPdf = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Audit Card — ${row.vendor || row.expense_id}</title>
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; padding: 32px; max-width: 720px; margin: 0 auto; color: #1A2744; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .meta { color: #94A3B8; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
        td { padding: 6px 8px; border-bottom: 1px solid #E1E5EE; vertical-align: top; font-size: 12px; }
        td:first-child { font-weight: 700; width: 35%; color: #2E4A66; }
        .deal { background: #F7F9FC; padding: 14px; border-radius: 8px; margin-top: 14px; font-size: 12px; }
        img { max-width: 100%; border: 1px solid #E1E5EE; border-radius: 6px; margin: 12px 0; }
      </style></head><body>
      <h1>${row.vendor || '(no vendor)'} — ${fmtMoney(row.amount, row.currency)}</h1>
      <div class="meta">RGG Media · Expense ${row.expense_id} · ${row.date}</div>
      <table>
        <tr><td>Date</td><td>${row.date || '—'}</td></tr>
        <tr><td>Vendor</td><td>${row.vendor || '—'}</td></tr>
        <tr><td>Amount</td><td>${fmtMoney(row.amount, row.currency)}</td></tr>
        <tr><td>Category</td><td>${row.category || '—'}</td></tr>
        <tr><td>Payment method</td><td>${row.payment_method || '—'}</td></tr>
        <tr><td>Business purpose</td><td>${row.business_purpose || '—'}</td></tr>
        <tr><td>Receipt</td><td>${row.receipt_url ? `<a href="${row.receipt_url}">Drive link</a>` : '—'}</td></tr>
        <tr><td>Confidence</td><td>${row.extraction_confidence || '—'}</td></tr>
        <tr><td>Source</td><td>${row.entered_by} · extracted ${row.extracted_at}</td></tr>
      </table>
      ${linked ? `<div class="deal"><strong>Linked deal: ${linked.brand}</strong><br/>Value: ${fmtMoney(linked.deal_value)} · Status: ${linked.status} · Platform: ${linked.platform || '—'}<br/>Shoot: ${linked.shoot_start_date || '?'} → ${linked.shoot_end_date || '?'}<br/>${linked.deliverable_url ? `Deliverable: <a href="${linked.deliverable_url}">${linked.deliverable_url}</a>` : ''}</div>` : ''}
      ${linked2 ? `<div class="deal"><strong>Secondary linked deal: ${linked2.brand}</strong><br/>Value: ${fmtMoney(linked2.deal_value)} · Status: ${linked2.status}</div>` : ''}
      </body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div style={{ background:BOOKS.parchment, border:`1px solid ${BOOKS.border}`, borderRadius:12, padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12, flexWrap:'wrap', gap:8 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:BOOKS.ink }}>{row.vendor || '(no vendor)'}</div>
          <div style={{ fontSize:11, color:BOOKS.muted, fontFamily:'monospace', marginTop:2 }}>{row.expense_id}</div>
        </div>
        <button onClick={printPdf}
          style={{ background:BOOKS.ink, color:'#FFFFFF', border:'none', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          Print to PDF
        </button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'150px 1fr', gap:'8px 16px', fontSize:12, color:BOOKS.ink }}>
        <strong style={{ color:SLATE }}>Date</strong>            <span>{row.date || '—'}</span>
        <strong style={{ color:SLATE }}>Amount</strong>          <span style={{ fontWeight:700 }}>{fmtMoney(row.amount, row.currency)}</span>
        <strong style={{ color:SLATE }}>Category</strong>        <span>{row.category || '—'}</span>
        <strong style={{ color:SLATE }}>Payment method</strong>  <span>{row.payment_method || '—'}</span>
        <strong style={{ color:SLATE }}>Business purpose</strong><span>{row.business_purpose || <em style={{ color:BOOKS.muted }}>missing — required for audit</em>}</span>
        <strong style={{ color:SLATE }}>Receipt</strong>         <span>{row.receipt_url ? <a href={row.receipt_url} target="_blank" rel="noreferrer" style={{ color:SLATE, fontWeight:600 }}>View in Drive ↗</a> : '—'}</span>
        <strong style={{ color:SLATE }}>Confidence</strong>      <span>{row.extraction_confidence || '—'}</span>
        <strong style={{ color:SLATE }}>Source</strong>          <span>{row.entered_by} · {row.extracted_at}</span>
      </div>

      {linked && (
        <div style={{ marginTop:16, padding:14, background:BOOKS.surface, borderRadius:8 }}>
          <div style={{ fontSize:11, fontWeight:700, color:BOOKS.muted, textTransform:'uppercase', letterSpacing:'1.2px', marginBottom:6 }}>Linked deal</div>
          <div style={{ fontSize:14, fontWeight:700, color:BOOKS.ink }}>{linked.brand}</div>
          <div style={{ fontSize:12, color:BOOKS.ink, marginTop:4 }}>
            {fmtMoney(linked.deal_value)} · {linked.status} · {linked.platform || '—'}
          </div>
          {(linked.shoot_start_date || linked.shoot_end_date) && (
            <div style={{ fontSize:11, color:BOOKS.muted, marginTop:3 }}>Shoot: {linked.shoot_start_date || '?'} → {linked.shoot_end_date || '?'}</div>
          )}
          {linked.deliverable_url && <div style={{ fontSize:11, marginTop:4 }}><a href={linked.deliverable_url} target="_blank" rel="noreferrer" style={{ color:SLATE }}>Deliverable ↗</a></div>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExportTab — CSV + audit binder
// ─────────────────────────────────────────────────────────────────────────────
function ExportTab({ data, year }) {
  const [busy, setBusy] = useState(null);

  const downloadCsv = async () => {
    setBusy('csv');
    try {
      const r = await fetch(`${BOOKS_API}?action=year-export&kind=csv&year=${year}`);
      const text = await r.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `RGG_Media_Expenses_${year}_for_George.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Export failed: ' + e.message); }
    setBusy(null);
  };

  const printBinder = () => {
    const expenses = [...data.expenses]
      .filter((r) => withinYear(r, year))
      .sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.date || '').localeCompare(b.date || ''));
    const byCat = {};
    expenses.forEach((r) => { (byCat[r.category || 'Uncategorized'] ||= []).push(r); });
    const dealsById = {};
    data.deals.forEach((d) => { dealsById[d.deal_id] = d; });

    const w = window.open('', '_blank');
    if (!w) return;
    let toc = '<ul style="font-size:13px; line-height:1.9;">';
    Object.keys(byCat).sort().forEach((c) => {
      const total = byCat[c].reduce((s, r) => s + Number(r.amount || 0), 0);
      toc += `<li><strong>${c}</strong> — ${byCat[c].length} expense${byCat[c].length===1?'':'s'} · ${fmtMoney(total)}</li>`;
    });
    toc += '</ul>';

    let cards = '';
    Object.keys(byCat).sort().forEach((c) => {
      cards += `<h2 style="margin-top:32px; padding-bottom:8px; border-bottom:2px solid #1A2744;">${c}</h2>`;
      byCat[c].forEach((r) => {
        const linked = r.linked_deal_id ? dealsById[r.linked_deal_id] : null;
        cards += `
          <div class="card">
            <div class="hdr">${r.vendor || '(no vendor)'} — ${fmtMoney(r.amount, r.currency)}</div>
            <div class="meta">${r.date} · ${r.expense_id}</div>
            <table>
              <tr><td>Date</td><td>${r.date || '—'}</td></tr>
              <tr><td>Vendor</td><td>${r.vendor || '—'}</td></tr>
              <tr><td>Amount</td><td>${fmtMoney(r.amount, r.currency)}</td></tr>
              <tr><td>Payment method</td><td>${r.payment_method || '—'}</td></tr>
              <tr><td>Business purpose</td><td>${r.business_purpose || '<em>missing</em>'}</td></tr>
              <tr><td>Receipt</td><td>${r.receipt_url ? `<a href="${r.receipt_url}">Drive link</a>` : '—'}</td></tr>
              <tr><td>Confidence</td><td>${r.extraction_confidence || '—'}</td></tr>
            </table>
            ${linked ? `<div class="deal"><strong>${linked.brand}</strong> — ${fmtMoney(linked.deal_value)} · ${linked.status}<br/>Shoot: ${linked.shoot_start_date || '?'} → ${linked.shoot_end_date || '?'}</div>` : ''}
          </div>
        `;
      });
    });

    w.document.write(`
      <html><head><title>RGG Media ${year} — Audit Binder</title>
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; padding: 36px; max-width: 760px; margin: 0 auto; color: #1A2744; }
        h1 { font-size: 22px; margin: 0 0 6px; } h2 { font-size: 16px; }
        .card { page-break-inside: avoid; margin-bottom: 22px; padding: 14px; border: 1px solid #E1E5EE; border-radius: 8px; }
        .hdr { font-size: 14px; font-weight: 800; }
        .meta { color:#94A3B8; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; margin: 3px 0 10px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 5px 6px; border-bottom: 1px solid #F0F2F8; font-size: 11px; vertical-align: top; }
        td:first-child { font-weight: 700; width: 35%; color:#2E4A66; }
        .deal { margin-top: 10px; padding: 10px; background: #F7F9FC; border-radius: 6px; font-size: 11px; }
      </style></head><body>
      <h1>RGG Media LLC — ${year} Audit Binder</h1>
      <div style="color:#94A3B8; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:24px;">Generated ${new Date().toISOString().slice(0,10)} · Total: ${fmtMoney(expenses.reduce((s,r)=>s+Number(r.amount||0),0))}</div>
      <h2>Contents</h2>${toc}${cards}
      </body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap:16 }}>
      <div style={{ background:BOOKS.surface, border:`1px solid ${BOOKS.border}`, borderRadius:12, padding:20 }}>
        <div style={{ fontSize:14, fontWeight:800, color:BOOKS.ink, marginBottom:6 }}>CSV for CPA</div>
        <div style={{ fontSize:12, color:BOOKS.muted, marginBottom:14 }}>
          Flat export with category totals, sorted by category then date. Send to George Dimov.
        </div>
        <button onClick={downloadCsv} disabled={busy === 'csv'}
          style={{ background:BOOKS.ink, color:'#FFFFFF', border:'none', borderRadius:8, padding:'10px 16px', fontSize:13, fontWeight:700, cursor: busy?'wait':'pointer', fontFamily:'inherit', opacity: busy === 'csv' ? 0.6 : 1 }}>
          {busy === 'csv' ? 'Generating…' : 'Download CSV'}
        </button>
      </div>
      <div style={{ background:BOOKS.surface, border:`1px solid ${BOOKS.border}`, borderRadius:12, padding:20 }}>
        <div style={{ fontSize:14, fontWeight:800, color:BOOKS.ink, marginBottom:6 }}>Audit Binder PDF</div>
        <div style={{ fontSize:12, color:BOOKS.muted, marginBottom:14 }}>
          One audit card per expense, sorted by category then date, with table of contents. Print-to-PDF from the new window.
        </div>
        <button onClick={printBinder}
          style={{ background:BOOKS.ink, color:'#FFFFFF', border:'none', borderRadius:8, padding:'10px 16px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          Generate audit binder
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// END BOOKS TAB
// ═══════════════════════════════════════════════════════════════════════════
  const TABS = [['overview','Overview'],['analytics','Analytics'],['audience','Audience'],['revenue','Revenue'],['books','Books'],['deals','Deals'],['proposals','Proposals'],['content-intel','Content Intel'],['crm','CRM'],['deliverables','Deliverables'],['reality-casting','Reality TV Casting']];

  return (
    <div style={{ background:BG, minHeight:'100vh', color:TEXT, fontFamily:"'Inter', system-ui, sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed',top:isMobile?'auto':20,bottom:isMobile?20:'auto',left:isMobile?16:'auto',right:isMobile?16:20,zIndex:9999,background:'#1A1A2E',color:'#FFFFFF',padding:'12px 20px',borderRadius:12,fontWeight:700,fontSize:13,boxShadow:'0 4px 20px rgba(0,0,0,0.10)',textAlign:'center' }}>
          {toast}
        </div>
      )}

      {/* Modals */}
      {dealModal && <DealModal initial={dealModal} onSave={saveDeal} onDelete={deleteDeal} onClose={() => setDealModal(null)} isMobile={isMobile} />}
      {selectedYtVideo && <VideoModal video={selectedYtVideo} avgViews={ytAnalytics?.aggregates?.avgViews || 0} avgEngRate={ytAnalytics?.aggregates?.avgEngRate || 0} onClose={() => setSelectedYtVideo(null)} isMobile={isMobile} />}

      {/* ── Deal → CRM prompt ─────────────────────────────────── */}
      {pendingCrmBrand && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center' }}
          onClick={e => { if (e.target===e.currentTarget) setPendingCrmBrand(null); }}>
          <div style={{ background:'#FFFFFF',border:`1px solid ${OCEAN}88`,borderRadius:18,padding:'28px 28px 24px',width:360,maxWidth:'90vw' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:18,fontWeight:800,marginBottom:8 }}>Add to CRM?</div>
            <div style={{ fontSize:13,color:SLATE,marginBottom:20,lineHeight:1.6 }}>
              <strong style={{ color:TEXT }}>{pendingCrmBrand.b}</strong> isn't in your CRM yet. Add them now so you can track this relationship long-term?
            </div>
            <div style={{ display:'flex',gap:10 }}>
              <button
                onClick={() => {
                  addCrm({ b: pendingCrmBrand.b, dealValue: pendingCrmBrand.v, note: pendingCrmBrand.del ? `Deal: ${pendingCrmBrand.del}` : '' });
                  setPendingCrmBrand(null);
                  setTab('crm');
                  showToast('Added to CRM — fill in the details!');
                }}
                style={{ flex:1,background:BLUE,color:TEXT,border:'none',borderRadius:10,padding:'12px',fontWeight:800,fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>
                ✓ Add to CRM
              </button>
              <button onClick={() => setPendingCrmBrand(null)}
                style={{ background:'#F7F9FC',color:'#94A3B8',border:`1px solid ${BDR}`,borderRadius:10,padding:'12px 16px',fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
      {followerEdit && (
        <FollowerModal label={followerEdit.label} current={followerEdit.val} isMobile={isMobile}
          onSave={n => { if (followerEdit.key==='ig') setIgFollowers(n); if (followerEdit.key==='tt') setTtFollowers(n); if (followerEdit.key==='yt') setYtSubs(n); setFollowerEdit(null); showToast('Updated!'); }}
          onClose={() => setFollowerEdit(null)} />
      )}

      {/* Header */}
      <div style={{ background:'#FFFFFF',borderBottom:'1px solid #E0E6EF',padding:isMobile?'12px 16px':'14px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100,boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
        <div>
          <div style={{ fontSize:isMobile?15:18,fontWeight:800,letterSpacing:'-0.5px',color:'#1A1A2E' }}>paul_ferrante</div>
          <div style={{ fontSize:9,color:BLUE,letterSpacing:'3px',textTransform:'uppercase',marginTop:1,fontWeight:700 }}>command center</div>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:isMobile?10:16 }}>
          {!isMobile && (
            <div style={{ display:'flex',gap:10 }}>
              {[['YouTube',ytConnected],['Instagram',igConnected],['TikTok',ttConnected]].map(([p,conn]) => (
                <div key={p} style={{ display:'flex',alignItems:'center',gap:5,fontSize:10 }}>
                  <div style={{ width:5,height:5,borderRadius:'50%',background:conn?'#22c55e':'#CBD5E1' }} />
                  <span style={{ color:conn?'#16a34a':'#94A3B8' }}>{p}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#16a34a' }}>
            <div style={{ width:6,height:6,borderRadius:'50%',background:'#22c55e',animation:'livePulse 2s infinite' }} />
            {!isMobile && 'live'}
          </div>
          <div style={{ fontSize:10,color:syncStatus==='saved'?'#16a34a':syncStatus==='syncing'?'#D97706':syncStatus==='error'?'#DC2626':'#94A3B8',display:'flex',alignItems:'center',gap:4 }}>
            {syncStatus==='syncing' && <span style={{ animation:'livePulse 1s infinite' }}>↑</span>}
            {syncStatus==='saved'   && '✓ synced'}
            {syncStatus==='error'   && '⚠ offline'}
          </div>
        </div>
      </div>

      {/* Main layout — sidebar + content */}
      <div style={{ display:'flex',minHeight:'calc(100vh - 56px)' }}>

        {/* Sidebar (desktop) */}
        {!isMobile && (
          <div style={{ width:200,background:'#1A2744',padding:'24px 0',flexShrink:0,borderRight:'1px solid #243560',position:'sticky',top:56,height:'calc(100vh - 56px)',overflowY:'auto' }}>
            <div style={{ padding:'0 20px 14px',fontSize:9,color:'#88EAF6',letterSpacing:'2.5px',textTransform:'uppercase',fontWeight:700 }}>Menu</div>
            {TABS.map(([id,lbl]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                display:'block',width:'100%',textAlign:'left',
                background:tab===id?'#88EAF6':'none',
                border:'none',cursor:'pointer',fontFamily:'inherit',
                color:tab===id?'#1A2744':'#8CA0C8',
                padding:'7px 16px',margin:'1px 8px',width:'calc(100% - 16px)',
                fontSize:13,fontWeight:tab===id?600:400,
                borderRadius:5,
                transition:'all 0.12s',
              }}
              onMouseEnter={e=>{if(tab!==id){e.target.style.background='rgba(136,234,246,0.1)';e.target.style.color='#B8D0E8';}}}
              onMouseLeave={e=>{if(tab!==id){e.target.style.background='none';e.target.style.color='#8CA0C8';}}}
              >{lbl}</button>
            ))}
          </div>
        )}

        {/* Mobile bottom nav */}
        {isMobile && (
          <div style={{ position:'fixed',bottom:0,left:0,right:0,background:'#1A2744',borderTop:'1px solid #243560',display:'flex',overflowX:'auto',WebkitOverflowScrolling:'touch',zIndex:90,boxShadow:'0 -2px 8px rgba(0,0,0,0.15)' }}>
            {TABS.map(([id,lbl]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',
                color:tab===id?'#1A2744':'#8CA0C8',padding:'12px 14px',
                fontSize:10,fontWeight:tab===id?700:400,
                background:tab===id?'#88EAF6':'none',
                borderTop:'none',
                whiteSpace:'nowrap',flexShrink:0,
              }}>{lbl}</button>
            ))}
          </div>
        )}

        {/* Content area */}
        <div style={{ flex:1,padding:isMobile?'16px 16px 80px':'28px 32px',overflowY:'auto',background:'#FFFFFF' }}>

        {/* ══ OVERVIEW ══════════════════════════════════════════ */}
        {tab === 'overview' && (
          <div style={{ display:'flex',flexDirection:'column',gap:gutter }}>

            {/* Total audience banner */}
            <Card style={{ background:'#EEF9FD',border:'1px solid #88EAF6',padding:isMobile?'18px 16px':'22px 28px',boxShadow:'0 2px 8px rgba(136,234,246,0.12)',borderRadius:10 }}>
              <div style={{ display:'flex',flexDirection:isMobile?'column':'row',justifyContent:'space-between',alignItems:isMobile?'flex-start':'center',gap:isMobile?16:0 }}>
                <div>
                  <div style={{ fontSize:10,color:'#1A2744',textTransform:'uppercase',letterSpacing:'3px',marginBottom:8,fontWeight:700 }}>total audience</div>
                  <div style={{ fontSize:isMobile?40:52,fontWeight:900,letterSpacing:'-2px',lineHeight:1,color:TEXT }}>
                    {fmtFull(igFollowers + ttFollowers + ytSubs)}
                  </div>
                  <div style={{ fontSize:11,color:SLATE,marginTop:8 }}>across all platforms · updates every 5 min</div>
                </div>
                <div style={{ display:'flex',gap:isMobile?20:24,alignItems:'center' }}>
                  {[
                    { Logo:IGLogo, label:'Instagram', val:igFollowers, connected:igConnected },
                    { Logo:TTLogo, label:'TikTok',    val:ttFollowers, connected:ttConnected },
                    { Logo:YTLogo, label:'YouTube',   val:ytSubs,      connected:ytConnected },
                  ].map(({ Logo, label, val, connected }) => (
                    <div key={label} style={{ textAlign:'center' }}>
                      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:4,marginBottom:4 }}>
                        <Logo size={14}/>
                        <span style={{ fontSize:8,color:'#2E4A66',textTransform:'uppercase',letterSpacing:'1px' }}>{label}</span>
                        <div style={{ width:4,height:4,borderRadius:'50%',background:connected?'#22c55e':'#CBD5E1' }} />
                      </div>
                      <div style={{ fontSize:isMobile?16:20,fontWeight:800,color:connected?BLUE:'#1A2744' }}>{fmtFull(val)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Live social stats */}
            <div>
              <Label>live social stats</Label>
              <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr',gap:gutter }}>

                {[
                  { key:'ig', Logo:IGLogo, label:'Instagram', val:igFollowers, connected:igConnected },
                  { key:'tt', Logo:TTLogo, label:'TikTok',    val:ttFollowers, connected:ttConnected },
                  { key:'yt', Logo:YTLogo, label:'YouTube',   val:ytSubs,      connected:ytConnected },
                ].map(({ key, Logo, label, val, connected }) => (
                  <Card key={key} style={{ transition:'border-color 0.35s,box-shadow 0.35s',borderColor:flash===key?BLUE:BDR,boxShadow:flash===key?`0 0 16px ${BLUE}44`:'none' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
                          <span style={{ fontSize:10,color:'#2E4A66',textTransform:'uppercase',letterSpacing:'2px',fontWeight:600 }}>{label}</span>
                          <div style={{ width:5,height:5,borderRadius:'50%',background:connected?'#22c55e':'#CBD5E1' }} />
                        </div>
                        <div style={{ fontSize:isMobile?28:34,fontWeight:800,letterSpacing:'-1px',lineHeight:1,color:flash===key?BLUE:'#1A2744',transition:'color 0.35s' }}>
                          {fmtFull(val)}
                        </div>
                        <div style={{ display:'flex',alignItems:'center',gap:10,marginTop:8 }}>
                          <span style={{ fontSize:11,color:connected?'#4ade80':'#888' }}>
                            {connected ? '● live from API' : '○ manual'}
                          </span>
                          {!connected && (
                            <button onClick={() => setFollowerEdit({ key, label, val })}
                              style={{ fontSize:10,color:BLUE,background:'none',border:`1px solid ${BLUE}44`,borderRadius:6,padding:'3px 10px',cursor:'pointer',fontFamily:'inherit' }}>
                              update ✏
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ background:'#FFFFFF',padding:'9px 11px',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center' }}><Logo size={22}/></div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Revenue stats */}
            <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'1fr 1fr 1fr',gap:gutter }}>
              <Card style={{ borderLeft:`3px solid ${BLUE}` }}>
                <div style={{ fontSize:10,color:'#0E6A80',textTransform:'uppercase',letterSpacing:'2px',marginBottom:10,fontWeight:600 }}>Total Earned</div>
                <div style={{ fontSize:isMobile?24:36,fontWeight:800,color:'#0E6A80' }}>{usd(totalRevenue)}</div>
                <div style={{ fontSize:11,color:'#4A6080',marginTop:6 }}>{paidDeals.length} deals</div>
              </Card>
              <Card style={{ borderLeft:`3px solid ${YELL}` }}>
                <div style={{ fontSize:10,color:'#8A6A10',textTransform:'uppercase',letterSpacing:'2px',marginBottom:10,fontWeight:600 }}>Pipeline</div>
                <div style={{ fontSize:isMobile?24:36,fontWeight:800,color:'#8A6A10' }}>{usd(pipelineValue)}</div>
                <div style={{ fontSize:11,color:'#4A6080',marginTop:6 }}>{deals.filter(d=>d.s==='Pitching').length} pitches</div>
              </Card>
              {!isMobile && (
                <Card style={{ borderLeft:`3px solid #5DBF8A` }}>
                  <div style={{ fontSize:10,color:'#1A7A40',textTransform:'uppercase',letterSpacing:'2px',marginBottom:10,fontWeight:600 }}>Biggest Deal</div>
                  <div style={{ fontSize:36,fontWeight:800,color:'#1A2744' }}>$2,000</div>
                  <div style={{ fontSize:11,color:'#1A7A40',marginTop:6 }}>American Airlines ✈️</div>
                </Card>
              )}
            </div>

            {/* Milestones + Why We Do This */}
            <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:gutter }}>
              <Card>
                <Label>milestones 🏆</Label>

                {/* Completed milestones — full-width banners stacked at top */}
                {milestones.filter(m => m.done).map(m => (
                  <div key={m.id} style={{
                    background:'#DCFCE7', border:'0.5px solid #86EFAC', borderRadius:8,
                    padding:12, marginBottom:8,
                    display:'flex', justifyContent:'space-between', alignItems:'center', gap:8,
                  }}>
                    <div style={{ fontSize:12, color:'#166534', fontWeight:500, lineHeight:1.4 }}>
                      <span style={{ marginRight:6 }}>{m.e}</span>{m.t}
                    </div>
                    <span style={{
                      background:'#166534', color:'#FFFFFF', fontSize:11, fontWeight:500,
                      padding:'4px 12px', borderRadius:999,
                      display:'inline-flex', alignItems:'center', gap:4, flexShrink:0,
                    }}>
                      <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:12, height:12 }}>
                        <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
                          <path d="M2.5 6.2L5 8.7L9.5 4" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      Done
                    </span>
                  </div>
                ))}

                {/* In-progress milestones — 2-column tile grid */}
                <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:8, marginTop: milestones.some(m=>m.done) ? 4 : 0 }}>
                  {milestones.filter(m => !m.done).map(m => {
                    const label    = (m.t || '').split(':')[0];
                    const ringLen  = 94.2; // 2 * π * 15
                    const ringFill = ((m.pct || 0) / 100) * ringLen;
                    return (
                      <div key={m.id} style={{
                        background:'#FFFFFF', border:'0.5px solid #E5E7EB', borderRadius:8,
                        padding:14,
                        display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
                      }}>
                        <div style={{ display:'flex', flexDirection:'column', flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, color:'#64748B', fontWeight:500, marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            <span style={{ marginRight:5 }}>{m.e}</span>{label}
                          </div>
                          {editMsId === m.id ? (
                            <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:2 }}>
                              <input autoFocus value={editMsVal} onChange={e => setEditMsVal(e.target.value)}
                                onKeyDown={e => { if(e.key==='Enter') saveMs(); if(e.key==='Escape') setEditMsId(null); }}
                                style={{ width:90, background:'#FFFFFF', border:`1px solid ${BLUE}`, borderRadius:5, padding:'3px 7px', color:TEXT, fontSize:18, fontWeight:500, fontFamily:'inherit', outline:'none' }} />
                              <button onClick={saveMs} style={{ fontSize:14, color:BLUE, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', padding:0 }}>✓</button>
                              <button onClick={() => setEditMsId(null)} style={{ fontSize:14, color:'#94A3B8', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', padding:0 }}>✕</button>
                            </div>
                          ) : (
                            <div onClick={() => startEditMs(m)} title="Click to update"
                              style={{ fontSize:22, fontWeight:500, color:TEXT, lineHeight:1.1, cursor:'pointer', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {m.cur}
                            </div>
                          )}
                          <div style={{ fontSize:11, color:'#64748B', marginTop:2 }}>goal {m.goal}</div>
                        </div>
                        <svg viewBox="0 0 36 36" style={{ width:88, height:88, flexShrink:0 }}>
                          <circle cx={18} cy={18} r={15} fill="none" stroke="rgba(120,120,120,0.15)" strokeWidth={3} />
                          <circle cx={18} cy={18} r={15} fill="none" stroke="#88EAF6" strokeWidth={3} strokeLinecap="round"
                            strokeDasharray={`${ringFill} ${ringLen}`}
                            transform="rotate(-90 18 18)" />
                          <text x={18} y={18} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="500" fill={TEXT}>
                            {m.pct}%
                          </text>
                        </svg>
                      </div>
                    );
                  })}
                </div>

                {/* Posts this week — auto-counted across IG + TikTok + YouTube, deduped by day (cross-posts = 1) */}
                {(() => {
                  const ringLen  = 94.2;
                  const wkPct    = Math.min(100, Math.round((weeklyAutoCount / 5) * 100));
                  const ringFill = (wkPct / 100) * ringLen;
                  return (
                    <div style={{
                      background:'#FFFFFF', border:'0.5px solid #E5E7EB', borderRadius:8,
                      padding:14, marginTop:8,
                      display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
                    }}>
                      <div style={{ display:'flex', flexDirection:'column', flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, color:'#64748B', fontWeight:500, marginBottom:2 }}>
                          <span style={{ marginRight:5 }}>📅</span>Posts this week
                        </div>
                        <div style={{ fontSize:22, fontWeight:500, color:TEXT, lineHeight:1.1 }}>
                          {weeklyAutoCount}
                        </div>
                        <div style={{ fontSize:11, color:'#64748B', marginTop:2 }}>goal 5 · auto-tracked</div>
                      </div>
                      <svg viewBox="0 0 36 36" style={{ width:88, height:88, flexShrink:0 }}>
                        <circle cx={18} cy={18} r={15} fill="none" stroke="rgba(120,120,120,0.15)" strokeWidth={3} />
                        <circle cx={18} cy={18} r={15} fill="none" stroke="#88EAF6" strokeWidth={3} strokeLinecap="round"
                          strokeDasharray={`${ringFill} ${ringLen}`}
                          transform="rotate(-90 18 18)" />
                        <text x={18} y={18} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="500" fill={TEXT}>
                          {wkPct}%
                        </text>
                      </svg>
                    </div>
                  );
                })()}
              </Card>


            </div>

            {/* Active Deals Snapshot */}
            <Card>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
                <Label>active deals</Label>
                <button onClick={() => setDealModal({ ...EMPTY_DEAL })} style={{ background:'none',border:`1px solid ${BLUE}44`,color:BLUE,borderRadius:8,padding:'6px 14px',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:600 }}>
                  + New Deal
                </button>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:isMobile?10:12 }}>
                {deals.filter(d=>['Pitching','Awaiting Approval'].includes(d.s)).slice(0,isMobile?4:8).map(d => (
                  <div key={d.id} onClick={() => setDealModal({ ...d })}
                    style={{ background:`${OCEAN}33`,borderRadius:10,padding:isMobile?'12px':14,border:`1px solid ${BDR}`,borderTop:`3px solid ${d.col}`,cursor:'pointer' }}>
                    <div style={{ fontSize:12,fontWeight:700,marginBottom:6 }}>{d.b}</div>
                    <div style={{ fontSize:isMobile?18:24,fontWeight:800,color:BLUE,marginBottom:4 }}>{usd(d.v)}</div>
                    <Tag color={statusColor(d.s)}>{d.s}</Tag>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ══ BRAND DEALS ═══════════════════════════════════════ */}
        {tab === 'deals' && (
          <div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <Label>brand deal pipeline — 2026</Label>
              <button onClick={() => setDealModal({ ...EMPTY_DEAL })} style={{ background:BLUE,color:TEXT,border:'none',borderRadius:10,padding:'9px 18px',fontWeight:800,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>
                + New Deal
              </button>
            </div>

            {isMobile ? (
              /* Mobile: stage selector + card list */
              <div>
                <div style={{ display:'flex',gap:8,overflowX:'auto',paddingBottom:10,WebkitOverflowScrolling:'touch' }}>
                  {STAGE_COLS.map(s => (
                    <button key={s} onClick={() => setMobileStage(s)} style={{
                      flexShrink:0,background:mobileStage===s?`${STAGE_COLORS[s]}22`:'#F7F9FC',
                      border:`1px solid ${mobileStage===s?STAGE_COLORS[s]:BDR}`,
                      color:mobileStage===s?STAGE_COLORS[s]:'#888',
                      borderRadius:20,padding:'7px 16px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',
                    }}>{s} ({deals.filter(d=>d.s===s).length})</button>
                  ))}
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:10,marginTop:12 }}>
                  {deals.filter(d=>d.s===mobileStage).sort((a,b)=>dealDateVal(b)-dealDateVal(a)).map(d => (
                    <div key={d.id} style={{ background:CARD,border:`1px solid ${BDR}`,borderLeft:`4px solid ${d.col}`,borderRadius:10,padding:16 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8 }}>
                        <div style={{ fontSize:15,fontWeight:700 }}>{d.b}</div>
                        <button onClick={() => setDealModal({ ...d })} style={{ background:'none',border:`1px solid ${BDR}`,borderRadius:6,padding:'4px 10px',color:'#64748B',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>✏</button>
                      </div>
                      <div style={{ fontSize:22,fontWeight:800,color:d.s==='Paid'?'#4ade80':BLUE,marginBottom:8 }}>{d.v ? usd(d.v) : 'gifted'}</div>
                      <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                        <Tag color="#666">{d.p}</Tag>
                        {d.d && d.d!=='TBC' && <Tag color={YELL}>{d.d}</Tag>}
                        {d.del && <span style={{ fontSize:10,color:'#64748B' }}>{d.del}</span>}
                      </div>
                    </div>
                  ))}
                  {deals.filter(d=>d.s===mobileStage).length === 0 && (
                    <div style={{ padding:'30px',textAlign:'center',fontSize:13,color:'#94A3B8',borderRadius:10,border:`1px dashed ${BDR}` }}>No deals in this stage</div>
                  )}
                </div>
              </div>
            ) : (
              /* Desktop: drag-and-drop columns */
              <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12 }}>
                {STAGE_COLS.map(status => (
                  <div key={status}
                    onDragOver={e => { e.preventDefault(); setDragOver(status); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={() => handleDrop(status)}
                    style={{ minHeight:120,borderRadius:12,padding:'8px 6px',background:dragOver===status?`${STAGE_COLORS[status]}15`:'transparent',border:`2px dashed ${dragOver===status?STAGE_COLORS[status]:'transparent'}`,transition:'all 0.15s' }}>
                    <div style={{ fontSize:10,color:STAGE_COLORS[status],fontWeight:700,marginBottom:10,textTransform:'uppercase',letterSpacing:'1.5px',padding:'0 6px' }}>
                      {status} ({deals.filter(d=>d.s===status).length})
                    </div>
                    {deals.filter(d=>d.s===status).sort((a,b)=>dealDateVal(b)-dealDateVal(a)).map(d => (
                      <div key={d.id} draggable onDragStart={() => setDragId(d.id)} onDragEnd={() => { setDragId(null); setDragOver(null); }}
                        style={{ background:CARD,border:`1px solid ${BDR}`,borderTop:`3px solid ${d.col}`,borderRadius:10,padding:14,marginBottom:10,opacity:dragId===d.id?0.4:1,userSelect:'none',cursor:'grab' }}>
                        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4 }}>
                          <div style={{ fontSize:13,fontWeight:700 }}>{d.b}</div>
                          <button onClick={e => { e.stopPropagation(); setDealModal({ ...d }); }}
                            style={{ background:'none',border:`1px solid ${BDR}`,borderRadius:6,padding:'3px 8px',color:'#64748B',fontSize:11,cursor:'pointer',fontFamily:'inherit',flexShrink:0,marginLeft:6 }}>✏</button>
                        </div>
                        <div style={{ fontSize:10,color:'#4A6080',marginBottom:8 }}>{d.p}</div>
                        <div style={{ fontSize:d.v?18:12,fontWeight:800,color:d.s==='Paid'?'#4ade80':d.v?BLUE:'#888',marginBottom:6 }}>{d.v ? usd(d.v) : 'gifted'}</div>
                        {d.d && d.d!=='TBC' && <div style={{ fontSize:11,color:'#8A6A10',marginBottom:4 }}>{d.d}</div>}
                        {d.del && <div style={{ fontSize:10,color:'#4A6080' }}>{d.del}</div>}
                        {d.nextStep && <div style={{ fontSize:10,color:BLUE,marginTop:6,borderTop:`1px solid ${OCEAN}66`,paddingTop:6 }}>→ {d.nextStep}</div>}
                        {d.remindDate && <div style={{ fontSize:9,color:YELL,marginTop:3 }}>🔔 {d.remindDate}</div>}
                        {(d.videoLink || d.invoiceUrl) && (
                          <div style={{ display:'flex',gap:8,marginTop:6,borderTop:`1px solid ${OCEAN}66`,paddingTop:6 }}>
                            {d.videoLink && <a href={d.videoLink} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:10,color:'#88EAF6',textDecoration:'none',fontWeight:600 }}>📹 Video</a>}
                            {d.invoiceUrl && <a href={d.invoiceUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:10,color:'#E1D9AE',textDecoration:'none',fontWeight:600 }}>🧾 Invoice</a>}
                          </div>
                        )}
                        <div style={{ marginTop:8,fontSize:9,color:'#94A3B8',textAlign:'right' }}>drag to move</div>
                      </div>
                    ))}
                    {deals.filter(d=>d.s===status).length === 0 && (
                      <div style={{ padding:'20px 10px',textAlign:'center',fontSize:11,color:'#94A3B8',borderRadius:8,border:`1px dashed #222` }}>drop here</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ REVENUE ═══════════════════════════════════════════ */}
        {tab === 'revenue' && (
          <div style={{ display:'flex',flexDirection:'column',gap:gutter }}>
            <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'1fr 1fr 1fr 1fr',gap:gutter }}>
              {[
                { lbl:'Total Earned (2026)',  val:usd(totalRevenue),              color:BLUE,      sub:`${paidDeals.length} paid deals` },
                { lbl:'Active Pipeline',      val:usd(pipelineValue),             color:YELL,      sub:`${deals.filter(d=>d.s==='Pitching').length} pitches` },
                { lbl:'Avg Deal Value',       val:usd(totalRevenue/Math.max(paidDeals.length,1)), color:'#a78bfa', sub:'paid deals only' },
                { lbl:'Best Month',           val:'$2,600',                       color:'#4ade80', sub:'November 2025' },
              ].map(({ lbl, val, color, sub }) => (
                <Card key={lbl} style={{ background:`${OCEAN}55`, borderLeft:`3px solid ${color}` }}>
                  <div style={{ fontSize:9,color,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:10 }}>{lbl}</div>
                  <div style={{ fontSize:isMobile?20:26,fontWeight:800,color }}>{val}</div>
                  {sub && <div style={{ fontSize:11,color:SLATE,marginTop:6 }}>{sub}</div>}
                </Card>
              ))}
            </div>
            <Card>
              <Label>monthly revenue (Nov 2025 – Apr 2026)</Label>
              <ResponsiveContainer width="100%" height={isMobile?160:220}>
                <AreaChart data={revenue}>
                  <defs>
                    <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BLUE} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={BDR} />
                  <XAxis dataKey="m" stroke="#333" tick={{ fill:'#555',fontSize:11 }} />
                  <YAxis stroke="#333" tick={{ fill:'#555',fontSize:11 }} tickFormatter={v=>`$${v}`} />
                  <Tooltip contentStyle={{ background:CARD,border:`1px solid ${BDR}`,borderRadius:8,fontSize:12 }} formatter={v=>[usd(v),'Revenue']} />
                  <Area type="monotone" dataKey="r" stroke={BLUE} strokeWidth={2} fill="url(#rg)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <Label>completed deals</Label>
              {paidDeals.map(d => (
                <div key={d.id} onClick={() => setDealModal({ ...d })}
                  style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 0',borderBottom:`1px solid ${BDR}`,cursor:'pointer' }}>
                  <div>
                    <div style={{ fontSize:isMobile?13:14,fontWeight:600,marginBottom:4 }}>{d.b}</div>
                    <div style={{ fontSize:11,color:'#64748B' }}>{d.p} · {d.d}</div>
                  </div>
                  <div style={{ textAlign:'right',flexShrink:0,marginLeft:12 }}>
                    <div style={{ fontSize:isMobile?16:20,fontWeight:800,color:'#4ade80' }}>{usd(d.v)}</div>
                    <Tag color="#4ade80">Paid ✓</Tag>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}



        {/* ══ CRM ═══════════════════════════════════════════════ */}
        {tab === 'crm' && (() => {
          // ── Filtered list ────────────────────────────────────
          const { search, status, type, country, niche } = crmFilter;
          const filteredCrm = crm.filter(c => {
            if (status  !== 'All' && c.s       !== status)  return false;
            if (type    !== 'All' && c.type     !== type)    return false;
            if (country !== 'All' && c.country  !== country) return false;
            if (niche   !== 'All' && !(c.niche||[]).includes(niche)) return false;
            if (search) {
              const q = search.toLowerCase();
              if (!c.b.toLowerCase().includes(q) && !(c.n||'').toLowerCase().includes(q) && !(c.note||'').toLowerCase().includes(q) && !(c.brands||'').toLowerCase().includes(q)) return false;
            }
            return true;
          });
          // ── Smart outreach (top 4) ───────────────────────────
          const topOutreach = [...filteredCrm]
            .map(c => ({ ...c, _score: crmScore(c) }))
            .filter(c => c._score > 0)
            .sort((a, b) => b._score - a._score)
            .slice(0, 4);
          const activeCount  = crm.filter(c => c.s === 'Active Partner').length;
          const warmCount    = crm.filter(c => c.s === 'Warm Lead').length;
          const paidCount    = crm.filter(c => c.paidDeal).length;
          // ── Edit form ─────────────────────────────────────────
          const EditForm = ({ c }) => (
            <div style={{ padding:'14px 16px', borderBottom:`1px solid ${BDR}`, background:`${OCEAN}44` }}>
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap:8, marginBottom:8 }}>
                <Inp value={crmBuf.b||''} onChange={v=>setCrmBuf(p=>({...p,b:v}))} placeholder="Brand / Agency" />
                <Inp value={crmBuf.n||''} onChange={v=>setCrmBuf(p=>({...p,n:v}))} placeholder="Contact person" />
                <Inp value={crmBuf.e||''} onChange={v=>setCrmBuf(p=>({...p,e:v}))} placeholder="Email" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap:8, marginBottom:8 }}>
                <Sel value={crmBuf.s||'Warm Lead'} onChange={v=>setCrmBuf(p=>({...p,s:v}))} options={CRM_STATUSES} />
                <Sel value={crmBuf.type||'Brand Direct'} onChange={v=>setCrmBuf(p=>({...p,type:v}))} options={CRM_TYPES} />
                <Sel value={crmBuf.country||'United States'} onChange={v=>setCrmBuf(p=>({...p,country:v}))} options={CRM_COUNTRIES} />
                <Inp value={(crmBuf.niche||[]).join(', ')} onChange={v=>setCrmBuf(p=>({...p,niche:v.split(',').map(x=>x.trim()).filter(Boolean)}))} placeholder="Niches (comma separated)" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 2fr', gap:8, marginBottom:10 }}>
                <Inp value={crmBuf.brands||''} onChange={v=>setCrmBuf(p=>({...p,brands:v}))} placeholder="Brands they represent" />
                <Inp value={crmBuf.dealValue||0} onChange={v=>setCrmBuf(p=>({...p,dealValue:parseFloat(v)||0}))} placeholder="Deal value $" />
                <Inp value={crmBuf.last||''} onChange={v=>setCrmBuf(p=>({...p,last:v}))} placeholder="Last contact" />
                <Inp value={crmBuf.note||''} onChange={v=>setCrmBuf(p=>({...p,note:v}))} placeholder="Notes" />
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button onClick={saveCrm} style={{ background:BLUE,color:TEXT,border:'none',borderRadius:8,padding:'8px 18px',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>Save</button>
                <button onClick={() => setEditCrmId(null)} style={{ background:'#F7F9FC',color:TEXT,border:`1px solid ${BDR}`,borderRadius:8,padding:'8px 14px',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>Cancel</button>
                <button onClick={() => { if(window.confirm(`Remove ${c.b}?`)) deleteCrm(c.id); }} style={{ background:'none',color:'#f87171',border:`1px solid #f8717144`,borderRadius:8,padding:'8px 14px',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>Delete</button>
                <label style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,color:SLATE,marginLeft:8,cursor:'pointer' }}>
                  <input type="checkbox" checked={!!crmBuf.paidDeal} onChange={e=>setCrmBuf(p=>({...p,paidDeal:e.target.checked}))} />
                  Paid deal history
                </label>
              </div>
            </div>
          );
          return (
            <div>
              {/* ── Header ── */}
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
                <div>
                  <Label style={{ margin:0 }}>brand crm</Label>
                  <div style={{ fontSize:11,color:SLATE,marginTop:3 }}>{crm.length} contacts · {activeCount} active · {warmCount} warm leads · {paidCount} paid history</div>
                </div>
                <button onClick={() => addCrm()} style={{ background:BLUE,color:TEXT,border:'none',borderRadius:10,padding:'9px 18px',fontWeight:800,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>+ Add Brand</button>
              </div>

              {/* ── Smart Outreach ── */}
              <Card style={{ marginBottom:gutter }}>
                <div style={{ fontSize:10,color:BLUE,textTransform:'uppercase',letterSpacing:'2px',fontWeight:700,marginBottom:12 }}>🎯 Smart Outreach — Top Contacts to Re-engage</div>
                <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:10 }}>
                  {topOutreach.map(c => (
                    <div key={c.id} onClick={() => { setTab('crm'); setTimeout(()=>startEditCrm(c),50); }} style={{ background:`${OCEAN}33`,borderRadius:10,padding:'12px 14px',cursor:'pointer',border:`1px solid ${statusColor(c.s)}44`,transition:'background 0.12s' }}
                      onMouseEnter={e=>e.currentTarget.style.background=`${OCEAN}55`}
                      onMouseLeave={e=>e.currentTarget.style.background=`${OCEAN}33`}>
                      <div style={{ fontSize:12,fontWeight:800,marginBottom:4,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{c.b}</div>
                      <Tag color={statusColor(c.s)} style={{ marginBottom:6 }}>{c.s}</Tag>
                      <div style={{ fontSize:10,color:SLATE,lineHeight:1.5,marginTop:4 }}>{crmWhy(c)}</div>
                      {c.e && c.e !== 'TikTok DM' && c.e !== 'n/a' && <div style={{ fontSize:10,color:BLUE,marginTop:6 }}>{c.e}</div>}
                    </div>
                  ))}
                </div>
              </Card>

              {/* ── Filter bar ── */}
              <div style={{ display:'flex',flexWrap:'wrap',gap:8,marginBottom:14,alignItems:'center' }}>
                <input
                  value={crmFilter.search}
                  onChange={e => setCrmFilter(p=>({...p,search:e.target.value}))}
                  placeholder="Search brand, contact, note…"
                  style={{ background:'#FFFFFF',border:`1px solid ${BDR}`,borderRadius:8,padding:'8px 12px',color:TEXT,fontSize:12,fontFamily:'inherit',flex:1,minWidth:160,outline:'none' }}
                />
                {[
                  ['status',  ['All','Active Partner','Warm Lead','Cold','Declined']],
                  ['type',    ['All',...CRM_TYPES]],
                  ['country', ['All',...CRM_COUNTRIES]],
                  ['niche',   ['All',...CRM_NICHES]],
                ].map(([key, opts]) => (
                  <select key={key} value={crmFilter[key]} onChange={e=>setCrmFilter(p=>({...p,[key]:e.target.value}))}
                    style={{ background:'#FFFFFF',border:`1px solid ${BDR}`,borderRadius:8,padding:'7px 10px',color:crmFilter[key]==='All'?SLATE:'#fff',fontSize:11,fontFamily:'inherit',cursor:'pointer',outline:'none' }}>
                    {opts.map(o => <option key={o} value={o}>{key==='status'&&o==='All'?'All Statuses':key==='type'&&o==='All'?'All Types':key==='country'&&o==='All'?'All Countries':key==='niche'&&o==='All'?'All Niches':o}</option>)}
                  </select>
                ))}
                {(crmFilter.search||crmFilter.status!=='All'||crmFilter.type!=='All'||crmFilter.country!=='All'||crmFilter.niche!=='All') && (
                  <button onClick={()=>setCrmFilter({search:'',status:'All',type:'All',country:'All',niche:'All'})} style={{ background:'none',border:`1px solid #555`,borderRadius:8,padding:'7px 12px',color:'#94A3B8',fontSize:11,cursor:'pointer',fontFamily:'inherit' }}>✕ Clear</button>
                )}
                <div style={{ fontSize:11,color:SLATE,whiteSpace:'nowrap' }}>{filteredCrm.length} of {crm.length}</div>
              </div>

              {/* ── Contact list ── */}
              {isMobile ? (
                <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                  {filteredCrm.map(c => (
                    editCrmId === c.id
                      ? <Card key={c.id} style={{ border:`1px solid ${BLUE}44` }}><EditForm c={c}/></Card>
                      : (
                        <Card key={c.id}>
                          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8 }}>
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ fontSize:14,fontWeight:800,marginBottom:4 }}>{c.b}</div>
                              <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginBottom:6 }}>
                                <Tag color={statusColor(c.s)}>{c.s}</Tag>
                                <Tag color={OCEAN}>{c.type?.replace(' Agency','')?.replace(' Portal','')}</Tag>
                                {c.paidDeal && <Tag color='#96C9AA'>💰 Paid</Tag>}
                              </div>
                            </div>
                            <button onClick={() => startEditCrm(c)} style={{ background:'none',border:`1px solid #2a2a2a`,borderRadius:7,padding:'5px 10px',color:'#94A3B8',fontSize:12,cursor:'pointer',fontFamily:'inherit',flexShrink:0 }}>✏</button>
                          </div>
                          {c.n && c.n !== '—' && <div style={{ fontSize:11,color:'#94A3B8',marginBottom:3 }}>👤 {c.n}</div>}
                          {c.e && c.e !== '—' && c.e !== 'TikTok DM' && c.e !== 'n/a' && <div style={{ fontSize:11,color:BLUE,marginBottom:3 }}>{c.e}</div>}
                          <div style={{ display:'flex',gap:10,flexWrap:'wrap',marginBottom:6 }}>
                            {(c.niche||[]).slice(0,3).map(n=><Tag key={n} color={SLATE}>{n}</Tag>)}
                            {c.dealValue > 0 && <Tag color='#D9D0A0'>${c.dealValue.toLocaleString()}</Tag>}
                            <div style={{ fontSize:10,color:'#64748B' }}>{c.country}</div>
                          </div>
                          <div style={{ fontSize:11,color:'#94A3B8',lineHeight:1.5 }}>{c.last && `Last: ${c.last} · `}{c.note}</div>
                        </Card>
                      )
                  ))}
                </div>
              ) : (
                <div style={{ background:CARD,border:`1px solid ${BDR}`,borderRadius:14,overflow:'hidden' }}>
                  <div style={{ display:'grid',gridTemplateColumns:'1.2fr 0.9fr 0.8fr 0.7fr 1fr 0.8fr 1.5fr 0.3fr',padding:'10px 16px',fontSize:9,color:'#2E4A66',textTransform:'uppercase',letterSpacing:'2px',fontWeight:600,borderBottom:`1px solid ${BDR}`,background:'#F0F4F8' }}>
                    {['Brand','Type','Status','Country','Niche','Last Contact','Notes / Email',''].map(h=><div key={h}>{h}</div>)}
                  </div>
                  {filteredCrm.map((c,i) => (
                    editCrmId === c.id
                      ? <div key={c.id}><EditForm c={c}/></div>
                      : (
                        <div key={c.id} style={{ display:'grid',gridTemplateColumns:'1.2fr 0.9fr 0.8fr 0.7fr 1fr 0.8fr 1.5fr 0.3fr',padding:'12px 16px',borderBottom:`1px solid ${OCEAN}22`,background:i%2===0?`${OCEAN}11`:'transparent',alignItems:'center',gap:4 }}>
                          <div>
                            <div style={{ fontSize:12,fontWeight:700 }}>{c.b}</div>
                            {c.paidDeal && <div style={{ fontSize:9,color:'#96C9AA',marginTop:2 }}>💰 Paid history</div>}
                          </div>
                          <div style={{ fontSize:10,color:SLATE }}>{c.type}</div>
                          <Tag color={statusColor(c.s)}>{c.s}</Tag>
                          <div style={{ fontSize:10,color:SLATE }}>{c.country}</div>
                          <div style={{ display:'flex',flexWrap:'wrap',gap:3 }}>{(c.niche||[]).slice(0,2).map(n=><Tag key={n} color={OCEAN} style={{fontSize:9,padding:'2px 6px'}}>{n}</Tag>)}</div>
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                              {c.lastDate && (() => {
                                const days = Math.floor((Date.now() - new Date(c.lastDate)) / 86400000);
                                const dot = days >= 60
                                  ? { bg:'#A32D2D', msg:`${days} days since last contact — consider following up` }
                                  : days >= 30
                                  ? { bg:'#C8A84B', msg:`${days} days since last contact — consider following up` }
                                  : null;
                                return dot ? <div title={dot.msg} style={{ width:7, height:7, borderRadius:'50%', background:dot.bg, flexShrink:0, cursor:'help' }} /> : null;
                              })()}
                              <div style={{ fontSize:10, color:'#94A3B8' }}>{c.last||'—'}</div>
                            </div>
                            {c.dealValue > 0 && <div style={{ fontSize:9,color:'#D9D0A0',marginTop:2 }}>${c.dealValue.toLocaleString()}</div>}
                          </div>
                          <div style={{ fontSize:10,color:'#64748B',lineHeight:1.5,overflow:'hidden' }}>
                            {c.e && c.e !== '—' && c.e !== 'TikTok DM' && c.e !== 'n/a' && <div style={{ color:BLUE,marginBottom:2 }}>{c.e}</div>}
                            <div style={{ overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.note}</div>
                          </div>
                          <button onClick={()=>startEditCrm(c)} style={{ background:'none',border:`1px solid #2a2a2a`,borderRadius:7,padding:'5px 8px',color:'#94A3B8',fontSize:11,cursor:'pointer',fontFamily:'inherit' }}>✏</button>
                        </div>
                      )
                  ))}
                  {filteredCrm.length === 0 && (
                    <div style={{ textAlign:'center',padding:'40px 20px',color:SLATE,fontSize:12 }}>No contacts match your filters.</div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ══ DELIVERABLES ══════════════════════════════════════ */}
        {tab === 'deliverables' && (
          <div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
              <Label>deliverables hub</Label>
              <button onClick={addDeliv} style={{ background:BLUE,color:TEXT,border:'none',borderRadius:10,padding:'9px 18px',fontWeight:800,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>
                + Add
              </button>
            </div>

            {isMobile ? (
              /* Mobile: card layout */
              <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                {delivs.map(d => (
                  editDelivId === d.id ? (
                    <Card key={d.id} style={{ border:`1px solid ${BLUE}44` }}>
                      <div style={{ display:'flex',flexDirection:'column',gap:10,marginBottom:12 }}>
                        <Inp value={delivBuf.b||''} onChange={v=>setDelivBuf(p=>({...p,b:v}))} placeholder="Brand" />
                        <Inp value={delivBuf.sc||''} onChange={v=>setDelivBuf(p=>({...p,sc:v}))} placeholder="Notes" />
                        <Inp value={delivBuf.d||''} onChange={v=>setDelivBuf(p=>({...p,d:v}))} placeholder="Due date" />
                        <Sel value={delivBuf.s||'Pitching'} onChange={v=>setDelivBuf(p=>({...p,s:v}))} options={DELIV_STATUSES} />
                        <Inp value={delivBuf.pl||''} onChange={v=>setDelivBuf(p=>({...p,pl:v}))} placeholder="Platform" />
                        <Inp value={delivBuf.pay||''} onChange={v=>setDelivBuf(p=>({...p,pay:v}))} placeholder="Rate" />
                      </div>
                      <div style={{ display:'flex',gap:8 }}>
                        <button onClick={saveDeliv} style={{ flex:1,background:BLUE,color:TEXT,border:'none',borderRadius:8,padding:'10px',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>Save</button>
                        <button onClick={() => setEditDelivId(null)} style={{ background:'#F7F9FC',color:TEXT,border:`1px solid ${BDR}`,borderRadius:8,padding:'10px 14px',fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>Cancel</button>
                        <button onClick={() => { if(window.confirm(`Remove?`)) deleteDeliv(d.id); }} style={{ background:'none',color:'#f87171',border:`1px solid #f8717144`,borderRadius:8,padding:'10px 14px',fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>Del</button>
                      </div>
                    </Card>
                  ) : (
                    <Card key={d.id}>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10 }}>
                        <div>
                          <div style={{ fontSize:15,fontWeight:700,marginBottom:6 }}>{d.b}</div>
                          <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                            <Tag color={statusColor(d.s)}>{d.s}</Tag>
                            <Tag color="#666">{d.pl}</Tag>
                          </div>
                        </div>
                        <button onClick={() => startEditDeliv(d)} style={{ background:'none',border:`1px solid #2a2a2a`,borderRadius:7,padding:'5px 10px',color:'#94A3B8',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>✏</button>
                      </div>
                      <div style={{ fontSize:12,color:'#94A3B8',marginBottom:6 }}>{d.sc}</div>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                        <div style={{ fontSize:12,color:YELL }}>{d.d !== 'TBC' ? `Due: ${d.d}` : 'TBC'}</div>
                        <div style={{ fontSize:16,fontWeight:800,color:BLUE }}>{d.pay}</div>
                      </div>
                    </Card>
                  )
                ))}
              </div>
            ) : (
              /* Desktop: table */
              <div style={{ background:CARD,border:`1px solid ${BDR}`,borderRadius:14,overflow:'hidden' }}>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1.5fr 0.6fr 1.2fr 1.2fr 0.8fr 0.35fr',padding:'10px 20px',fontSize:9,color:'#2E4A66',textTransform:'uppercase',letterSpacing:'2px',fontWeight:600,borderBottom:`1px solid ${BDR}`,background:'#F0F4F8' }}>
                  {['Brand','Notes / Script','Due','Status','Platform','Rate',''].map(h => <div key={h}>{h}</div>)}
                </div>
                {delivs.map((d, i) => (
                  editDelivId === d.id ? (
                    <div key={d.id} style={{ padding:'14px 20px',borderBottom:`1px solid ${BDR}`,background:`${OCEAN}55` }}>
                      <div style={{ display:'grid',gridTemplateColumns:'1fr 1.5fr 0.6fr 1.2fr 1.2fr 0.8fr',gap:8,marginBottom:10 }}>
                        <Inp value={delivBuf.b||''} onChange={v=>setDelivBuf(p=>({...p,b:v}))} placeholder="Brand" />
                        <Inp value={delivBuf.sc||''} onChange={v=>setDelivBuf(p=>({...p,sc:v}))} placeholder="Notes" />
                        <Inp value={delivBuf.d||''} onChange={v=>setDelivBuf(p=>({...p,d:v}))} placeholder="Due" />
                        <Sel value={delivBuf.s||'Pitching'} onChange={v=>setDelivBuf(p=>({...p,s:v}))} options={DELIV_STATUSES} />
                        <Inp value={delivBuf.pl||''} onChange={v=>setDelivBuf(p=>({...p,pl:v}))} placeholder="Platform" />
                        <Inp value={delivBuf.pay||''} onChange={v=>setDelivBuf(p=>({...p,pay:v}))} placeholder="Rate" />
                      </div>
                      <div style={{ display:'flex',gap:8 }}>
                        <button onClick={saveDeliv} style={{ background:BLUE,color:TEXT,border:'none',borderRadius:8,padding:'8px 18px',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>Save</button>
                        <button onClick={() => setEditDelivId(null)} style={{ background:'#F7F9FC',color:TEXT,border:`1px solid ${BDR}`,borderRadius:8,padding:'8px 14px',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>Cancel</button>
                        <button onClick={() => { if(window.confirm(`Remove ${d.b}?`)) deleteDeliv(d.id); }} style={{ background:'none',color:'#f87171',border:`1px solid #f8717144`,borderRadius:8,padding:'8px 14px',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>Delete</button>
                      </div>
                    </div>
                  ) : (
                    <div key={d.id} style={{ display:'grid',gridTemplateColumns:'1fr 1.5fr 0.6fr 1.2fr 1.2fr 0.8fr 0.35fr',padding:'16px 20px',borderBottom:`1px solid ${OCEAN}44`,background:i%2===0?`${OCEAN}22`:'transparent',alignItems:'center' }}>
                      <div style={{ fontSize:13,fontWeight:700 }}>{d.b}</div>
                      <div style={{ fontSize:11,color:'#94A3B8' }}>{d.sc}</div>
                      <div style={{ fontSize:12,color:YELL,fontWeight:600 }}>{d.d}</div>
                      <Tag color={statusColor(d.s)}>{d.s}</Tag>
                      <div style={{ fontSize:12,color:'#94A3B8' }}>{d.pl}</div>
                      <div style={{ fontSize:12,color:BLUE,fontWeight:700 }}>{d.pay}</div>
                      <button onClick={() => startEditDeliv(d)} style={{ background:'none',border:`1px solid #2a2a2a`,borderRadius:7,padding:'5px 9px',color:'#94A3B8',fontSize:11,cursor:'pointer',fontFamily:'inherit' }}>✏</button>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ AUDIENCE ════════════════════════════════════════ */}
        {tab === 'audience' && (() => {
          // ── Static audience data (from Audience Deep Dive PDF + platform analytics) ──
          const TIKTOK_AGE  = [{ label:'25–34', pct:42 },{ label:'35–44', pct:31 },{ label:'45–54', pct:12 },{ label:'18–24', pct:8 },{ label:'55+', pct:7 }];
          const TIKTOK_GEO  = [{ label:'Australia', pct:45, flag:'🇦🇺' },{ label:'United States', pct:35, flag:'🇺🇸' },{ label:'Canada', pct:12, flag:'🇨🇦' },{ label:'United Kingdom', pct:8, flag:'🇬🇧' }];
          const IG_AGE      = [{ label:'25–34', pct:38 },{ label:'35–44', pct:29 },{ label:'18–24', pct:16 },{ label:'45–54', pct:11 },{ label:'55+', pct:6 }];
          const IG_GEO      = [{ label:'Australia', pct:41, flag:'🇦🇺' },{ label:'United States', pct:38, flag:'🇺🇸' },{ label:'Canada', pct:11, flag:'🇨🇦' },{ label:'United Kingdom', pct:10, flag:'🇬🇧' }];
          const YT_AGE      = [{ label:'25–34', pct:36 },{ label:'35–44', pct:28 },{ label:'18–24', pct:18 },{ label:'45–54', pct:13 },{ label:'55+', pct:5 }];
          const YT_GEO      = [{ label:'United States', pct:44, flag:'🇺🇸' },{ label:'Australia', pct:28, flag:'🇦🇺' },{ label:'Canada', pct:14, flag:'🇨🇦' },{ label:'United Kingdom', pct:14, flag:'🇬🇧' }];
          const COMBINED_AGE= [{ label:'25–34', pct:39 },{ label:'35–44', pct:29 },{ label:'18–24', pct:14 },{ label:'45–54', pct:12 },{ label:'55+', pct:6 }];
          const COMBINED_GEO= [{ label:'Australia', pct:38, flag:'🇦🇺' },{ label:'United States', pct:39, flag:'🇺🇸' },{ label:'Canada', pct:13, flag:'🇨🇦' },{ label:'United Kingdom', pct:10, flag:'🇬🇧' }];

          const SHOWCASE_CREATORS = [
            { name:'Jordan Worobe',     handle:'@jordanworobe',     platform:'TikTok/YT',  niche:'Budget Travel',         why:'Deadpan cost-breakdown style mirrors your format exactly. AU/US audience overlap.',            url:'https://www.tiktok.com/@jordanworobe' },
            { name:'Kara and Nate',     handle:'@karaandnate',      platform:'YouTube',    niche:'Long-term Travel',      why:'Proves your 35–44 demo follows creators who show real logistics + costs, not highlight reels.',  url:'https://www.youtube.com/@karaandnate' },
            { name:'Lost LeBlancs',     handle:'@lostleblancs',     platform:'YouTube/IG', niche:'Travel Lifestyle',      why:'Same AU/US geography split. Their audience trusts them like a friend, not a brand.',             url:'https://www.youtube.com/@lostleblancs' },
            { name:'Drew Binsky',       handle:'@drewbinsky',       platform:'TikTok/YT',  niche:'Country Deep-Dives',    why:'Specificity-first storytelling. "X country costs $Y" format your audience craves.',             url:'https://www.tiktok.com/@drewbinsky' },
            { name:'Nas Daily',         handle:'@nasdaily',         platform:'TikTok/YT',  niche:'Punchy Edu Travel',     why:'1-min format + one concrete insight per video. Perfect model for your Educational Travel pillar.',url:'https://www.tiktok.com/@nasdaily' },
            { name:'Yes Theory',        handle:'@yestheory',        platform:'YouTube',    niche:'Lifestyle/Adventure',   why:'Resonates with the "permission to do things differently" desire your audience has deeply.',       url:'https://www.youtube.com/@yestheory' },
            { name:'Hamish Blake',      handle:'@hamishblake',      platform:'Instagram',  niche:'Aus Humour/Life',       why:'Deadpan AU humour that doesn\'t try too hard. Your audience respects this tone.',               url:'https://www.instagram.com/hamishblake' },
            { name:'Zach King',         handle:'@zachking',         platform:'TikTok',     niche:'Creative Storytelling', why:'Hooks in the first 2 sec. Your 25–44 demo are extremely hook-trained — study his structure.',    url:'https://www.tiktok.com/@zachking' },
          ];

          const FRUSTRATIONS = [
            { icon:'💸', title:'Cost of living anxiety',    desc:'Navigating expensive cities in AU and US. They respond to cost transparency above anything else.' },
            { icon:'😔', title:'Feeling behind',            desc:'Career, money, travel, relationships — like everyone else figured it out already.' },
            { icon:'🌀', title:'Decision paralysis',        desc:'Too many options, too little clarity on what\'s actually worth doing, spending, or visiting.' },
            { icon:'🚩', title:'Bad recommendations',       desc:'Burned by products and destinations that didn\'t deliver. They\'re skeptical — and they should be.' },
            { icon:'🤖', title:'AI slop & over-polish',     desc:'They can smell a pitch in the first frame and immediately scroll. They want a person, not a brand.' },
            { icon:'⏰', title:'Getting older with no map', desc:'Still figuring out the basics. Content that validates non-traditional choices hits hard.' },
          ];
          const DESIRES = [
            { icon:'🧾', title:'Shortcuts with receipts',        desc:'"Here\'s exactly what I did and what it cost." Not tips — evidence. A number makes it real.' },
            { icon:'🗝️', title:'Permission to be different',      desc:'Travel hacks, unconventional choices, non-traditional lifestyle validated by someone who lived it.' },
            { icon:'😌', title:'Feel seen, not preached at',      desc:'Deadpan and dry humor works because they\'re over sincerity-performance. Trust feels unscripted.' },
            { icon:'🎉', title:'Fun AND useful',                  desc:'43% value fun, 29% informative. Your deadpan + useful format is almost perfectly calibrated.' },
            { icon:'🏆', title:'Feel like the smartest in the room', desc:'Content they can share at dinner. Something they know that others don\'t.' },
          ];
          const TRUST_KILLERS = [
            'Opening with "okay so" and saying nothing for 5 seconds',
            'Generic hooks that could apply to anyone ("this changed my life")',
            'Advice without evidence — tips need receipts',
            'Anything that feels written for a brand brief, not a person',
            'Listing things without telling them what to DO with the information',
            'Ending without a scroll loop — they need a reason to stay',
          ];
          const PILLARS = [
            { icon:'✈️', name:'Educational Travel',    hook:'"I spent 2 weeks in [country] on $X. Here\'s the actual breakdown nobody tells you."', why:'The word "actual" signals you\'re cutting through BS. Your AU audience responds to cost transparency because Australian travel prices are punishing. Lead with a number. Always.', stop:'Specificity + cost + the promise you won\'t waste their time with vibes-only content.' },
            { icon:'🐶', name:'Pet Experiments',       hook:'"I let my dog decide [X] and the results were not okay."',                              why:'Fear + curiosity + humor. 25–44 is peak pet parent age. They anthropomorphize their animals and feel guilty. The phrase "not okay" does comedic and emotional work simultaneously.',        stop:'The absurdity of the premise + the guilt hook for anyone who\'s ever wondered if their dog is judging them.' },
            { icon:'🎙️', name:'Personal Storytimes',  hook:'"I didn\'t tell anyone about this for [X months] because…"',                           why:'Secrecy hook creates immediate intimacy. Your deadpan delivery makes confessional content feel trustworthy, not performative. They feel like you chose to tell them.',               stop:'The implication they\'re about to hear something real that most people don\'t share.' },
            { icon:'💡', name:'Relatable/Actionable', hook:'"The thing that actually [fixed/changed] my [X] cost $12."',                            why:'Specificity + low barrier. "Actually" + a price point signals real experience. This pillar underperforms when generic — the fix is always specificity with a number.',                stop:'The price creates instant curiosity. "Actually" signals this isn\'t another listicle.' },
          ];

          // Bar chart helper
          const BarChart = ({ data, color }) => (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {data.map(({ label, pct, flag }) => (
                <div key={label}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:11 }}>
                    <span style={{ color:'#2E4A66' }}>{flag ? `${flag} ${label}` : label}</span>
                    <span style={{ color, fontWeight:700 }}>{pct}%</span>
                  </div>
                  <div style={{ background:'#E0E6EF', borderRadius:4, height:6, overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:4, background:color, width:`${pct}%`, transition:'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          );

          const GenderBar = ({ male, female }) => (
            <div>
              <div style={{ display:'flex', borderRadius:8, overflow:'hidden', height:28, marginBottom:8 }}>
                <div style={{ width:`${male}%`, background:'#88EAF6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#1A2744' }}>{male}%</div>
                <div style={{ width:`${female}%`, background:'#E1306C', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:TEXT }}>{female}%</div>
              </div>
              <div style={{ display:'flex', gap:16, fontSize:10, color:SLATE }}>
                <span style={{ color:'#88EAF6' }}>■ Male {male}%</span>
                <span style={{ color:'#E1306C' }}>■ Female {female}%</span>
              </div>
            </div>
          );

          const PlatformDemoCard = ({ logo: Logo, name, color, ageData, geoData, maleP, femaleP, followers, note }) => (
            <Card>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <Logo size={20} />
                <Label style={{ margin:0 }}>{name}</Label>
                <Tag color={color}>~{fmtFull(followers)} followers</Tag>
                {note && <Tag color={SLATE}>{note}</Tag>}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:16 }}>
                <div>
                  <div style={{ fontSize:9, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:10 }}>Age Breakdown</div>
                  <BarChart data={ageData} color={color} />
                </div>
                <div>
                  <div style={{ fontSize:9, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:10 }}>Top Markets</div>
                  <BarChart data={geoData} color={color} />
                  <div style={{ marginTop:14 }}>
                    <div style={{ fontSize:9, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:8 }}>Gender Split</div>
                    <GenderBar male={maleP} female={femaleP} />
                  </div>
                </div>
              </div>
            </Card>
          );

          const ytVidsTop  = (ytAnalytics?.videos  || []).slice(0, 4);
          const igPostsTop = (igAnalytics?.posts    || []).sort((a,b) => (b.reach||0)-(a.reach||0)).slice(0, 4);
          const ttVidsTop  = (ttAnalytics?.videos   || []).slice(0, 4);

          return (
            <div style={{ display:'flex', flexDirection:'column', gap:12, padding:isMobile?'0 12px 24px':'0 0 24px' }}>

              {/* ── Header ── */}
              <div style={{ background:'#FFFFFF', borderRadius:10, padding:'24px 28px', border:'1px solid #CDD4E0', marginBottom:4 }}>
                <div style={{ fontSize:9, color:BLUE, textTransform:'uppercase', letterSpacing:'3px', fontWeight:700, marginBottom:8 }}>Audience Intelligence</div>
                <div style={{ fontSize:isMobile?22:28, fontWeight:900, lineHeight:1.2, marginBottom:10, color:'#1A2744' }}>Who's Actually Watching</div>
                <div style={{ fontSize:13, color:'#2E4A66', lineHeight:1.7, maxWidth:640 }}>
                  Elder millennials and younger Gen X — ages 28–42 — juggling real life with real money and real decision fatigue. They don't discover content. They let it find them. Your hook has 2 seconds to earn the rest of their time.
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:16 }}>
                  {[
                    { label:'Combined Reach', val:`${fmtFull((ytSubs||0)+(igFollowers||0)+(ttFollowers||0))}+` },
                    { label:'Core Age', val:'25–44' },
                    { label:'Top Market', val:'AU + US' },
                    { label:'Trust Signal', val:'60% creator > ad' },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ background:'#EEF9FD', border:'1px solid #88EAF6', borderRadius:8, padding:'10px 14px', textAlign:'center', minWidth:100 }}>
                      <div style={{ fontSize:9, color:'#0E6A80', textTransform:'uppercase', letterSpacing:'1px', fontWeight:700, marginBottom:4 }}>{label}</div>
                      <div style={{ fontSize:16, fontWeight:900, color:'#1A2744' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Persona Card ── */}
              <Card>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg, ${OCEAN}, #69C9D044)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>👤</div>
                  <div>
                    <Label style={{ margin:0 }}>Meet Your Audience</Label>
                    <div style={{ fontSize:11, color:SLATE }}>Composite persona · Elder Millennial / Young Gen X</div>
                  </div>
                </div>

                {/* Persona hero */}
                <div style={{ background:'#FFFFFF', borderRadius:8, padding:'20px 24px', border:'1px solid #CDD4E0', marginBottom:16 }}>
                  <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'2fr 1fr', gap:20 }}>
                    <div>
                      <div style={{ fontSize:22, fontWeight:900, marginBottom:4 }}>Alex, 28–42</div>
                      <div style={{ fontSize:13, color:BLUE, fontWeight:700, marginBottom:12 }}>Elder Millennial / Young Gen X · Sydney, Melbourne, New York, or LA</div>
                      <div style={{ fontSize:13, color:'#4A6080', lineHeight:1.8 }}>
                        Alex has a real job, real bills, and a dog they treat like a small person. They're not broke — they're cost-conscious. They're done with aspirational content that shows them what they can't have and actively look for creators who show them what's actually possible, what it actually costs, and whether it's actually worth it.
                        <br/><br/>
                        They spend ~40 minutes on TikTok daily, mostly passive. They don't comment often, but when something hits — they save it, share it, and follow. What hooks them on TikTok they'll follow to Instagram. What they trust there, they'll subscribe to on YouTube.
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {[
                        { label:'Daily TikTok', val:'~40 min' },
                        { label:'Creator trust', val:'60% > ads' },
                        { label:'Content pref', val:'Fun 43% · Info 29%' },
                        { label:'Platform path', val:'TT → IG → YT' },
                        { label:'Spending mode', val:'Cost-conscious' },
                        { label:'Household', val:'Often has a pet' },
                      ].map(({ label, val }) => (
                        <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:'#EEF9FD', borderRadius:6 }}>
                          <span style={{ fontSize:11, color:'#1A2744' }}>{label}</span>
                          <span style={{ fontSize:11, fontWeight:700, color:BLUE }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Frustrations + Desires */}
                <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:12, marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:9, color:'#1A2744', textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:10 }}>😤 What Frustrates Them</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {FRUSTRATIONS.map(({ icon, title, desc }) => (
                        <div key={title} style={{ background:'#FFFFFF', border:'1px solid #CDD4E0', borderRadius:0, padding:'10px 12px', borderLeft:'3px solid #D85A30' }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'#1A2744', marginBottom:3 }}>{icon} {title}</div>
                          <div style={{ fontSize:11, color:'#4A6080', lineHeight:1.5 }}>{desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:9, color:'#1A2744', textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:10 }}>💭 What They Actually Want</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {DESIRES.map(({ icon, title, desc }) => (
                        <div key={title} style={{ background:'#FFFFFF', border:'1px solid #CDD4E0', borderRadius:0, padding:'10px 12px', borderLeft:'3px solid #88EAF6' }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'#1A2744', marginBottom:3 }}>{icon} {title}</div>
                          <div style={{ fontSize:11, color:'#4A6080', lineHeight:1.5 }}>{desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Trust formula */}
                <div style={{ background:'#EEF9FD', borderRadius:8, padding:'16px 18px', border:'1px solid #CDD4E0' }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'#1A2744', marginBottom:8 }}>🔑 The Trust Formula That Works On This Audience</div>
                  <div style={{ fontSize:13, color:'#2E4A66', lineHeight:1.7 }}>
                    <strong style={{ color:BLUE }}>Real experience framing</strong> ("I noticed," "my score was") + <strong style={{ color:BLUE }}>one specific data point</strong> (a number, a cost, a date) + <strong style={{ color:BLUE }}>a reaction that feels unscripted</strong> = comment section opens up.
                  </div>
                  <div style={{ marginTop:12, fontSize:11, color:SLATE, lineHeight:1.6 }}>
                    They don't trust polish. They trust specificity + personality + evidence. Your "best friend on the couch" tone is the right container — the job is making sure every video has one concrete thing they can't get from a Google search.
                  </div>
                </div>
              </Card>

              {/* ── Cross-platform combined demographics ── */}
              <Card>
                <Label>Cross-Platform Combined Demographics</Label>
                <div style={{ fontSize:11, color:SLATE, marginBottom:16 }}>Weighted average across YouTube · Instagram · TikTok</div>
                <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:20 }}>
                  <div>
                    <div style={{ fontSize:9, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:10 }}>Age Breakdown</div>
                    <BarChart data={COMBINED_AGE} color={BLUE} />
                  </div>
                  <div>
                    <div style={{ fontSize:9, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:10 }}>Top Markets</div>
                    <BarChart data={COMBINED_GEO} color={YELL} />
                    <div style={{ marginTop:14 }}>
                      <div style={{ fontSize:9, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:8 }}>Combined Gender Split</div>
                      <GenderBar male={53} female={47} />
                    </div>
                  </div>
                </div>
              </Card>

              {/* ── Per-platform demographics ── */}
              <div style={{ fontSize:10, color:SLATE, fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', padding:'4px 0 2px' }}>Platform Breakdowns</div>

              <PlatformDemoCard logo={YTLogo}  name="YouTube"   color='#FF0000' ageData={YT_AGE}  geoData={YT_GEO}  maleP={56} femaleP={44} followers={ytSubs||51000}    />
              <PlatformDemoCard logo={IGLogo}  name="Instagram" color='#E1306C' ageData={IG_AGE}  geoData={IG_GEO}  maleP={51} femaleP={49} followers={igFollowers||50100} note="token refresh needed" />
              <PlatformDemoCard logo={TTLogo}  name="TikTok"    color='#69C9D0' ageData={TIKTOK_AGE} geoData={TIKTOK_GEO} maleP={53} femaleP={47} followers={ttFollowers||50900} note={ttAnalytics?'Live':'PDF data'} />

              {/* ── What They're Watching ── */}
              <Card>
                <Label>What They're Watching — Your Top Content By Platform</Label>
                <div style={{ fontSize:11, color:SLATE, marginBottom:16 }}>Your audience's proven favourites — use these as creative benchmarks for what to make more of</div>

                {/* YouTube */}
                {ytVidsTop.length > 0 && (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                      <YTLogo size={16} />
                      <div style={{ fontSize:10, color:'#FF0000', textTransform:'uppercase', letterSpacing:'2px', fontWeight:700 }}>YouTube — Top Videos</div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:10 }}>
                      {ytVidsTop.map(v => {
                        const hook = detectHookType(v.title);
                        return (
                          <div key={v.id} onClick={() => setSelectedYtVideo(v)} style={{ background:'#F7F9FC', borderRadius:8, padding:'12px 14px', border:'1px solid #CDD4E0', cursor:'pointer', transition:'background 0.12s' }}
                            onMouseEnter={e => e.currentTarget.style.background='#EEF9FD'}
                            onMouseLeave={e => e.currentTarget.style.background='#F7F9FC'}>
                            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                              {v.thumbnail && <img src={v.thumbnail} alt="" style={{ width:64, height:36, borderRadius:4, objectFit:'cover', flexShrink:0 }} />}
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:12, fontWeight:600, lineHeight:1.4, marginBottom:6 }}>{v.title.length>65?v.title.slice(0,65)+'…':v.title}</div>
                                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                                  <span style={{ fontSize:11, color:TEXT, fontWeight:700 }}>▶ {fmtViews(v.viewCount)}</span>
                                  <span style={{ fontSize:11, color:YELL }}>♥ {fmtViews(v.likeCount)}</span>
                                  <span style={{ fontSize:11, color:SLATE }}>{v.engagementRate}% eng</span>
                                  <HookTag hook={hook} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {ytVidsTop.length === 0 && (
                  <div style={{ background:'#F7F9FC', borderRadius:8, padding:'12px 16px', marginBottom:16, fontSize:12, color:'#4A6080' }}>
                    <YTLogo size={14} style={{ display:'inline', marginRight:6 }} /> YouTube analytics loading — go to Analytics tab to fetch data first.
                  </div>
                )}

                {/* Instagram */}
                {igPostsTop.length > 0 && (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                      <IGLogo size={16} />
                      <div style={{ fontSize:10, color:'#E1306C', textTransform:'uppercase', letterSpacing:'2px', fontWeight:700 }}>Instagram — Top Posts by Reach</div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:10 }}>
                      {igPostsTop.map(p => {
                        const hook = detectHookType(p.caption||'');
                        return (
                          <a key={p.id} href={p.permalink} target="_blank" rel="noopener noreferrer" style={{ background:'#F7F9FC', borderRadius:8, padding:'12px 14px', border:'1px solid #CDD4E0', textDecoration:'none', color:'inherit', display:'block', transition:'background 0.12s' }}
                            onMouseEnter={e => e.currentTarget.style.background='#EEF9FD'}
                            onMouseLeave={e => e.currentTarget.style.background='#F7F9FC'}>
                            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                              {p.thumbnail && <img src={p.thumbnail} alt="" style={{ width:44, height:44, borderRadius:6, objectFit:'cover', flexShrink:0 }} />}
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:12, fontWeight:600, lineHeight:1.4, marginBottom:6 }}>{(p.caption||`(${p.mediaType})`).slice(0,65)}{(p.caption||'').length>65?'…':''}</div>
                                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                                  <span style={{ fontSize:11, color:TEXT, fontWeight:700 }}>👁 {fmtViews(p.reach||0)}</span>
                                  <span style={{ fontSize:11, color:YELL }}>♥ {fmtViews(p.likeCount)}</span>
                                  <span style={{ fontSize:11, color:SLATE }}>{p.computedEngRate||p.engagementRate||0}% eng</span>
                                  <HookTag hook={hook} />
                                </div>
                              </div>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
                {igPostsTop.length === 0 && (
                  <div style={{ background:'#F7F9FC', borderRadius:8, padding:'12px 16px', marginBottom:16, fontSize:12, color:'#4A6080' }}>
                    <IGLogo size={14} style={{ display:'inline', marginRight:6 }} /> Instagram token needs refreshing — fix in Analytics tab first, then come back here.
                  </div>
                )}

                {/* TikTok */}
                {ttVidsTop.length > 0 && (
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                      <TTLogo size={16} />
                      <div style={{ fontSize:10, color:'#69C9D0', textTransform:'uppercase', letterSpacing:'2px', fontWeight:700 }}>TikTok — Top Videos by Views</div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:10 }}>
                      {ttVidsTop.map(v => {
                        const hook = detectHookType(v.title);
                        return (
                          <div key={v.id} style={{ background:'#0a1a1a', borderRadius:10, padding:'12px 14px', border:'1px solid #69C9D033' }}>
                            <div style={{ fontSize:12, fontWeight:600, lineHeight:1.4, marginBottom:6 }}>{v.title.length>70?v.title.slice(0,70)+'…':v.title}</div>
                            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                              <span style={{ fontSize:11, color:TEXT, fontWeight:700 }}>▶ {fmtViews(v.viewCount)}</span>
                              <span style={{ fontSize:11, color:YELL }}>♥ {fmtViews(v.likeCount)}</span>
                              <span style={{ fontSize:11, color:SLATE }}>{v.engagementRate}% eng</span>
                              <HookTag hook={hook} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {ttVidsTop.length === 0 && (
                  <div style={{ background:'#0a1a1a', borderRadius:10, padding:'12px 16px', fontSize:12, color:SLATE }}>
                    <TTLogo size={14} style={{ display:'inline', marginRight:6 }} /> TikTok not connected yet — set up credentials in Analytics tab to unlock this section.
                  </div>
                )}
              </Card>

              {/* ── Showcase Creators ── */}
              <Card>
                <Label>Showcase Creators — Who Your Audience Also Watches</Label>
                <div style={{ fontSize:11, color:SLATE, marginBottom:16 }}>Creators making content your audience engages with. Study their hooks, formats, and tone for inspiration.</div>
                <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':' repeat(2, 1fr)', gap:10 }}>
                  {SHOWCASE_CREATORS.map(({ name, handle, platform, niche, why, url }) => (
                    <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                      style={{ background:`${OCEAN}18`, borderRadius:12, padding:'14px 16px', border:`1px solid ${OCEAN}44`, textDecoration:'none', color:'inherit', display:'block', transition:'background 0.12s, border-color 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.background=`${OCEAN}33`; e.currentTarget.style.borderColor=BLUE+'66'; }}
                      onMouseLeave={e => { e.currentTarget.style.background=`${OCEAN}18`; e.currentTarget.style.borderColor=`${OCEAN}44`; }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:800 }}>{name}</div>
                          <div style={{ fontSize:11, color:BLUE }}>{handle}</div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                          <Tag color={OCEAN}>{platform}</Tag>
                          <Tag color='#D9D0A0'>{niche}</Tag>
                        </div>
                      </div>
                      <div style={{ fontSize:11, color:SLATE, lineHeight:1.6 }}>{why}</div>
                    </a>
                  ))}
                </div>
              </Card>

              {/* ── Messaging by content pillar ── */}
              <Card>
                <Label>Messaging Angles — By Content Pillar</Label>
                <div style={{ fontSize:11, color:SLATE, marginBottom:16 }}>Proven hooks and why they work for your specific demographic</div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {PILLARS.map(({ icon, name, hook, why, stop }) => (
                    <div key={name} style={{ background:`${OCEAN}18`, borderRadius:12, padding:'16px 18px', border:`1px solid ${OCEAN}44` }}>
                      <div style={{ fontSize:13, fontWeight:800, marginBottom:8 }}>{icon} {name}</div>
                      <div style={{ background:'#F8FAFC', borderRadius:8, padding:'10px 14px', borderLeft:`3px solid ${BLUE}`, marginBottom:10, fontSize:12, fontStyle:'italic', color:'#2E4A66', lineHeight:1.6 }}>
                        {hook}
                      </div>
                      <div style={{ fontSize:12, color:'#4A6080', lineHeight:1.7, marginBottom:8 }}>{why}</div>
                      <div style={{ fontSize:11, color:YELL, lineHeight:1.6 }}>
                        <strong>Scroll-stopper:</strong> {stop}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* ── What kills trust ── */}
              <Card>
                <Label>🚫 What Kills Trust With This Audience</Label>
                <div style={{ fontSize:11, color:SLATE, marginBottom:14 }}>Patterns that cause your 25–44 demographic to immediately scroll</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {TRUST_KILLERS.map((item, i) => (
                    <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'10px 14px', background:'#1a0a0a', borderRadius:10, borderLeft:'3px solid #f87171' }}>
                      <div style={{ width:20, height:20, borderRadius:'50%', background:'#f8717133', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#f87171', flexShrink:0, marginTop:1 }}>{i+1}</div>
                      <div style={{ fontSize:12, color:'#2E4A66', lineHeight:1.6 }}>{item}</div>
                    </div>
                  ))}
                </div>
              </Card>

            </div>
          );
        })()}

        {/* ══ ANALYTICS ═══════════════════════════════════════ */}
        {tab === 'analytics' && (() => {
          const bench = ytBenchmark(ytSubs);
          const vids  = ytAnalytics?.videos || [];
          const agg   = ytAnalytics?.aggregates || {};
          const ch    = ytAnalytics?.channel || {};

          // Feature 1: Sorted videos
          const sortedVids = [...vids].sort((a, b) => {
            if (ytSort === 'engRate') return (b.engagementRate || 0) - (a.engagementRate || 0);
            if (ytSort === 'likes') return (b.likeCount || 0) - (a.likeCount || 0);
            if (ytSort === 'comments') return (b.commentCount || 0) - (a.commentCount || 0);
            if (ytSort === 'date') return new Date(b.publishedAt) - new Date(a.publishedAt);
            return (b.viewCount || 0) - (a.viewCount || 0);
          });

          // Content pattern: avg views by hook type
          const hookMap = {};
          vids.forEach(v => {
            const h = detectHookType(v.title);
            if (!hookMap[h]) hookMap[h] = { total: 0, count: 0 };
            hookMap[h].total += v.viewCount;
            hookMap[h].count++;
          });
          const hookStats = Object.entries(hookMap)
            .map(([h, d]) => ({ hook: h, avg: Math.round(d.total / d.count), count: d.count }))
            .sort((a, b) => b.avg - a.avg);
          const maxHookAvg = hookStats[0]?.avg || 1;

          // Best hook + insights
          const bestHook   = hookStats.find(h => h.count >= 2) || hookStats[0];
          const topVid     = vids[0];
          const topEngVid  = [...vids].sort((a, b) => b.engagementRate - a.engagementRate)[0];
          const avgViewsPerSub = ch.subscriberCount > 0 ? Math.round((agg.avgViews / ch.subscriberCount) * 100) : 0;

          const likeScore    = scoreLabel(agg.avgLikeRate, bench.likeRate);
          const commentScore = scoreLabel(agg.avgCommentRate, bench.commentRate);
          const viewSubScore = scoreLabel(avgViewsPerSub, bench.viewRatio);

          // Recommendations based on hook performance
          const recs = [];
          if (bestHook) recs.push({
            pillar: HOOK_PILLARS[bestHook.hook],
            idea: `Double down on ${bestHook.hook.toLowerCase()} hooks — they average ${fmtViews(bestHook.avg)} views vs your ${fmtViews(agg.avgViews)} channel average.`,
          });
          if (agg.avgEngRate > 0) {
            const lowEngVids = vids.filter(v => v.engagementRate < agg.avgEngRate * 0.5 && v.viewCount > agg.avgViews);
            if (lowEngVids.length > 0) recs.push({
              pillar: 'Personal Storytimes',
              idea: 'Some high-view videos have low engagement — try ending with a direct question to viewers to boost comments.',
            });
          }
          if (hookStats.length > 1) {
            const worstHook = [...hookStats].sort((a, b) => a.avg - b.avg)[0];
            if (worstHook.hook !== bestHook?.hook) recs.push({
              pillar: HOOK_PILLARS[worstHook.hook] || 'Content Strategy',
              idea: `"${worstHook.hook}" hooks underperform (avg ${fmtViews(worstHook.avg)} views). Try reframing those as ${bestHook?.hook?.toLowerCase() || 'question'} hooks instead.`,
            });
          }
          if (recs.length < 3) recs.push({
            pillar: 'Pet Experiments',
            idea: 'Pet content consistently drives high engagement on YouTube — consider a series format to build returning viewers.',
          });

          return (
            <div style={{ display:'flex', flexDirection:'column', gap:gutter }}>

              {/* ── Page header ── */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
                <div>
                  <div style={{ fontSize:isMobile?16:22, fontWeight:800, letterSpacing:'-0.5px' }}>Analytics</div>
                  <div style={{ fontSize:11, color:SLATE, marginTop:4 }}>
                    YouTube &amp; Instagram live · TikTok coming soon
                    {ytAnalytics?._cachedAt && (
                      <span style={{ marginLeft:8, color:'#64748B' }}>
                        · cached {Math.round((Date.now() - ytAnalytics._cachedAt) / 60000)}m ago
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setYtAnalytics(null); loadYtAnalytics(true); }}
                  disabled={ytAnalyticsLoading}
                  style={{ background:'none', border:`1px solid ${OCEAN}`, borderRadius:8, color:BLUE, padding:'8px 16px', fontSize:11, fontWeight:700, cursor:ytAnalyticsLoading?'default':'pointer', fontFamily:'inherit', opacity:ytAnalyticsLoading?0.5:1 }}>
                  {ytAnalyticsLoading ? '⟳ Loading…' : '↺ Refresh'}
                </button>
              </div>

              {/* ── Loading / Error states ── */}
              {ytAnalyticsLoading && !ytAnalytics && (
                <Card style={{ textAlign:'center', padding:'48px 20px' }}>
                  <div style={{ fontSize:13, color:SLATE }}>Loading YouTube analytics…</div>
                  <div style={{ fontSize:11, color:'#94A3B8', marginTop:8 }}>Fetching your channel &amp; video data</div>
                </Card>
              )}
              {ytAnalyticsError && !ytAnalytics && (
                <Card style={{ textAlign:'center', padding:'32px 20px', borderColor:'#f8717144' }}>
                  <div style={{ fontSize:13, color:'#f87171' }}>⚠ {ytAnalyticsError}</div>
                  <button onClick={() => loadYtAnalytics(true)} style={{ marginTop:12, background:'none', border:`1px solid ${BDR}`, borderRadius:8, color:BLUE, padding:'8px 14px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Retry</button>
                </Card>
              )}

              {ytAnalytics && (<>

                {/* ── Channel overview stat cards ── */}
                <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:12 }}>
                  {[
                    { label:'Subscribers',      value:fmtFull(ch.subscriberCount), sub:'YouTube channel' },
                    { label:'Total Views',       value:fmtFull(ch.viewCount),       sub:'All-time' },
                    { label:'Videos Analysed',   value:agg.totalVids,               sub:'Most recent 50' },
                    { label:'Avg Views/Video',   value:fmtViews(agg.avgViews),      sub:'Across your library' },
                  ].map(({ label, value, sub }) => (
                    <Card key={label} style={{ textAlign:'center', padding:'18px 12px' }}>
                      <div style={{ fontSize:10, color:BLUE, textTransform:'uppercase', letterSpacing:'2.5px', marginBottom:8, fontWeight:700 }}>{label}</div>
                      <div style={{ fontSize:isMobile?26:32, fontWeight:900, letterSpacing:'-1px', lineHeight:1 }}>{value}</div>
                      <div style={{ fontSize:10, color:SLATE, marginTop:6 }}>{sub}</div>
                    </Card>
                  ))}
                </div>

                {/* ── Benchmark comparison ── */}
                <Card>
                  <Label>Performance vs Benchmark — creators your size</Label>
                  <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)', gap:isMobile?16:24 }}>
                    {[
                      { label:'Like Rate',          val:agg.avgLikeRate,    score:likeScore,    bench:bench.likeRate,   unit:'%', tip:'likes ÷ views' },
                      { label:'Comment Rate',        val:agg.avgCommentRate, score:commentScore, bench:bench.commentRate,unit:'%', tip:'comments ÷ views' },
                      { label:'Views / Subscriber',  val:avgViewsPerSub,     score:viewSubScore, bench:bench.viewRatio,  unit:'%', tip:'avg views ÷ subs' },
                    ].map(({ label, val, score, bench: bv, unit, tip }) => (
                      <div key={label}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
                          <div style={{ fontSize:12, fontWeight:700 }}>{label}</div>
                          <span style={{ fontSize:9, color:SLATE }}>{tip}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
                          <div style={{ fontSize:28, fontWeight:900, letterSpacing:'-1px', color:score.color }}>{val}{unit}</div>
                          <Tag color={score.color}>{score.label}</Tag>
                        </div>
                        <div style={{ background:'#E0E6EF', borderRadius:4, height:6, overflow:'hidden' }}>
                          <div style={{ height:'100%', borderRadius:4, background:score.color, width:`${Math.min(100, (val / (bv * 2)) * 100)}%`, transition:'width 0.6s ease' }} />
                        </div>
                        <div style={{ fontSize:10, color:SLATE, marginTop:4 }}>Benchmark: {bv}{unit}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* ── Top performing videos ── */}
                {/* Sort control bar */}
                {!isMobile && vids.length > 0 && (
                  <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
                    {[
                      { key:'views', label:'Views' },
                      { key:'engRate', label:'Engagement Rate' },
                      { key:'likes', label:'Likes' },
                      { key:'comments', label:'Comments' },
                      { key:'date', label:'Date' },
                    ].map(({ key, label }) => (
                      <button key={key} onClick={() => setYtSort(key)} style={{
                        background: ytSort === key ? '#88EAF6' : '#F4F6F9',
                        color: ytSort === key ? '#1A2744' : '#4A6080',
                        border: ytSort === key ? 'none' : '1px solid #CDD4E0',
                        borderRadius: 20,
                        padding: '5px 14px',
                        fontSize: 11,
                        fontWeight: ytSort === key ? 600 : 400,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 0.12s',
                      }}>{label}</button>
                    ))}
                  </div>
                )}
                <Card>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                    <Label style={{ margin:0 }}>Top Performing Videos</Label>
                    <span style={{ fontSize:10, color:SLATE }}>sort by →</span>
                  </div>
                  {isMobile ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {sortedVids.slice(0, 10).map((v, i) => {
                        const hook = detectHookType(v.title);
                        const aboveAvg = v.viewCount > agg.avgViews * 1.5;
                        return (
                          <div key={v.id} onClick={() => setSelectedYtVideo(v)} style={{ background:`${OCEAN}22`, borderRadius:10, padding:'12px 14px', border:`1px solid ${aboveAvg ? BLUE + '44' : OCEAN + '44'}`, cursor:'pointer', transition:'border-color 0.15s, background 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background=`${OCEAN}44`; e.currentTarget.style.borderColor=BLUE+'88'; }}
                          onMouseLeave={e => { e.currentTarget.style.background=`${OCEAN}22`; e.currentTarget.style.borderColor=aboveAvg?BLUE+'44':OCEAN+'44'; }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:8 }}>
                              <div style={{ fontSize:11, fontWeight:700, lineHeight:1.4, flex:1 }}>{v.title}</div>
                              <span style={{ fontSize:9, color:BLUE, fontWeight:700, whiteSpace:'nowrap' }}>{aboveAvg ? '★ Top' : '▶ View'}</span>
                            </div>
                            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                              <span style={{ fontSize:11, color:TEXT }}>👁 {fmtViews(v.viewCount)}</span>
                              <span style={{ fontSize:11, color:YELL }}>♥ {fmtViews(v.likeCount)}</span>
                              <span style={{ fontSize:11, color:SLATE }}>💬 {fmtViews(v.commentCount)}</span>
                              <span style={{ fontSize:11, color:SLATE }}>Eng {v.engagementRate}%</span>
                              <HookTag hook={hook}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ overflow:'hidden', borderRadius:10, border:`1px solid ${BDR}` }}>
                      <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 90px 70px 70px 80px 100px', padding:'9px 16px', fontSize:9, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', background:`${OCEAN}55`, borderBottom:`1px solid ${OCEAN}66` }}>
                        {['#','Title','Views','Likes','Comments','Eng Rate','Hook'].map(h => <div key={h}>{h}</div>)}
                      </div>
                      {sortedVids.slice(0, 15).map((v, i) => {
                        const hook = detectHookType(v.title);
                        const aboveAvg = v.viewCount > agg.avgViews * 1.5;
                        return (
                          <div key={v.id} onClick={() => setSelectedYtVideo(v)} style={{ display:'grid', gridTemplateColumns:'28px 1fr 90px 70px 70px 80px 100px', padding:'13px 16px', borderBottom:`1px solid ${OCEAN}33`, background:i%2===0?`${OCEAN}18`:'transparent', alignItems:'center', cursor:'pointer', transition:'background 0.12s' }}
                              onMouseEnter={e => e.currentTarget.style.background=`${OCEAN}44`}
                              onMouseLeave={e => e.currentTarget.style.background=i%2===0?`${OCEAN}18`:'transparent'}>
                            <div style={{ fontSize:11, color:SLATE, fontWeight:700 }}>{i + 1}</div>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              {v.thumbnail && <img src={v.thumbnail} alt="" style={{ width:48, height:27, borderRadius:4, objectFit:'cover', flexShrink:0 }} />}
                              <div>
                                <div style={{ fontSize:12, fontWeight:600, lineHeight:1.35, maxWidth:280 }}>{v.title.length > 55 ? v.title.slice(0,55)+'…' : v.title}</div>
                                <div style={{ fontSize:10, color:SLATE, marginTop:2 }}>{new Date(v.publishedAt).toLocaleDateString('en-US',{month:'short',year:'numeric'})} · {v.duration}</div>
                              </div>
                            </div>
                            <div style={{ fontSize:13, fontWeight:700 }}>{fmtViews(v.viewCount)}{aboveAvg && <span style={{ marginLeft:4, fontSize:9, color:BLUE }}>★</span>}</div>
                            <div style={{ fontSize:12, color:YELL }}>{fmtViews(v.likeCount)}</div>
                            <div style={{ fontSize:12, color:SLATE }}>{fmtViews(v.commentCount)}</div>
                            <div style={{ fontSize:12, color:v.engagementRate > agg.avgEngRate ? '#96C9AA' : SLATE, fontWeight: v.engagementRate > agg.avgEngRate ? 700 : 400 }}>{v.engagementRate}%</div>
                            <HookTag hook={hook}/>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                {/* ── Content patterns + insights ── */}
                <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:12 }}>

                  {/* Hook type performance */}
                  <Card>
                    <Label>Hook Format Performance</Label>
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      {hookStats.map(({ hook, avg, count }) => (
                        <div key={hook}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <HookTag hook={hook}/>
                              <span style={{ fontSize:10, color:SLATE }}>{count} video{count !== 1 ? 's' : ''}</span>
                            </div>
                            <span style={{ fontSize:12, fontWeight:700, color: avg > agg.avgViews ? '#96C9AA' : SLATE }}>{fmtViews(avg)} avg</span>
                          </div>
                          <div style={{ background:`${OCEAN}44`, borderRadius:4, height:5, overflow:'hidden' }}>
                            <div style={{ height:'100%', borderRadius:4, background:HOOK_COLORS[hook] || SLATE, width:`${Math.round((avg / maxHookAvg) * 100)}%`, transition:'width 0.6s ease' }} />
                          </div>
                        </div>
                      ))}
                      {hookStats.length === 0 && <div style={{ fontSize:12, color:SLATE }}>No pattern data yet — needs at least a few videos</div>}
                    </div>
                  </Card>

                  {/* Key insights */}
                  <Card>
                    <Label>Key Insights</Label>
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      {bestHook && (
                        <div style={{ background:`${OCEAN}33`, borderRadius:10, padding:'12px 14px', borderLeft:`3px solid ${BLUE}` }}>
                          <div style={{ fontSize:11, fontWeight:700, color:BLUE, marginBottom:4 }}>🎯 Strongest format</div>
                          <div style={{ fontSize:12, color:'#2E4A66', lineHeight:1.5 }}>
                            <strong>{bestHook.hook}</strong> hooks average <strong>{fmtViews(bestHook.avg)}</strong> views
                            {agg.avgViews > 0 && ` — ${Math.round((bestHook.avg / agg.avgViews - 1) * 100)}% above your channel average`}.
                          </div>
                        </div>
                      )}
                      {topVid && (
                        <div style={{ background:`${OCEAN}33`, borderRadius:10, padding:'12px 14px', borderLeft:`3px solid ${YELL}` }}>
                          <div style={{ fontSize:11, fontWeight:700, color:YELL, marginBottom:4 }}>🏆 Top video</div>
                          <div style={{ fontSize:12, color:'#2E4A66', lineHeight:1.5 }}>
                            "{topVid.title.slice(0,60)}{topVid.title.length>60?'…':''}" leads with <strong>{fmtViews(topVid.viewCount)}</strong> views and <strong>{topVid.engagementRate}%</strong> engagement.
                          </div>
                        </div>
                      )}
                      {topEngVid && topEngVid.id !== topVid?.id && (
                        <div style={{ background:`${OCEAN}33`, borderRadius:10, padding:'12px 14px', borderLeft:`3px solid #C4A8D8` }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'#C4A8D8', marginBottom:4 }}>💬 Most engaging</div>
                          <div style={{ fontSize:12, color:'#2E4A66', lineHeight:1.5 }}>
                            "{topEngVid.title.slice(0,55)}{topEngVid.title.length>55?'…':''}" drives the most interaction at <strong>{topEngVid.engagementRate}%</strong> eng rate.
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* ── Recommendations ── */}
                <Card>
                  <Label>Content Recommendations — based on your data</Label>
                  <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)', gap:12 }}>
                    {recs.slice(0,3).map((r, i) => (
                      <div key={i} style={{ background:`${OCEAN}22`, borderRadius:10, padding:'16px', border:`1px solid ${BDR}` }}>
                        <div style={{ fontSize:10, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:8, lineHeight:1.4 }}>{r.pillar.split('—')[0].trim()}</div>
                        <div style={{ fontSize:12, color:'#4A6080', lineHeight:1.6 }}>{r.idea}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* ── Instagram section ── */}
                <Card>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <IGLogo size={22}/>
                      <Label style={{ margin:0 }}>Instagram</Label>
                      {igAnalytics && <Tag color='#E1306C'>Live</Tag>}
                      {!igAnalytics && !igAnalyticsLoading && <Tag color={SLATE}>Not connected</Tag>}
                    </div>
                    {igAnalytics && (
                      <button onClick={() => { setIgAnalytics(null); loadIgAnalytics(true); }} style={{ background:'none', border:`1px solid ${OCEAN}`, borderRadius:8, color:BLUE, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>↺ Refresh</button>
                    )}
                  </div>
                  {igAnalyticsLoading && <div style={{ fontSize:12, color:SLATE, padding:'16px 0' }}>Loading Instagram data…</div>}
                  {igAnalyticsError && (
                    <div style={{ background:'#1a1010', borderRadius:10, padding:'14px 16px', borderLeft:'3px solid #f87171' }}>
                      <div style={{ fontSize:12, color:'#f87171', marginBottom:4 }}>⚠ {igAnalyticsError}</div>
                      <div style={{ fontSize:11, color:SLATE }}>Make sure IG_ACCESS_TOKEN and IG_USER_ID are set in Vercel environment variables.</div>
                    </div>
                  )}
                  {!igAnalytics && !igAnalyticsLoading && !igAnalyticsError && (
                    <div style={{ background:`${OCEAN}22`, borderRadius:10, padding:'16px', borderStyle:'dashed', borderColor:`${OCEAN}66`, borderWidth:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>Set up Instagram API</div>
                      <div style={{ fontSize:12, color:SLATE, lineHeight:1.7 }}>
                        Follow the steps below to connect your Creator account and unlock per-post reach, saves, and Reels performance data.
                      </div>
                    </div>
                  )}
                  {igAnalytics && (() => {
                    const { profile: igP, posts, aggregates: igAgg } = igAnalytics;
                    const reachAvailable = igAgg.avgReach > 0;
                    // Per-post: if reach is 0, compute eng rate from followers as fallback
                    const enrichedPosts = posts.map(p => {
                      const totalInt = p.likeCount + (p.commentCount || 0) + p.saveCount;
                      const engRate = p.reach > 0 ? p.engagementRate
                        : (igP.followersCount > 0 ? parseFloat((totalInt / igP.followersCount * 100).toFixed(2)) : 0);
                      return { ...p, computedEngRate: engRate };
                    });
                    const sortedPosts = reachAvailable
                      ? enrichedPosts
                      : [...enrichedPosts].sort((a, b) => b.likeCount - a.likeCount);
                    const avgEngRate = igAgg.avgEngRate > 0 ? igAgg.avgEngRate
                      : (enrichedPosts.length > 0
                          ? parseFloat((enrichedPosts.reduce((s, p) => s + p.computedEngRate, 0) / enrichedPosts.length).toFixed(2))
                          : 0);
                    const avgEngRef = enrichedPosts.length > 0 ? avgEngRate : 0;
                    const igBench = igBenchmark(igP.followersCount);
                    const divisor = reachAvailable ? igAgg.avgReach : (igP.followersCount || 1);
                    const avgLikeRate    = enrichedPosts.length > 0
                      ? parseFloat((enrichedPosts.reduce((s,p)=>s+p.likeCount,0) / enrichedPosts.length / divisor * 100).toFixed(2)) : 0;
                    const avgCommentRate = enrichedPosts.length > 0
                      ? parseFloat((enrichedPosts.reduce((s,p)=>s+(p.commentCount||0),0) / enrichedPosts.length / divisor * 100).toFixed(2)) : 0;
                    const avgSaveRate    = enrichedPosts.length > 0
                      ? parseFloat((enrichedPosts.reduce((s,p)=>s+p.saveCount,0) / enrichedPosts.length / divisor * 100).toFixed(2)) : 0;
                    const igLikeScore    = scoreLabel(avgLikeRate,    igBench.likeRate);
                    const igCommentScore = scoreLabel(avgCommentRate,  igBench.commentRate);
                    const igSaveScore    = scoreLabel(avgSaveRate,     igBench.saveRate);
                    return (
                      <div>
                        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:10, marginBottom:16 }}>
                          {[
                            { label:'Followers',    value:fmtFull(igP.followersCount) },
                            { label:'Posts',        value:igP.mediaCount },
                            { label:'Avg Reach',    value: reachAvailable ? fmtViews(igAgg.avgReach) : '—' },
                            { label:'Avg Eng Rate', value:`${avgEngRate}%` },
                          ].map(({ label, value }) => (
                            <div key={label} style={{ background:`${OCEAN}22`, borderRadius:10, padding:'12px', textAlign:'center' }}>
                              <div style={{ fontSize:9, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:6 }}>{label}</div>
                              <div style={{ fontSize:20, fontWeight:900 }}>{value}</div>
                            </div>
                          ))}
                        </div>

                        {/* ── Benchmark comparison ── */}
                        <div style={{ background:`${OCEAN}18`, borderRadius:12, padding:'16px 18px', marginBottom:16, border:`1px solid ${OCEAN}44` }}>
                          <div style={{ fontSize:10, color:'#E1306C', textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:14 }}>
                            vs. Creators Your Size ({fmtFull(igP.followersCount)} followers)
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)', gap:isMobile?16:24 }}>
                            {[
                              { label:'Like Rate',    val:avgLikeRate,    score:igLikeScore,    bench:igBench.likeRate,    unit:'%', tip:`likes ÷ ${reachAvailable?'reach':'followers'}` },
                              { label:'Comment Rate', val:avgCommentRate, score:igCommentScore, bench:igBench.commentRate, unit:'%', tip:`comments ÷ ${reachAvailable?'reach':'followers'}` },
                              { label:'Save Rate',    val:avgSaveRate,    score:igSaveScore,    bench:igBench.saveRate,    unit:'%', tip:`saves ÷ ${reachAvailable?'reach':'followers'}` },
                            ].map(({ label, val, score, bench: bv, unit, tip }) => (
                              <div key={label}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
                                  <div style={{ fontSize:12, fontWeight:700 }}>{label}</div>
                                  <span style={{ fontSize:9, color:SLATE }}>{tip}</span>
                                </div>
                                <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
                                  <div style={{ fontSize:28, fontWeight:900, letterSpacing:'-1px', color:score.color }}>{val}{unit}</div>
                                  <Tag color={score.color}>{score.label}</Tag>
                                </div>
                                <div style={{ background:'#E0E6EF', borderRadius:4, height:6, overflow:'hidden' }}>
                                  <div style={{ height:'100%', borderRadius:4, background:score.color, width:`${Math.min(100,(val/(bv*2))*100)}%`, transition:'width 0.6s ease' }} />
                                </div>
                                <div style={{ fontSize:10, color:SLATE, marginTop:4 }}>Benchmark: {bv}{unit}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ fontSize:10, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:10 }}>
                          {reachAvailable ? 'Top Posts by Reach' : 'Top Posts by Engagement'}
                        </div>
                        {isMobile ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                            {sortedPosts.slice(0,10).map((p,i) => {
                              const hook = detectHookType(p.caption || '');
                              const aboveAvg = reachAvailable ? p.reach > igAgg.avgReach * 1.3 : p.computedEngRate > avgEngRef * 1.3;
                              return (
                                <a key={p.id} href={p.permalink} target="_blank" rel="noopener noreferrer"
                                  style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:`${OCEAN}22`, borderRadius:10, border:`1px solid ${aboveAvg?'#E1306C44':OCEAN+'44'}`, textDecoration:'none', color:'inherit' }}>
                                  {p.thumbnail && <img src={p.thumbnail} alt="" style={{ width:44, height:44, borderRadius:6, objectFit:'cover', flexShrink:0 }} />}
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:11, fontWeight:600, lineHeight:1.4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                      {p.caption ? p.caption.slice(0,70)+(p.caption.length>70?'…':'') : `(${p.mediaType})`}
                                    </div>
                                    <div style={{ display:'flex', gap:10, marginTop:4, flexWrap:'wrap' }}>
                                      {reachAvailable && <span style={{ fontSize:10, color:'#4A6080' }}>👁 {fmtViews(p.reach)}</span>}
                                      <span style={{ fontSize:10, color:YELL }}>♥ {fmtViews(p.likeCount)}</span>
                                      <span style={{ fontSize:10, color:SLATE }}>💬 {fmtViews(p.commentCount)}</span>
                                      <span style={{ fontSize:10, color:SLATE }}>Eng {p.computedEngRate}%</span>
                                      <HookTag hook={hook}/>
                                    </div>
                                  </div>
                                  {aboveAvg && <span style={{ fontSize:9, color:'#E1306C', fontWeight:700 }}>★</span>}
                                </a>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ overflow:'hidden', borderRadius:10, border:`1px solid ${BDR}` }}>
                            <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 90px 70px 80px 80px 110px', padding:'9px 16px', fontSize:9, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', background:`${OCEAN}55`, borderBottom:`1px solid ${OCEAN}66` }}>
                              {['#','Post','Reach','Likes','Comments','Eng Rate','Hook'].map(h => <div key={h}>{h}</div>)}
                            </div>
                            {sortedPosts.slice(0,15).map((p,i) => {
                              const hook = detectHookType(p.caption || '');
                              const aboveAvg = reachAvailable ? p.reach > igAgg.avgReach * 1.3 : p.computedEngRate > avgEngRef * 1.3;
                              return (
                                <a key={p.id} href={p.permalink} target="_blank" rel="noopener noreferrer"
                                  style={{ display:'grid', gridTemplateColumns:'28px 1fr 90px 70px 80px 80px 110px', padding:'13px 16px', borderBottom:`1px solid ${OCEAN}33`, background:i%2===0?`${OCEAN}18`:'transparent', alignItems:'center', textDecoration:'none', color:'inherit', transition:'background 0.12s' }}
                                  onMouseEnter={e => e.currentTarget.style.background=`${OCEAN}44`}
                                  onMouseLeave={e => e.currentTarget.style.background=i%2===0?`${OCEAN}18`:'transparent'}>
                                  <div style={{ fontSize:11, color:SLATE, fontWeight:700 }}>{i+1}</div>
                                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                    {p.thumbnail && <img src={p.thumbnail} alt="" style={{ width:44, height:44, borderRadius:6, objectFit:'cover', flexShrink:0 }} />}
                                    <div>
                                      <div style={{ fontSize:12, fontWeight:600, lineHeight:1.35, maxWidth:260 }}>
                                        {(p.caption||`(${p.mediaType})`).slice(0,60) + ((p.caption||'').length>60?'…':'')}
                                      </div>
                                      <div style={{ fontSize:10, color:SLATE, marginTop:2 }}>
                                        {new Date(p.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} · <Tag color={p.mediaType==='REEL'?'#E1306C':p.mediaType==='VIDEO'?YELL:SLATE}>{p.mediaType}</Tag>
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ fontSize:13, fontWeight:700 }}>{reachAvailable ? fmtViews(p.reach) : '—'}{aboveAvg && <span style={{ marginLeft:4, fontSize:9, color:'#E1306C' }}>★</span>}</div>
                                  <div style={{ fontSize:12, color:YELL }}>{fmtViews(p.likeCount)}</div>
                                  <div style={{ fontSize:12, color:SLATE }}>{fmtViews(p.commentCount)}</div>
                                  <div style={{ fontSize:12, color:p.computedEngRate > avgEngRef ? '#96C9AA' : SLATE, fontWeight: p.computedEngRate > avgEngRef ? 700 : 400 }}>{p.computedEngRate}%</div>
                                  <HookTag hook={hook}/>
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </Card>

                {/* ── TikTok section ── */}
                <Card>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <TTLogo size={22}/>
                      <Label style={{ margin:0 }}>TikTok</Label>
                      {ttAnalytics && <Tag color='#69C9D0'>Live</Tag>}
                      {!ttAnalytics && !ttAnalyticsLoading && <Tag color={SLATE}>Not connected</Tag>}
                    </div>
                    {ttAnalytics && (
                      <button onClick={() => { setTtAnalytics(null); loadTtAnalytics(true); }} style={{ background:'none', border:`1px solid ${OCEAN}`, borderRadius:8, color:BLUE, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>↺ Refresh</button>
                    )}
                  </div>
                  {ttAnalyticsLoading && <div style={{ fontSize:12, color:SLATE, padding:'16px 0' }}>Loading TikTok data…</div>}
                  {ttAnalyticsError && (
                    <div style={{ background:'#1a1010', borderRadius:10, padding:'14px 16px', borderLeft:'3px solid #f87171' }}>
                      <div style={{ fontSize:12, color:'#f87171', marginBottom:4 }}>⚠ {ttAnalyticsError}</div>
                    </div>
                  )}
                  {!ttAnalytics && !ttAnalyticsLoading && !ttAnalyticsError && (
                    <div style={{ background:`${OCEAN}22`, borderRadius:10, padding:'16px', borderStyle:'dashed', borderColor:`${OCEAN}66`, borderWidth:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>Set up TikTok API</div>
                      <div style={{ fontSize:12, color:SLATE, lineHeight:1.7 }}>
                        Follow the steps below to connect your TikTok account and unlock live video views, engagement, and share rate data.
                      </div>
                    </div>
                  )}
                  {ttAnalytics && (() => {
                    const { profile: ttP, videos: ttVids, aggregates: ttAgg } = ttAnalytics;
                    // Compute per-video rates against views, averaged across the recent set
                    const ttBench = ttBenchmark(ttP.followerCount || 0);
                    const ttN = ttVids.length;
                    const ttAvgLikeRate = ttN > 0
                      ? parseFloat((ttVids.reduce((s,v) => s + (v.viewCount > 0 ? v.likeCount / v.viewCount * 100 : 0), 0) / ttN).toFixed(2)) : 0;
                    const ttAvgCommentRate = ttN > 0
                      ? parseFloat((ttVids.reduce((s,v) => s + (v.viewCount > 0 ? v.commentCount / v.viewCount * 100 : 0), 0) / ttN).toFixed(2)) : 0;
                    const ttAvgShareRate = ttAgg.avgShareRate ?? 0;
                    const ttEngScore     = scoreLabel(ttAgg.avgEngRate || 0, ttBench.engRate);
                    const ttLikeScore    = scoreLabel(ttAvgLikeRate,         ttBench.likeRate);
                    const ttCommentScore = scoreLabel(ttAvgCommentRate,      ttBench.commentRate);
                    const ttShareScore   = scoreLabel(ttAvgShareRate,        ttBench.shareRate);
                    return (
                      <div>
                        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:10, marginBottom:16 }}>
                          {[
                            { label:'Followers',    value:fmtFull(ttP.followerCount) },
                            { label:'Total Likes',  value:fmtViews(ttP.likesCount) },
                            { label:'Avg Views',    value:fmtViews(ttAgg.avgViews) },
                            { label:'Avg Eng Rate', value:`${ttAgg.avgEngRate}%` },
                          ].map(({ label, value }) => (
                            <div key={label} style={{ background:`${OCEAN}22`, borderRadius:10, padding:'12px', textAlign:'center' }}>
                              <div style={{ fontSize:9, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:6 }}>{label}</div>
                              <div style={{ fontSize:20, fontWeight:900 }}>{value}</div>
                            </div>
                          ))}
                        </div>

                        {/* ── Benchmark comparison ── */}
                        <div style={{ background:`${OCEAN}18`, borderRadius:12, padding:'16px 18px', marginBottom:16, border:`1px solid ${OCEAN}44` }}>
                          <div style={{ fontSize:10, color:'#69C9D0', textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:14 }}>
                            vs. Creators Your Size ({fmtFull(ttP.followerCount)} followers)
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:isMobile?16:20 }}>
                            {[
                              { label:'Engagement Rate', val:ttAgg.avgEngRate || 0, score:ttEngScore,     bench:ttBench.engRate,     unit:'%', tip:'likes + comments + shares ÷ views' },
                              { label:'Like Rate',       val:ttAvgLikeRate,         score:ttLikeScore,    bench:ttBench.likeRate,    unit:'%', tip:'likes ÷ views' },
                              { label:'Comment Rate',    val:ttAvgCommentRate,      score:ttCommentScore, bench:ttBench.commentRate, unit:'%', tip:'comments ÷ views' },
                              { label:'Share Rate',      val:ttAvgShareRate,        score:ttShareScore,   bench:ttBench.shareRate,   unit:'%', tip:'shares ÷ views' },
                            ].map(({ label, val, score, bench: bv, unit, tip }) => (
                              <div key={label}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
                                  <div style={{ fontSize:12, fontWeight:700 }}>{label}</div>
                                  <span style={{ fontSize:9, color:SLATE }}>{tip}</span>
                                </div>
                                <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
                                  <div style={{ fontSize:24, fontWeight:900, letterSpacing:'-1px', color:score.color }}>{val}{unit}</div>
                                  <Tag color={score.color}>{score.label}</Tag>
                                </div>
                                <div style={{ background:'#E0E6EF', borderRadius:4, height:6, overflow:'hidden' }}>
                                  <div style={{ height:'100%', borderRadius:4, background:score.color, width:`${Math.min(100,(val/(bv*2))*100)}%`, transition:'width 0.6s ease' }} />
                                </div>
                                <div style={{ fontSize:10, color:SLATE, marginTop:4 }}>Benchmark: {bv}{unit}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                          <div style={{ fontSize:10, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', fontWeight:700 }}>Top Videos by Views</div>
                          <span style={{ fontSize:10, color:SLATE }}>sorted by views · most recent 20</span>
                        </div>
                        {isMobile ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                            {ttVids.slice(0, 10).map((v, i) => {
                              const hook = detectHookType(v.title);
                              const aboveAvg = v.viewCount > ttAgg.avgViews * 1.5;
                              return (
                                <div key={v.id} style={{ background:`${OCEAN}22`, borderRadius:10, padding:'12px 14px', border:`1px solid ${aboveAvg ? '#69C9D044' : OCEAN + '44'}` }}>
                                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:8 }}>
                                    <div style={{ fontSize:11, fontWeight:700, lineHeight:1.4, flex:1 }}>{v.title}</div>
                                    {aboveAvg && <span style={{ fontSize:9, color:'#69C9D0', fontWeight:700, whiteSpace:'nowrap' }}>★ Top</span>}
                                  </div>
                                  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                                    <span style={{ fontSize:11, color:TEXT }}>▶ {fmtViews(v.viewCount)}</span>
                                    <span style={{ fontSize:11, color:YELL }}>♥ {fmtViews(v.likeCount)}</span>
                                    <span style={{ fontSize:11, color:SLATE }}>💬 {fmtViews(v.commentCount)}</span>
                                    <span style={{ fontSize:11, color:SLATE }}>↗ {fmtViews(v.shareCount)}</span>
                                    <span style={{ fontSize:11, color:SLATE }}>Eng {v.engagementRate}%</span>
                                    <HookTag hook={hook}/>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ overflow:'hidden', borderRadius:10, border:`1px solid ${BDR}` }}>
                            <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 90px 70px 80px 70px 80px 100px', padding:'9px 16px', fontSize:9, color:BLUE, textTransform:'uppercase', letterSpacing:'2px', background:`${OCEAN}55`, borderBottom:`1px solid ${OCEAN}66` }}>
                              {['#','Title','Views','Likes','Comments','Shares','Eng Rate','Hook'].map(h => <div key={h}>{h}</div>)}
                            </div>
                            {ttVids.slice(0, 15).map((v, i) => {
                              const hook = detectHookType(v.title);
                              const aboveAvg = v.viewCount > ttAgg.avgViews * 1.5;
                              return (
                                <div key={v.id} style={{ display:'grid', gridTemplateColumns:'28px 1fr 90px 70px 80px 70px 80px 100px', padding:'13px 16px', borderBottom:`1px solid ${OCEAN}33`, background:i%2===0?`${OCEAN}18`:'transparent', alignItems:'center', transition:'background 0.12s' }}
                                  onMouseEnter={e => e.currentTarget.style.background=`${OCEAN}44`}
                                  onMouseLeave={e => e.currentTarget.style.background=i%2===0?`${OCEAN}18`:'transparent'}>
                                  <div style={{ fontSize:11, color:SLATE, fontWeight:700 }}>{i + 1}</div>
                                  <div>
                                    <div style={{ fontSize:12, fontWeight:600, lineHeight:1.35, maxWidth:280 }}>{v.title.length > 60 ? v.title.slice(0,60)+'…' : v.title}</div>
                                    <div style={{ fontSize:10, color:SLATE, marginTop:2 }}>{new Date(v.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}{v.duration ? ` · ${v.duration}s` : ''}</div>
                                  </div>
                                  <div style={{ fontSize:13, fontWeight:700 }}>{fmtViews(v.viewCount)}{aboveAvg && <span style={{ marginLeft:4, fontSize:9, color:'#69C9D0' }}>★</span>}</div>
                                  <div style={{ fontSize:12, color:YELL }}>{fmtViews(v.likeCount)}</div>
                                  <div style={{ fontSize:12, color:SLATE }}>{fmtViews(v.commentCount)}</div>
                                  <div style={{ fontSize:12, color:SLATE }}>{fmtViews(v.shareCount)}</div>
                                  <div style={{ fontSize:12, color:v.engagementRate > ttAgg.avgEngRate ? '#96C9AA' : SLATE, fontWeight: v.engagementRate > ttAgg.avgEngRate ? 700 : 400 }}>{v.engagementRate}%</div>
                                  <HookTag hook={hook}/>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </Card>

                {/* ── API Setup Instructions ── */}
                {(!igAnalytics || !ttAnalytics) && (
                  <Card>
                    <Label>API Connection Guide</Label>
                    {!igAnalytics && (
                      <div style={{ marginBottom: ttAnalytics ? 0 : 24 }}>
                        <div style={{ fontSize:13, fontWeight:800, color:'#E1306C', marginBottom:12 }}>📸 Instagram — 15 mins</div>
                        {[
                          ['1', 'Go to', 'developers.facebook.com', 'https://developers.facebook.com', '— log in with Facebook'],
                          ['2', 'Click My Apps → Create App → Consumer → Name it "Paul Dashboard" → Create App'],
                          ['3', 'Dashboard → Add Products → Instagram Graph API → Set Up'],
                          ['4', 'Top menu → Tools → Graph API Explorer → select your app'],
                          ['5', 'Generate Access Token → User Token. Check permissions: instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement'],
                          ['6', 'Go to', 'developers.facebook.com/tools/debug/accesstoken', 'https://developers.facebook.com/tools/debug/accesstoken', '→ paste token → click Extend Access Token → copy the new token'],
                          ['7', 'In Graph API Explorer run: GET /me/accounts → find your Page → GET /{page-id}?fields=instagram_business_account → copy the id'],
                          ['8', 'Vercel dashboard → your project → Settings → Environment Variables → add IG_ACCESS_TOKEN and IG_USER_ID → Redeploy'],
                        ].map((step, i) => (
                          <div key={i} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:`1px solid ${OCEAN}22` }}>
                            <div style={{ width:20, height:20, borderRadius:'50%', background:`${OCEAN}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, flexShrink:0, marginTop:1 }}>{step[0]}</div>
                            <div style={{ fontSize:12, color:'#4A6080', lineHeight:1.6 }}>
                              {step.length === 2 ? step[1] : (<>{step[1]} <a href={step[3]} target="_blank" rel="noopener noreferrer" style={{ color:BLUE }}>{step[2]}</a> {step[4] || ''}</>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!ttAnalytics && (
                      <div style={{ marginTop: !igAnalytics ? 20 : 0 }}>
                        <div style={{ fontSize:13, fontWeight:800, color:'#69C9D0', marginBottom:12 }}>🎵 TikTok — 20 mins</div>
                        {[
                          ['1', 'Go to', 'developers.tiktok.com', 'https://developers.tiktok.com', '→ log in with TikTok → Manage apps → Create app'],
                          ['2', 'Add product: Login Kit → configure redirect URI: https://paulferrante-dashboard-deploy.vercel.app/api/tiktok-auth'],
                          ['3', 'Under app settings copy Client Key and Client Secret'],
                          ['4', 'Vercel → Settings → Environment Variables → add TT_CLIENT_KEY and TT_CLIENT_SECRET → Redeploy'],
                          ['5', 'Visit', 'paulferrante-dashboard-deploy.vercel.app/api/tiktok-connect', 'https://paulferrante-dashboard-deploy.vercel.app/api/tiktok-connect', '→ authorize with TikTok → see "TikTok Connected!" ✓'],
                        ].map((step, i) => (
                          <div key={i} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:`1px solid ${OCEAN}22` }}>
                            <div style={{ width:20, height:20, borderRadius:'50%', background:`${OCEAN}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, flexShrink:0, marginTop:1 }}>{step[0]}</div>
                            <div style={{ fontSize:12, color:'#4A6080', lineHeight:1.6 }}>
                              {step.length === 2 ? step[1] : (<>{step[1]} <a href={step[3]} target="_blank" rel="noopener noreferrer" style={{ color:BLUE }}>{step[2]}</a> {step[4] || ''}</>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

              </>)}
            </div>
          );
        })()}


        {/* ══ PROPOSALS ══════════════════════════════════════ */}
        {tab === 'proposals' && (
          <ProposalsTab
            crm={crm}
            setDeals={setDeals}
            setCrm={setCrm}
            deals={deals}
            igFollowers={igFollowers}
            ttFollowers={ttFollowers}
            ytSubs={ytSubs}
            ytAnalytics={ytAnalytics}
            igAnalytics={igAnalytics}
            ttAnalytics={ttAnalytics}
            showToast={showToast}
            isMobile={isMobile}
          />
        )}

        {/* ══ CONTENT INTEL ════════════════════════════════════════ */}
        {tab === 'content-intel' && (() => {
          const SentimentBadge = ({ s }) => {
            const map = { frustrated:['#FDEAEA','#A32D2D'], excited:['#E6F8EF','#1A7A40'], confused:['#FFF3D0','#8A6A10'], 'seeking advice':['#EEF9FD','#0E6A80'], discussing:['#F4F6F9','#4A6080'] };
            const [bg, color] = map[s?.toLowerCase()] || ['#F4F6F9','#4A6080'];
            return <span style={{ background:bg, color, borderRadius:20, padding:'2px 8px', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>{s}</span>;
          };

          const HookTag = ({ pattern }) => {
            const colors = { 'Cost breakdown':['#EEF9FD','#0E6A80'], 'Consequence-first':['#FDEAEA','#A32D2D'], 'Curiosity gap':['#FFF3D0','#8A6A10'], 'Contrarian take':['#F0E8F5','#6B2A8B'], 'Before/after':['#E6F8EF','#1A7A40'], 'Day-in-life':['#E8F0E8','#2A6B2A'], 'Listicle':['#F5F0E8','#6B5A2A'] };
            const [bg, color] = colors[pattern] || ['#F4F6F9','#4A6080'];
            return <span style={{ background:bg, color, borderRadius:20, padding:'2px 8px', fontSize:9, fontWeight:700 }}>{pattern}</span>;
          };

          const PulsingCard = ({ height=80 }) => (
            <div style={{ background:'#E8EDF4', borderRadius:8, height, marginBottom:10, animation:'ciPulse 1.5s ease-in-out infinite' }} />
          );

          const SectionHeader = ({ title, fetchedAt, onRefresh, loading }) => (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <div style={{ fontSize:11, color:'#1A2744', textTransform:'uppercase', letterSpacing:'2px', fontWeight:600 }}>{title}</div>
                {fetchedAt && (
                  <div style={{ fontSize:11, color:'#5A7A99', marginTop:2 }}>
                    Last refreshed: {new Date(fetchedAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}
                    {' · '}
                    {new Date(fetchedAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                  </div>
                )}
              </div>
              <button onClick={onRefresh} disabled={loading} style={{ border:'1px solid #CDD4E0', background:'#FFFFFF', color:'#1A2744', borderRadius:8, padding:'6px 14px', fontSize:11, cursor:loading?'default':'pointer', fontFamily:'inherit', opacity:loading?0.6:1 }}>
                {loading ? '↻ Loading…' : '↻ Refresh'}
              </button>
            </div>
          );

          const CreatorCard = ({ creator, isFav, onToggle, onSave }) => {
            const initials = creator.avatar_initials || (creator.name || '??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
            const avatarColor = creator.avatar_color || '#88EAF6';
            return (
              <div style={{ background:'#FFFFFF', border:`1px solid ${isFav ? '#88EAF6' : '#CDD4E0'}`, borderRadius:8, padding:'12px 14px' }}>
                {/* Top row: avatar + name + star */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:avatarColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#1A2744', flexShrink:0 }}>
                      {initials}
                    </div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'#1A2744', lineHeight:1.2 }}>{creator.name}</div>
                      <div style={{ fontSize:11, color:'#88EAF6' }}>{creator.handle}</div>
                    </div>
                  </div>
                  <button onClick={onToggle} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, padding:0, color: isFav ? '#F5A623' : '#CDD4E0', transition:'color 0.15s' }}>
                    {isFav ? '★' : '☆'}
                  </button>
                </div>
                {/* Meta row */}
                <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ fontSize:10, background:'#F4F6F9', color:'#4A6080', borderRadius:20, padding:'2px 8px' }}>{creator.platform}</span>
                  <span style={{ fontSize:10, color:'#2E4A66', fontWeight:600 }}>{creator.followers}</span>
                  {creator.engagement_rate && <span style={{ fontSize:10, color:'#1A7A40', fontWeight:600 }}>⚡ {creator.engagement_rate} ER</span>}
                  {creator.posting_cadence && <span style={{ fontSize:10, color:'#5A7A99' }}>📅 {creator.posting_cadence}</span>}
                  {creator.is_dormant && <span style={{ fontSize:9, background:'#FFF3D0', color:'#8A6A10', borderRadius:20, padding:'2px 7px', fontWeight:700 }}>DORMANT</span>}
                </div>
                {/* Why watch */}
                {creator.why_watch && (
                  <div style={{ fontSize:11, color:'#0E6A80', background:'#EEF9FD', borderRadius:6, padding:'6px 10px', marginBottom:8, lineHeight:1.4 }}>
                    🎯 {creator.why_watch}
                  </div>
                )}
                {/* Content style */}
                <div style={{ fontSize:11, color:'#4A6080', lineHeight:1.5, marginBottom:8 }}>{creator.content_style}</div>
                {/* Top videos */}
                {creator.top_videos && creator.top_videos.length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:9, color:'#8A9BB0', textTransform:'uppercase', letterSpacing:'1px', marginBottom:5 }}>Top Videos</div>
                    {creator.top_videos.slice(0,3).map((v,vi) => (
                      <div key={vi} style={{ marginBottom:3 }}>
                        <a href={v.url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:'#2E4A66', textDecoration:'none', lineHeight:1.3 }}>
                          ▶ {v.title.length > 55 ? v.title.slice(0,55)+'...' : v.title}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                {/* Action buttons */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button onClick={onSave} style={{ fontSize:10, color:'#1A7A40', background:'#E6F8EF', border:'1px solid #A8D5B5', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                    💡 Save to ideas
                  </button>
                  {creator.profile_url && (
                    <a href={creator.profile_url} target="_blank" rel="noreferrer" style={{ fontSize:10, color:'#5A7A99', textDecoration:'none', padding:'5px 4px' }}>
                      ↗ View profile
                    </a>
                  )}
                </div>
              </div>
            );
          };

          const totalIdeas = ciIdeas.saved.length + ciIdeas.prioritized.length + ciIdeas.created.length;
          const thisWeekCreated = ciIdeas.created.filter(i => i.createdAt && (Date.now() - new Date(i.createdAt).getTime()) < 7*24*60*60*1000).length;

          const starredCreators = ciFavorites;
          const discoveryCreators = (ciCreators.data || []).filter(c => !ciFavorites.some(f => f.handle === c.handle));

          return (
            <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
              <style>{`
                @keyframes ciPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
                .ci-card-hover:hover { background:#F0F4FA !important; cursor:pointer; }
                .ci-idea-col { min-height:120px; }
              `}</style>

              {/* Toast */}
              {ciToast && (
                <div style={{ position:'fixed', bottom:32, right:32, background:'#1A2744', color:'#FFFFFF', borderRadius:10, padding:'12px 20px', fontSize:13, fontWeight:600, zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,0.2)', animation:'fadeIn 0.2s ease' }}>
                  {ciToast}
                </div>
              )}

              {/* ── SECTION A: Reddit Pulse ── */}
              <Card>
                <SectionHeader title="Reddit Pulse" fetchedAt={ciReddit.fetchedAt} onRefresh={() => { setCiReddit({ data:null, loading:false, error:null, fetchedAt:null }); fetchCI('reddit'); }} loading={ciReddit.loading} />
                {ciReddit.error && <div style={{ color:'#A32D2D', fontSize:12, padding:'12px 0' }}>Error: {ciReddit.error}</div>}
                {ciReddit.loading && [1,2,3,4].map(i => <PulsingCard key={i} height={120} />)}
                {!ciReddit.loading && ciReddit.data && ciReddit.data.length > 0 && (
                  <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:12 }}>
                    {ciReddit.data.map((item, i) => {
                      const [pillarLabel, pillarBg, pillarColor] = getPillarTag((item.post_title || '') + ' ' + (item.content_angle || ''));
                      return (
                        <div key={i} style={{ background:'#FFFFFF', border:'1px solid #CDD4E0', borderRadius:8, padding:'14px 16px', transition:'background 0.15s' }}
                          className="ci-card-hover">
                          {/* Header row */}
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                            <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                              <span style={{ fontSize:10, color:'#88EAF6', fontWeight:700 }}>{item.subreddit}</span>
                              <span style={{ background:pillarBg, color:pillarColor, borderRadius:20, padding:'2px 7px', fontSize:9, fontWeight:700 }}>{pillarLabel}</span>
                            </div>
                            <SentimentBadge s={item.sentiment} />
                          </div>
                          {/* Title */}
                          <div style={{ fontSize:13, fontWeight:700, color:'#1A2744', marginBottom:6, lineHeight:1.4 }}>{item.post_title || item.pain_point}</div>
                          {/* Content angle */}
                          <div style={{ fontSize:12, color:'#4A6080', fontStyle:'italic', marginBottom:10, lineHeight:1.5 }}>{item.content_angle}</div>
                          {/* Metadata row */}
                          {(item.upvotes || item.comments) && (
                            <div style={{ fontSize:11, color:'#8A9BB0', marginBottom:8, display:'flex', gap:10 }}>
                              {item.upvotes && <span>▲ {typeof item.upvotes === 'number' ? item.upvotes.toLocaleString() : item.upvotes}</span>}
                              {item.comments && <span>💬 {typeof item.comments === 'number' ? item.comments.toLocaleString() : item.comments}</span>}
                            </div>
                          )}
                          {/* Action buttons */}
                          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                            <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(item.content_angle); saveIdeaToast('📋 Copied!'); }}
                              style={{ fontSize:10, color:'#1A2744', background:'#EEF9FD', border:'1px solid #88EAF6', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                              📋 Copy angle
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); saveIdea({ source:'Reddit', title: item.post_title || item.pain_point, angle: item.content_angle, url: item.url, subreddit: item.subreddit }); }}
                              style={{ fontSize:10, color:'#1A7A40', background:'#E6F8EF', border:'1px solid #A8D5B5', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                              💡 Save to ideas
                            </button>
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noreferrer"
                                style={{ fontSize:10, color:'#5A7A99', textDecoration:'none', padding:'5px 4px' }}
                                onClick={e => e.stopPropagation()}>
                                ↗ View thread
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {!ciReddit.loading && (!ciReddit.data || ciReddit.data.length === 0) && !ciReddit.error && (
                  <div style={{ textAlign:'center', padding:'32px 0', color:'#5A7A99', fontSize:13 }}>Click Refresh to load this week's top Reddit posts</div>
                )}
              </Card>

              {/* ── SECTION B: Trending Videos ── */}
              <Card>
                <SectionHeader title="Trending Videos — Why It Works" fetchedAt={ciVideos.fetchedAt} onRefresh={() => { setCiVideos({ data:null, loading:false, error:null, fetchedAt:null }); fetchCI('videos'); }} loading={ciVideos.loading} />
                {ciVideos.error && <div style={{ color:'#A32D2D', fontSize:12, padding:'12px 0' }}>Error: {ciVideos.error}</div>}
                {ciVideos.loading && [1,2,3].map(i => <PulsingCard key={i} height={160} />)}
                {!ciVideos.loading && ciVideos.data && ciVideos.data.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {ciVideos.data.map((v, i) => (
                      <div key={i} style={{ background:'#FFFFFF', border:'1px solid #CDD4E0', borderRadius:8, overflow:'hidden' }}>
                        {/* Top section */}
                        <div style={{ padding:'14px 16px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:13, fontWeight:700, color:'#1A2744', marginBottom:5 }}>{v.title}</div>
                              {/* Meta row */}
                              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:6 }}>
                                <span style={{ fontSize:11, color:'#88EAF6', fontWeight:600 }}>{v.creator}</span>
                                <span style={{ fontSize:10, background:'#F4F6F9', color:'#4A6080', borderRadius:20, padding:'2px 8px', fontWeight:600 }}>{v.platform}</span>
                                {v.views && <span style={{ fontSize:11, color:'#2E4A66', fontWeight:700 }}>👁 {v.views}</span>}
                                {v.engagement_rate && <span style={{ fontSize:11, color:'#1A7A40', fontWeight:700 }}>⚡ {v.engagement_rate} ER</span>}
                                {v.video_length && (
                                  <span style={{ fontSize:10, background: v.in_target_range === false ? '#FFF3D0' : v.in_target_range === true ? '#E6F8EF' : '#F4F6F9', color: v.in_target_range === false ? '#8A6A10' : v.in_target_range === true ? '#1A7A40' : '#4A6080', borderRadius:20, padding:'2px 8px', fontWeight:600 }}>
                                    {v.in_target_range === false ? '⚠️' : '✓'} {v.video_length}
                                  </span>
                                )}
                                {v.hook_pattern && <HookTag pattern={v.hook_pattern} />}
                              </div>
                            </div>
                            <button onClick={() => setCiExpandedVideo(ciExpandedVideo === i ? null : i)}
                              style={{ background:'none', border:'1px solid #CDD4E0', borderRadius:6, padding:'5px 10px', color:'#4A6080', fontSize:11, cursor:'pointer', fontFamily:'inherit', flexShrink:0, marginLeft:12 }}>
                              {ciExpandedVideo === i ? '▲ Collapse' : '▼ Expand'}
                            </button>
                          </div>
                          {/* Hook box */}
                          <div style={{ background:'#EEF9FD', border:'1px solid #88EAF6', borderRadius:6, padding:'8px 12px', marginBottom:10 }}>
                            <div style={{ fontSize:9, color:'#0E6A80', textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:700, marginBottom:4 }}>Hook (first 3 sec)</div>
                            <div style={{ fontSize:12, color:'#0E6A80', lineHeight:1.4 }}>{v.hook}</div>
                          </div>
                          {/* Top comment */}
                          {v.top_comment && (
                            <div style={{ fontSize:11, color:'#6A7A8A', fontStyle:'italic', marginBottom:10, lineHeight:1.4, borderLeft:'2px solid #CDD4E0', paddingLeft:10 }}>
                              "{v.top_comment.length > 100 ? v.top_comment.slice(0,100)+'...' : v.top_comment}"
                            </div>
                          )}
                          {/* Action buttons */}
                          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                            <button onClick={() => saveIdea({ source:'Trending Video', title: v.title, angle: v.copy_framework || v.why_it_worked, url: v.platform_url, hook: v.hook, hook_pattern: v.hook_pattern })}
                              style={{ fontSize:10, color:'#1A7A40', background:'#E6F8EF', border:'1px solid #A8D5B5', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                              💡 Save to ideas
                            </button>
                            {v.platform_url && (
                              <a href={v.platform_url} target="_blank" rel="noreferrer"
                                style={{ fontSize:10, color:'#5A7A99', textDecoration:'none', padding:'5px 4px' }}>
                                ↗ Watch on {v.platform}
                              </a>
                            )}
                          </div>
                        </div>
                        {/* Expanded section */}
                        {ciExpandedVideo === i && (
                          <div style={{ padding:'14px 16px', borderTop:'1px solid #CDD4E0', background:'#F7F9FC' }}>
                            <div style={{ fontSize:9, color:'#1A2744', textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:700, marginBottom:6 }}>Why It Worked</div>
                            <div style={{ fontSize:12, color:'#4A6080', lineHeight:1.6, marginBottom:14 }}>{v.why_it_worked}</div>
                            <div style={{ background:'#FFFFFF', borderLeft:'3px solid #88EAF6', borderRadius:4, padding:'10px 14px', marginBottom:12 }}>
                              <div style={{ fontSize:9, color:'#1A2744', textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:700, marginBottom:6 }}>Copy This For Your Channel</div>
                              <div style={{ fontSize:12, color:'#1A2744', lineHeight:1.6 }}>{v.copy_framework}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {!ciVideos.loading && (!ciVideos.data || ciVideos.data.length === 0) && !ciVideos.error && (
                  <div style={{ textAlign:'center', padding:'32px 0', color:'#5A7A99', fontSize:13 }}>Click Refresh to load trending video formats</div>
                )}
              </Card>

              {/* ── SECTION C: Creator Watch ── */}
              <Card>
                <SectionHeader title="Creator Watch" fetchedAt={ciCreators.fetchedAt} onRefresh={() => { setCiCreators({ data:null, loading:false, error:null, fetchedAt:null }); fetchCI('creators'); }} loading={ciCreators.loading} />

                {/* Starred creators pinned at top */}
                {starredCreators.length > 0 && (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:9, color:'#1A2744', textTransform:'uppercase', letterSpacing:'2.5px', fontWeight:700, marginBottom:10 }}>⭐ Starred Creators</div>
                    <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr', gap:10 }}>
                      {starredCreators.map((creator, i) => (
                        <CreatorCard key={i} creator={creator} isFav={true} onToggle={() => toggleFavorite(creator)} onSave={() => saveIdea({ source:'Creator', title: creator.name, angle: creator.why_watch || creator.content_style, url: creator.profile_url || `https://tiktok.com/${creator.handle}` })} />
                      ))}
                    </div>
                    <div style={{ height:1, background:'#CDD4E0', margin:'16px 0' }} />
                  </div>
                )}

                <div style={{ fontSize:9, color:'#1A2744', textTransform:'uppercase', letterSpacing:'2.5px', fontWeight:700, marginBottom:10 }}>🔍 Discover</div>
                {ciCreators.error && <div style={{ color:'#A32D2D', fontSize:12, padding:'12px 0' }}>Error: {ciCreators.error}</div>}
                {ciCreators.loading && [1,2,3,4,5,6].map(i => <PulsingCard key={i} height={120} />)}
                {!ciCreators.loading && discoveryCreators.length > 0 && (
                  <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr', gap:10 }}>
                    {discoveryCreators.map((creator, i) => (
                      <CreatorCard key={i} creator={creator} isFav={false} onToggle={() => toggleFavorite(creator)} onSave={() => saveIdea({ source:'Creator', title: creator.name, angle: creator.why_watch || creator.content_style, url: creator.profile_url || `https://tiktok.com/${creator.handle}` })} />
                    ))}
                  </div>
                )}
                {!ciCreators.loading && (!ciCreators.data || ciCreators.data.length === 0) && !ciCreators.error && (
                  <div style={{ textAlign:'center', padding:'32px 0', color:'#5A7A99', fontSize:13 }}>Click Refresh to load creator recommendations</div>
                )}
              </Card>

              {/* ── SECTION D: Ideas Kanban ── */}
              <Card>
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:11, color:'#1A2744', textTransform:'uppercase', letterSpacing:'2px', fontWeight:600, marginBottom:12 }}>💡 Ideas Board</div>
                  {/* Stats bar */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, marginBottom:4 }}>
                    {[
                      { label:'Total Saved', value: totalIdeas, highlight:false },
                      { label:'Prioritized', value: ciIdeas.prioritized.length, highlight:false },
                      { label:'This Week', value: thisWeekCreated, highlight:false },
                      { label:'Videos Created', value: ciIdeas.created.length, highlight:true },
                    ].map(({ label, value, highlight }) => (
                      <div key={label} style={{ background: highlight ? '#1A2744' : '#F7F9FC', borderRadius:8, padding:'12px 14px', textAlign:'center', border:`1px solid ${highlight ? '#1A2744' : '#CDD4E0'}` }}>
                        <div style={{ fontSize: highlight ? 24 : 20, fontWeight:800, color: highlight ? '#88EAF6' : '#1A2744', lineHeight:1 }}>{value}</div>
                        <div style={{ fontSize:10, color: highlight ? '#8CA0C8' : '#5A7A99', marginTop:4, textTransform:'uppercase', letterSpacing:'1px' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Kanban columns */}
                <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr', gap:14 }}>
                  {[
                    { key:'saved', label:'📥 Saved', color:'#4A6080' },
                    { key:'prioritized', label:'🎯 Prioritized', color:'#0E6A80' },
                    { key:'created', label:'✅ Created', color:'#1A7A40' },
                  ].map(({ key, label, color }) => (
                    <div key={key} style={{ background:'#F7F9FC', borderRadius:8, padding:'12px', border:'1px solid #CDD4E0' }}>
                      <div style={{ fontSize:11, fontWeight:700, color, marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span>{label}</span>
                        <span style={{ background:'#FFFFFF', border:'1px solid #CDD4E0', borderRadius:20, padding:'1px 8px', fontSize:10, color:'#5A7A99', fontWeight:600 }}>{ciIdeas[key].length}</span>
                      </div>
                      <div className="ci-idea-col" style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {ciIdeas[key].length === 0 && (
                          <div style={{ textAlign:'center', padding:'20px 0', color:'#8A9BB0', fontSize:12 }}>
                            {key === 'saved' ? 'Save ideas from above' : key === 'prioritized' ? 'Promote ideas here' : 'Mark ideas as done'}
                          </div>
                        )}
                        {ciIdeas[key].map(idea => (
                          <div key={idea.id} style={{ background:'#FFFFFF', borderRadius:6, padding:'10px 12px', border:'1px solid #CDD4E0' }}>
                            <div style={{ fontSize:10, color:'#88EAF6', fontWeight:700, marginBottom:4 }}>{idea.source}</div>
                            <div style={{ fontSize:12, fontWeight:600, color:'#1A2744', marginBottom:4, lineHeight:1.3 }}>{idea.title}</div>
                            {idea.angle && <div style={{ fontSize:11, color:'#4A6080', marginBottom:8, lineHeight:1.4, fontStyle:'italic' }}>{idea.angle.slice(0,100)}{idea.angle.length > 100 ? '...' : ''}</div>}
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                              {key === 'saved' && <button onClick={() => moveIdea(idea.id, 'saved', 'prioritized')} style={{ fontSize:9, color:'#0E6A80', background:'#EEF9FD', border:'1px solid #88EAF6', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>🎯 Prioritize</button>}
                              {key === 'prioritized' && <button onClick={() => moveIdea(idea.id, 'prioritized', 'created')} style={{ fontSize:9, color:'#1A7A40', background:'#E6F8EF', border:'1px solid #A8D5B5', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>✅ Mark created</button>}
                              {key !== 'created' && key !== 'prioritized' && null}
                              {key === 'created' && <span style={{ fontSize:9, color:'#1A7A40', fontWeight:700 }}>🎉 Done!</span>}
                              {idea.url && <a href={idea.url} target="_blank" rel="noreferrer" style={{ fontSize:9, color:'#5A7A99', padding:'3px 4px', textDecoration:'none' }}>↗ Source</a>}
                              <button onClick={() => deleteIdea(idea.id, key)} style={{ fontSize:9, color:'#A32D2D', background:'#FDEAEA', border:'1px solid #F5C6C6', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

            </div>
          );
        })()}

        {/* ══ REALITY TV CASTING ══════════════════════════════════ */}
        {tab === 'reality-casting' && <RealityCastingTab />}
        {tab === 'books' && <BooksTab isMobile={isMobile} showToast={showToast} />}

        </div>
      </div>
      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:#CBD5E1; border-radius:2px; }
        input[type=number]::-webkit-inner-spin-button { display:none; }
        select option { background:#fff; color:#1A1A2E; }
        body { background:#FFFFFF; }
      `}</style>
    </div>
  );
}
