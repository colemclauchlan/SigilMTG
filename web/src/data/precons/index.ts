/**
 * Sigil — Commander Precon catalog
 *
 * How to add more precons:
 * 1. Create a new file in this directory, e.g. `commanders-2025.ts`
 * 2. Export an array of PreconDeck objects
 * 3. Import and spread it into the ALL_PRECONS array below
 *
 * Card lists are stored as plain "Quantity Name" text (same format as
 * parseDecklistText in scryfall.ts), with "// Commander" section header.
 * Scryfall fetches are done lazily on import, not at bundle time.
 *
 * Sources:
 *   - Official Wizards Commander product pages
 *   - Moxfield (public decklists)
 *   - EDHREC Precon page: https://edhrec.com/commanders/precon
 */

export interface PreconDeck {
  id: string
  name: string
  set: string          // MTG set code, e.g. "CMM"
  setName: string      // Human-readable set name
  year: number
  colors: string[]     // Commander color identity
  commanderName: string
  artUrl?: string      // Commander art (populated lazily via Scryfall)
  theme?: string       // e.g. "Tribal – Elves", "Superfriends"
  /** Raw decklist text in "// Commander\n1 Name\n// Mainboard\n1 Name..." format */
  decklist: string
}

// ── Commander precons (2023-2024 sets; seed catalog) ──────────────────────────────────────────────────────────────

// Commander Masters 2023
const COMMANDER_MASTERS_2023: PreconDeck[] = [
  {
    id: 'cmm-enduring-enchantments',
    name: 'Enduring Enchantments',
    set: 'CMM',
    setName: 'Commander Masters',
    year: 2023,
    colors: ['W', 'B', 'G'],
    commanderName: 'Anikthea, Hand of Erebos',
    theme: 'Enchantments',
    decklist: `// Commander
1 Anikthea, Hand of Erebos

// Deck
1 Arasta of the Endless Web
1 Archon of Sun's Grace
1 Composer of Spring
1 Courser of Kruphix
1 Demon of Fate's Design
1 Destiny Spinner
1 Doomwake Giant
1 Dryad of the Ilysian Grove
1 Eidolon of Blossoms
1 Erebos, Bleak-Hearted
1 Greater Tanuki
1 Heliod, God of the Sun
1 Herald of the Pantheon
1 Jukai Naturalist
1 Mesa Enchantress
1 Mindwrack Harpy
1 Narci, Fable Singer
1 Nessian Wanderer
1 Nyx Weaver
1 Nyxborn Behemoth
1 Ondu Spiritdancer
1 Sanctum Weaver
1 Satyr Enchanter
1 Setessan Champion
1 Spirited Companion
1 Starfield Mystic
1 Sythis, Harvest's Hand
1 Verduran Enchantress
1 Path to Exile
1 Culling Ritual
1 Extinguish All Hope
1 Farseek
1 Kodama's Reach
1 Rampant Growth
1 Arcane Signet
1 Sol Ring
1 Abundance
1 Battle at the Helvault
1 Battle for Bretagard
1 Binding the Old Gods
1 Boon of the Spirit Realm
1 Cacophony Unleashed
1 Cast Out
1 Cunning Rhetoric
1 Dreadhorde Invasion
1 Enchantress's Presence
1 Felidar Retreat
1 Font of Fertility
1 Ghoulish Impetus
1 Grasp of Fate
1 Khalni Heart Expedition
1 Love Song of Night and Day
1 Mirari's Wake
1 Omen of the Hunt
1 Omen of the Sun
1 Sandwurm Convergence
1 Sigil of the Empty Throne
1 Starfield of Nyx
1 The Binding of the Titans
1 The Eldest Reborn
1 The Mending of Dominaria
1 Calix, Destiny's Hand
1 Ash Barrens
1 Canopy Vista
1 Command Tower
1 Exotic Orchard
8 Forest
1 Fortified Village
1 Golgari Rot Farm
1 Krosan Verge
1 Necroblossom Snarl
1 Orzhov Basilica
6 Plains
1 Sandsteppe Citadel
1 Selesnya Sanctuary
1 Shineshadow Snarl
1 Sungrass Prairie
5 Swamp
1 Tainted Field
1 Tainted Wood
1 Temple of Malady
1 Temple of Plenty
1 Temple of Silence`,
  },
  {
    id: 'cmm-planeswalker-party',
    name: 'Planeswalker Party',
    set: 'CMM',
    setName: 'Commander Masters',
    year: 2023,
    colors: ['W', 'U', 'R'],
    commanderName: 'Commodore Guff',
    theme: 'Superfriends / Planeswalkers',
    decklist: `// Commander
1 Commodore Guff

// Deck
1 Cartographer's Hawk
1 Deepglow Skate
1 Flux Channeler
1 Fog Bank
1 Grateful Apparition
1 Jaya's Phoenix
1 Kazuul, Tyrant of the Cliffs
1 Leori, Sparktouched Hunter
1 Mangara, the Diplomat
1 Narset, Enlightened Master
1 Onakke Oathkeeper
1 Oreskos Explorer
1 Silent Arbiter
1 Spark Double
1 Sparkshaper Visionary
1 Thrummingbird
1 Wall of Denial
1 Ajani Steadfast
1 Chandra, Awakened Inferno
1 Chandra, Legacy of Fire
1 Chandra, Torch of Defiance
1 Elspeth, Sun's Champion
1 Gideon Jura
1 Jace Beleren
1 Jace, Architect of Thought
1 Jace, Mirror Mage
1 Nahiri, the Harbinger
1 Narset of the Ancient Way
1 Narset, Parter of Veils
1 Saheeli, Sublime Artificer
1 Sarkhan the Masterless
1 Teyo, Geometric Tactician
1 The Wanderer
1 Vronos, Masked Inquisitor
1 Guff Rewrites History
1 Path to Exile
1 Repeated Reverberation
1 Semester's End
1 Swords to Plowshares
1 Blasphemous Act
1 Deploy the Gatewatch
1 Promise of Loyalty
1 Urza's Ruinous Blast
1 Arcane Signet
1 Azorius Signet
1 Boros Signet
1 Fellwar Stone
1 Gatewatch Beacon
1 Honor-Worn Shaku
1 Izzet Signet
1 Nevinyrral's Disk
1 Norn's Annex
1 Sol Ring
1 Talisman of Conviction
1 Talisman of Creativity
1 Talisman of Progress
1 The Chain Veil
1 Wayfarer's Bauble
1 Oath of Gideon
1 Oath of Jace
1 Oath of Teferi
1 Cascade Bluffs
1 Command Tower
1 Exotic Orchard
1 Forge of Heroes
1 Frostboil Snarl
1 Furycalm Snarl
1 Interplanar Beacon
1 Karn's Bastion
1 Mobilized District
1 Myriad Landscape
1 Mystic Gate
1 Mystic Monastery
1 Port Town
1 Prairie Stream
1 Reliquary Tower
1 Rugged Prairie
1 Skycloud Expanse
1 Temple of Enlightenment
1 Temple of Epiphany
1 Temple of Triumph
7 Plains
7 Island
4 Mountain`,
  },
]

// Murders at Karlov Manor Commander 2024
const KARLOV_MANOR_COMMANDER_2024: PreconDeck[] = [
  {
    id: 'mkm-deadly-disguise',
    name: 'Deadly Disguise',
    set: 'MKC',
    setName: 'Murders at Karlov Manor Commander',
    year: 2024,
    colors: ['R', 'G', 'W'],
    commanderName: 'Kaust, Eyes of the Glade',
    theme: 'Disguise / Faces',
    decklist: `// Commander
1 Kaust, Eyes of the Glade

// Deck
1 Duskana, the Rage Mother
1 True Identity
1 Unexplained Absence
1 Veiled Ascension
1 Boltbender
1 Showstopping Surprise
1 Tesak, Judith's Hellhound
1 Experiment Twelve
1 Printlifter Ooze
1 Panoptic Projektor
1 Ransom Note
1 Ugin's Mastery
1 Austere Command
1 Dusk // Dawn
1 Exalted Angel
1 Fell the Mighty
1 Hidden Dragonslayer
1 Master of Pearls
1 Mastery of the Unseen
1 Mirror Entity
1 Welcoming Vampire
1 Akroma, Angel of Fury
1 Ashcloud Phoenix
1 Chaos Warp
1 Imperial Hellkite
1 Jeska's Will
1 Neheb, the Eternal
1 Scourge of the Throne
1 Beast Whisperer
1 Deathmist Raptor
1 Den Protector
1 Hooded Hydra
1 Krosan Cloudscraper
1 Krosan Colossus
1 Obscuring Aether
1 Ohran Frostfang
1 Return of the Wildspeaker
1 Root Elemental
1 Saryth, the Viper's Fang
1 Seedborn Muse
1 Temur War Shaman
1 Thelonite Hermit
1 Toski, Bearer of Secrets
1 Trail of Mystery
1 Whisperwood Elemental
1 Yedora, Grave Gardener
1 Decimate
1 Sidar Kondo of Jamuraa
1 Lifecrafter's Bestiary
1 Scroll of Fate
1 Canopy Vista
1 Cinder Glade
1 Exotic Orchard
1 Fortified Village
1 Furycalm Snarl
1 Game Trail
1 Kessig Wolf Run
1 Mossfire Valley
1 Mosswort Bridge
1 Scattered Groves
1 Sheltered Thicket
1 Shrine of the Forsaken Gods
1 Sungrass Prairie
1 Temple of Abandon
1 Temple of Plenty
1 Temple of Triumph
1 Path to Exile
1 Ainok Survivalist
1 Broodhatch Nantuko
1 Nervous Gardener
1 Nantuko Vigilante
1 Nature's Lore
1 Sakura-Tribe Elder
1 Salt Road Ambushers
1 Three Visits
1 Wild Growth
1 Arcane Signet
1 Sol Ring
1 Boros Garrison
1 Command Tower
1 Branch of Vitu-Ghazi
1 Gruul Turf
1 Jungle Shrine
1 Krosan Verge
1 Sacred Peaks
1 Selesnya Sanctuary
1 Temple of the False God
1 Zoetic Cavern
4 Plains
3 Mountain
4 Forest`,
  },
  {
    id: 'mkm-deep-clue-sea',
    name: 'Deep Clue Sea',
    set: 'MKC',
    setName: 'Murders at Karlov Manor Commander',
    year: 2024,
    colors: ['W', 'U', 'G'],
    commanderName: 'Morska, Undersea Sleuth',
    theme: 'Investigate / Sea Creatures',
    decklist: `// Commander
1 Morska, Undersea Sleuth

// Deck
1 Sophia, Dogged Detective
1 Armed with Proof
1 Merchant of Truth
1 Serene Sleuth
1 Detective of the Month
1 Follow the Bodies
1 Tangletrove Kelp
1 Innocuous Researcher
1 On the Trail
1 Knowledge Is Power
1 Ransom Note
1 Aerial Extortionist
1 Bennie Bracks, Zoologist
1 Farewell
1 Fumigate
1 Organic Extinction
1 Search the Premises
1 Alandra, Sky Dreamer
1 Confirm Suspicions
1 Ethereal Investigator
1 Finale of Revelation
1 Kappa Cannoneer
1 Mechanized Production
1 Nadir Kraken
1 Shimmer Dragon
1 Teferi's Ageless Insight
1 Tezzeret, Betrayer of Flesh
1 Thought Monitor
1 Hornet Queen
1 Jolrael, Mwonvuli Recluse
1 Killer Service
1 Tireless Tracker
1 Adrix and Nev, Twincasters
1 Chulane, Teller of Tales
1 Disorder in the Court
1 Esix, Fractal Bloom
1 Hydroid Krasis
1 Koma, Cosmos Serpent
1 Lonis, Cryptozoologist
1 Selvala, Explorer Returned
1 Academy Manufactor
1 Idol of Oblivion
1 Inspiring Statuary
1 Nettlecyst
1 Psychosis Crawler
1 Canopy Vista
1 Exotic Orchard
1 Irrigated Farmland
1 Prairie Stream
1 Scattered Groves
1 Skycloud Expanse
1 Spire of Industry
1 Sungrass Prairie
1 Temple of Enlightenment
1 Temple of Mystery
1 Temple of Plenty
1 Swords to Plowshares
1 Erdwal Illuminator
1 Junk Winder
1 Ongoing Investigation
1 Whirler Rogue
1 Graf Mole
1 Ulvenwald Mysteries
1 Wilderness Reclamation
1 Wavesifter
1 Arcane Signet
1 Azorius Signet
1 Simic Signet
1 Sol Ring
1 Talisman of Curiosity
1 Talisman of Progress
1 Talisman of Unity
1 Azorius Chancery
1 Magnifying Glass
1 Command Tower
1 Krosan Verge
1 Lonely Sandbar
1 Path of Ancestry
1 Reliquary Tower
1 Seaside Citadel
1 Secluded Steppe
1 Selesnya Sanctuary
1 Simic Growth Chamber
1 Temple of the False God
1 Tranquil Thicket
3 Plains
6 Island
5 Forest`,
  },
]

// Outlaws of Thunder Junction Commander 2024
const OTJ_COMMANDER_2024: PreconDeck[] = [
  {
    id: 'otj-most-wanted',
    name: 'Most Wanted',
    set: 'OTC',
    setName: 'Outlaws of Thunder Junction Commander',
    year: 2024,
    colors: ['W', 'B', 'R'],
    commanderName: 'Olivia, Opulent Outlaw',
    theme: 'Outlaws / Treasures',
    decklist: `// Commander
1 Olivia, Opulent Outlaw

// Deck
1 Academy Manufactor
1 Aetherborn Marauder
1 Angelic Sell-Sword
1 Angrath's Marauders
1 Breena, the Demagogue
1 Captain Lannery Storm
1 Captivating Crew
1 Changeling Outcast
1 Charred Graverobber
1 Dire Fleet Daredevil
1 Dire Fleet Ravager
1 Fain, the Broker
1 Graywater's Fixer
1 Grenzo, Havoc Raiser
1 Humble Defector
1 Impulsive Pilferer
1 Kamber, the Plunderer
1 Laurine, the Diversion
1 Mari, the Killing Quill
1 Marshland Bloodcaster
1 Massacre Girl
1 Mirror Entity
1 Misfortune Teller
1 Mistmeadow Skulk
1 Morbid Opportunist
1 Nighthawk Scavenger
1 Ogre Slumlord
1 Queen Marchesa
1 Rankle, Master of Pranks
1 Tenured Inkcaster
1 Veinwitch Coven
1 Vihaan, Goldwaker
1 Witch of the Moors
1 Boros Charm
1 Curtains' Call
1 Dead Before Sunrise
1 Deadly Dispute
1 Heliod's Intervention
1 Shoot the Sheriff
1 Back in Town
1 Council's Judgment
1 Feed the Swarm
1 Hex
1 Mass Mutiny
1 Painful Truths
1 Requisition Raid
1 Seize the Spotlight
1 Arcane Signet
1 Bandit's Haul
1 Bounty Board
1 Glittering Stockpile
1 Idol of Oblivion
1 Lightning Greaves
1 Orzhov Signet
1 Rakdos Signet
1 Sol Ring
1 Trailblazer's Boots
1 Discreet Retreat
1 Life Insurance
1 Rain of Riches
1 Shiny Impetus
1 We Ride at Dawn
1 Battlefield Forge
1 Blackcleave Cliffs
1 Bojuka Bog
1 Bonders' Enclave
1 Canyon Slough
1 Caves of Koilos
1 Clifftop Retreat
1 Command Beacon
1 Command Tower
1 Demolition Field
1 Desolate Mire
1 Dragonskull Summit
1 Exotic Orchard
1 Fetid Heath
1 Isolated Chapel
1 Nomad Outpost
1 Path of Ancestry
1 Rogue's Passage
1 Rugged Prairie
1 Shadowblood Ridge
1 Smoldering Marsh
1 Sulfurous Springs
1 Sunhome, Fortress of the Legion
1 Tainted Peak
1 Temple of Malice
1 Temple of Silence
1 Temple of Triumph
1 Temple of the False God
1 Vault of the Archangel
2 Mountain
2 Plains
4 Swamp`,
  },
]

// Bloomburrow Commander 2024
const BLOOMBURROW_COMMANDER_2024: PreconDeck[] = [
  {
    id: 'blb-family-matters',
    name: 'Family Matters',
    set: 'BLC',
    setName: 'Bloomburrow Commander',
    year: 2024,
    colors: ['W', 'U', 'R'],
    commanderName: 'Zinnia, Valley\'s Voice',
    theme: 'Rabbits / Token generation',
    decklist: `// Commander
1 Zinnia, Valley's Voice

// Deck
1 Arthur, Marigold Knight
1 Elspeth, Sun's Champion
1 Jazal Goldmane
1 Martial Coup
1 Storm of Souls
1 Selfless Spirit
1 Murmuration
1 Blade Splicer
1 Hanged Executioner
1 Loyal Warhound
1 Restoration Angel
1 Jacked Rabbit
1 Skyclave Apparition
1 Dusk // Dawn
1 Boss's Chauffeur
1 Angel of the Ruins
1 Luminous Broodmoth
1 Sun Titan
1 Pollywog Prodigy
1 Fortune Teller's Talent
1 Aether Channeler
1 Pull from Tomorrow
1 Shield Broker
1 Stolen by the Fae
1 Rapid Augmenter
1 Bident of Thassa
1 Curiosity Crafter
1 Devilish Valet
1 Siege-Gang Commander
1 Echoing Assault
1 Agate Instigator
1 Calamity of Cinders
1 Rose Room Treasurer
1 Combat Celebrant
1 Inferno Titan
1 Time Wipe
1 Solemn Simulacrum
1 Helm of the Host
1 Glacial Fortress
1 Adarkar Wastes
1 Temple of Enlightenment
1 Castle Ardenvale
1 Seachrome Coast
1 Sulfur Falls
1 Cascade Bluffs
1 Exotic Orchard
1 Clifftop Retreat
1 Shivan Reef
1 Temple of Triumph
1 Battlefield Forge
1 Skycloud Expanse
1 Temple of Epiphany
1 Ferrous Lake
1 Rugged Prairie
1 Sunscorched Divide
1 Spirited Companion
1 Inspiring Overseer
1 Cut a Deal
1 Path to Exile
1 Illusory Ambusher
1 Rowdy Research
1 Plumecreed Escort
1 Rapid Hybridization
1 Junk Winder
1 Aetherize
1 Chart a Course
1 Tetsuko Umezawa, Fugitive
1 Thopter Engineer
1 Cloudblazer
1 Arcane Signet
1 Boros Signet
1 Ornithopter of Paradise
1 Azorius Signet
1 Izzet Signet
1 Circuit Mender
1 Fellwar Stone
1 Sol Ring
1 Mind Stone
1 Terramorphic Expanse
1 Path of Ancestry
1 Thriving Heath
1 Evolving Wilds
1 Thriving Isle
1 Thriving Bluff
1 Command Tower
1 Mystic Monastery
5 Plains
4 Island
4 Mountain`,
  },
]

// ── Full catalog ──────────────────────────────────────────────────────────────

/**
 * All seeded precons.
 *
 * To add more:
 *   1. Create a new const array following the PreconDeck interface above.
 *   2. Spread it into ALL_PRECONS here.
 *   3. Each precon needs: id (slug), name, set, setName, year, colors,
 *      commanderName, and decklist (plain text, "// Commander" section header).
 *
 * Full WotC precon coverage is an ongoing data task (~150+ decks total).
 * Priority order for future data drops:
 *   - Commander 2011–2020 (foundation sets)
 *   - Commander 2021 + Strixhaven
 *   - Adventures in the Forgotten Realms Commander
 *   - Innistrad + New Capenna + Streets of New Capenna Commander
 *   - Dominaria United + Brothers' War Commander
 *   - March of the Machine + Wilds of Eldraine Commander
 *   - Duskmourn + Aetherdrift Commander
 */
export const ALL_PRECONS: PreconDeck[] = [
  ...COMMANDER_MASTERS_2023,
  ...KARLOV_MANOR_COMMANDER_2024,
  ...OTJ_COMMANDER_2024,
  ...BLOOMBURROW_COMMANDER_2024,
]

/** Get a precon by id. */
export function getPreconById(id: string): PreconDeck | undefined {
  return ALL_PRECONS.find((p) => p.id === id)
}

/** Filter precons by set, year, or color. */
export function filterPrecons(opts: {
  set?: string
  year?: number
  color?: string
  search?: string
}): PreconDeck[] {
  return ALL_PRECONS.filter((p) => {
    if (opts.set && p.set !== opts.set) return false
    if (opts.year && p.year !== opts.year) return false
    if (opts.color && !p.colors.includes(opts.color.toUpperCase())) return false
    if (opts.search) {
      const q = opts.search.toLowerCase()
      if (!p.name.toLowerCase().includes(q) && !p.commanderName.toLowerCase().includes(q)) return false
    }
    return true
  })
}

/** Unique set names in the catalog. */
export function getAvailableSets(): Array<{ set: string; setName: string; year: number }> {
  const seen = new Map<string, { set: string; setName: string; year: number }>()
  for (const p of ALL_PRECONS) {
    if (!seen.has(p.set)) seen.set(p.set, { set: p.set, setName: p.setName, year: p.year })
  }
  return [...seen.values()].sort((a, b) => b.year - a.year)
}
