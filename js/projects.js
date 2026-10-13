// Case-study detail for each project card. Card markup lives in index.html; ids match data-project.
// summary = what it is, features = what I built, tech = tech and skills used.
// items = sub-projects listed in the modal under "Inside"; omit when there are none.
// site = public display site; null keeps its Visit site buttons hidden.

// Public display sites, also listed under Live sites in the contact section.
// TOB is served from my PC through Tailscale Funnel, so it is only up while that PC is on.
export const SITES = {
  tob: 'https://yuwakuonline.tail28063a.ts.net:8443/',
  // TODO(fin-site): the FIN display site (C:\Dev\fin-website) is not hosted publicly yet. Paste its URL here.
  fin: null,
  // TODO(gar-site): GAR has no public display site yet. Paste its URL here.
  gar: null,
};

export const projects = [
  {
    id: 'tob',
    title: 'TOB',
    tag: 'AI',
    summary: 'My AI butler. TOB runs the server, writes code with me and helps build everything on this page. It is less a single app and more a working partner with departments of its own.',
    features: [
      'Helps run and look after the KRP Minecraft server',
      'Pair-programs with me across every project here',
      'Has its own markets department, FIN',
      'Has a home on the web: the TOB site, built by TMP',
    ],
    items: [
      { name: 'TOB site', text: 'The home site for TOB and the tools built around it, and the front door for its departments, including FIN.' },
    ],
    facts: { Type: 'AI assistant', Role: 'Butler, operator, co-builder', Departments: 'FIN (markets)' },
    links: ['fin', 'krp', 'tmp'],
    site: SITES.tob,
    tech: ['AI tools', 'Automation', 'Server operations', 'Pair programming', 'Web design'],
  },
  {
    id: 'fin',
    title: 'FIN',
    tag: 'Finance',
    summary: 'TOB’s markets department: a research lab for watching markets and testing ideas honestly. Every trade is simulated. No real money is ever on the line.',
    features: [
      'Live market monitoring',
      'Honest backtests that try hard not to fool themselves',
      'Machine-learning research on trading ideas',
      'Paper trading that has to get past a risk guard first',
      'Simulated money only, by design',
    ],
    facts: { Type: 'Research lab', 'Part of': 'TOB', Money: 'Simulated only' },
    links: ['tob'],
    site: SITES.fin,
    tech: ['Machine learning', 'Backtesting', 'Live market data', 'Paper trading', 'Risk controls'],
  },
  {
    id: 'gar',
    title: 'GAR',
    tag: 'Business',
    summary: 'Back-office software for small service companies: the books, the invoices, getting paid and paying the team, all in one place, with a portal for clients.',
    features: [
      'Accounting for small service businesses',
      'Invoicing with online payments',
      'Payroll with Arizona payroll rules built in',
      'A client portal so customers can see and pay what they owe',
      'Receives quote requests straight from the TQM website, built by TMP',
    ],
    facts: { Type: 'Business software', For: 'Small service companies', Region: 'Arizona payroll rules' },
    links: ['tmp'],
    site: SITES.gar,
    tech: ['Web application', 'Online payments', 'Payroll rules', 'Client portal'],
  },
  {
    id: 'tmp',
    title: 'TMP',
    tag: 'Web',
    summary: 'The website building company I run. TMP designs and builds fast, modern sites for small businesses, and it made every site you are scrolling right now: this madebywaku site and the display sites for the projects on it.',
    features: [
      'Designs and builds websites for small businesses, start to finish',
      'Made this madebywaku site, the one you are on now',
      'Made the display sites for TOB, FIN and GAR',
      'Made the TQM Website for a cleaning company in Mesa, Arizona',
    ],
    items: [
      { name: 'TQM Website', text: 'Example client project: the official site for Total Quality Management, a family-owned cleaning company in Mesa, Arizona. Built with Next.js as a fast static site, with quote requests flowing straight into GAR.' },
      { name: 'madebywaku', text: 'This site. Every section, animation and sound you have scrolled past was built by TMP.' },
      { name: 'Project sites', text: 'The display sites for TOB, FIN and GAR, linked from their cards and under Live sites.' },
    ],
    facts: { Type: 'Website building company', Example: 'TQM Website (Mesa, Arizona)', Built: 'Every site on this page' },
    links: ['tob', 'fin', 'gar'],
    tech: ['Next.js', 'Static sites', 'Responsive design', 'Animation', 'Quote forms'],
  },
  {
    id: 'krp',
    title: 'KRP',
    tag: 'Minecraft',
    summary: 'Everything Minecraft: KingdomRP, a roleplay server built around custom combat and companion pets, and the framework of Java plugins that powers it. Players can join from Java Edition or Bedrock, so friends on PC, console and phone end up in the same world.',
    features: [
      'Roleplay-focused world where players build a life inside the kingdom',
      'Custom combat that goes beyond vanilla swing-and-hit, powered by FightCore',
      'Companion pets that follow, fight and grow alongside their owners',
      'Cross-play: join from Java Edition or Bedrock',
      'A small plugin framework instead of a stack of unrelated off-the-shelf plugins',
      'Day-to-day running handled together with TOB, the AI butler',
    ],
    items: [
      { name: 'KingdomRP Server', text: 'The roleplay Minecraft server itself, with custom combat, companion pets and Java + Bedrock cross-play.' },
      { name: 'KingdomRP Framework', text: 'The Java plugins behind the server, built as separate plugins so each part can change without breaking the rest.' },
      { name: 'Core', text: 'The shared foundation the other plugins build on.' },
      { name: 'FightCore', text: 'The custom combat system.' },
      { name: 'Pets', text: 'Companions with their own behaviour and progression.' },
    ],
    facts: { Type: 'Minecraft server + plugins', Editions: 'Java + Bedrock', Language: 'Java', Modules: 'Core, FightCore, Pets' },
    links: ['tob'],
    tech: ['Minecraft server', 'Java + Bedrock cross-play', 'Java', 'Minecraft plugin API', 'Modular plugin design', 'Server administration'],
  },
];
