const deckBuilderStorageKey = "magic-table-tracker-decks-v1";
const scryfallSearchCacheKey = "magic-table-tracker-scryfall-cache-v1";
const gameChangerCacheKey = "magic-table-tracker-game-changers-v1";

const deckBuilder = {
  decks: [],
  activeDeckId: "",
  results: [],
  favorites: new Set(),
  searchCache: new Map(),
  autocompleteTimer: null,
  autocompleteRequestId: 0,
  storageAvailable: true,
  deckListQuery: "",
  pendingFocusCardId: "",
  artPickerEntryId: "",
  artPickerMode: "entry",
  artPickerPrints: [],
  artPickerSelectedIndex: 0,
  artPickerRequestId: 0,
  libraryDeckId: "",
  libraryView: "list",
  libraryCardId: "",
  librarySuggestedCard: null,
  librarySuggestedNote: "",
  librarySuggestedRole: "",
  reviewDismissedSuggestions: new Set(),
  reviewVisibleSuggestions: [],
  drawDeckId: "",
};

const deckEls = {
  form: document.querySelector("#deckCardSearch"),
  search: document.querySelector("#deckSearchInput"),
  suggestions: document.querySelector("#deckSearchSuggestions"),
  format: document.querySelector("#deckSearchFormat"),
  colors: document.querySelector("#deckSearchColors"),
  sort: document.querySelector("#deckSearchSort"),
  results: document.querySelector("#deckResults"),
  newDeck: document.querySelector("#newDeckButton"),
  saveDeck: document.querySelector("#saveDeckButton"),
  importToTable: document.querySelector("#importDeckToTableButton"),
  review: document.querySelector("#reviewDeckButton"),
  drawHand: document.querySelector("#drawHandButton"),
  moxfieldInput: document.querySelector("#moxfieldDeckInput"),
  importMoxfield: document.querySelector("#importMoxfieldDeckButton"),
  name: document.querySelector("#deckNameInput"),
  deckFormat: document.querySelector("#deckFormatInput"),
  bracket: document.querySelector("#deckBracketOutput"),
  notes: document.querySelector("#deckNotesInput"),
  deckListSearch: document.querySelector("#deckListSearchInput"),
  stats: document.querySelector("#deckStats"),
  manaProfile: document.querySelector("#deckManaProfile"),
  warnings: document.querySelector("#deckWarnings"),
  aiReview: document.querySelector("#deckAiReview"),
  toast: document.querySelector("#deckToast"),
  savedSummary: document.querySelector("#savedDecksSummary"),
  savedGrid: document.querySelector("#savedDecksGrid"),
  list: document.querySelector("#deckList"),
  imageModal: document.querySelector("#deckImageModal"),
  imageModalTitle: document.querySelector("#deckImageTitle"),
  imagePreview: document.querySelector("#deckImagePreview"),
  imageStatus: document.querySelector("#deckImageStatus"),
  artChoices: document.querySelector("#deckArtChoices"),
  selectArt: document.querySelector("#selectDeckArtButton"),
  imageAdd: document.querySelector("#deckImageAddButton"),
  imageCmdr: document.querySelector("#deckImageCmdrButton"),
  closeImageModal: document.querySelector("#closeDeckImageModal"),
  libraryModal: document.querySelector("#deckLibraryModal"),
  libraryTitle: document.querySelector("#deckLibraryTitle"),
  libraryContent: document.querySelector("#deckLibraryContent"),
  libraryBack: document.querySelector("#deckLibraryBackButton"),
  librarySelect: document.querySelector("#selectDeckLibraryButton"),
  closeLibraryModal: document.querySelector("#closeDeckLibraryModal"),
  drawModal: document.querySelector("#drawHandModal"),
  drawTitle: document.querySelector("#drawHandTitle"),
  drawGrid: document.querySelector("#drawHandGrid"),
  drawAgain: document.querySelector("#drawAgainButton"),
  closeDrawModal: document.querySelector("#closeDrawHandModal"),
  closeDrawButton: document.querySelector("#closeDrawHandButton"),
};

const requiredDeckElements = Object.values(deckEls);
const deckBuilderReady = requiredDeckElements.every(Boolean);

const commanderGameChangers = new Set([
  "ad nauseam",
  "ancient tomb",
  "biorhythm",
  "bolas's citadel",
  "chrome mox",
  "consecrated sphinx",
  "cyclonic rift",
  "deflecting swat",
  "demonic tutor",
  "doubling season",
  "drannith magistrate",
  "enlightened tutor",
  "esper sentinel",
  "farewell",
  "fierce guardianship",
  "food chain",
  "force of will",
  "gaea's cradle",
  "grand abolisher",
  "grim monolith",
  "humility",
  "imperial seal",
  "intuition",
  "jeska's will",
  "lion's eye diamond",
  "mana crypt",
  "mana drain",
  "mana vault",
  "mox diamond",
  "mystic remora",
  "rhystic study",
  "smothering tithe",
  "survival of the fittest",
  "the one ring",
  "thassa's oracle",
  "underworld breach",
  "vampiric tutor",
  "worldly tutor",
].map(normalizeDeckCardName));

let commanderGameChangerNames = new Set(commanderGameChangers);

function readCachedGameChangers() {
  try {
    const cached = JSON.parse(localStorage.getItem(gameChangerCacheKey) || "{}");
    return Array.isArray(cached.names) ? cached.names : [];
  } catch {
    return [];
  }
}

function writeCachedGameChangers(names) {
  try {
    localStorage.setItem(gameChangerCacheKey, JSON.stringify({
      updatedAt: new Date().toISOString(),
      names,
    }));
  } catch {
    // The seeded list still covers the badge if local storage is unavailable.
  }
}

function seedGameChangerNames() {
  commanderGameChangerNames = new Set([
    ...commanderGameChangers,
    ...readCachedGameChangers().map(normalizeDeckCardName),
  ]);
}

function isGameChangerCard(cardOrName) {
  const name = typeof cardOrName === "string" ? cardOrName : cardOrName?.name;
  return commanderGameChangerNames.has(normalizeDeckCardName(name || ""));
}

function appendGameChangerBadge(container, cardOrName) {
  if (!isGameChangerCard(cardOrName)) return;

  const badge = document.createElement("span");
  badge.className = "game-changer-badge";
  badge.textContent = "Game Changer";
  container.appendChild(badge);
}

const commanderBracketNames = {
  1: "Bracket 1 - Exhibition",
  2: "Bracket 2 - Core",
  3: "Bracket 3 - Upgraded",
  4: "Bracket 4 - Optimized",
  5: "Bracket 5 - cEDH",
};

const cardRecommendationCatalog = [
  { name: "Arcane Signet", role: "ramp", tags: ["any"], bracketMax: 4, why: "It fixes colors cheaply and helps your deck start doing its real thing a turn earlier." },
  { name: "Nature's Lore", role: "ramp", colors: ["G"], tags: ["green"], bracketMax: 4, why: "It finds typed Forest duals untapped, which smooths colors without costing tempo." },
  { name: "Fellwar Stone", role: "ramp", tags: ["any"], bracketMax: 4, why: "At multiplayer tables it usually taps for useful colors and keeps two-mana ramp density healthy." },
  { name: "Swords to Plowshares", role: "interaction", colors: ["W"], tags: ["white"], bracketMax: 4, why: "It answers almost any creature for one mana, protecting your game plan without eating a whole turn." },
  { name: "Beast Within", role: "interaction", colors: ["G"], tags: ["green"], bracketMax: 4, why: "It hits creatures, combo pieces, lands, and problem permanents, which gives the deck flexible table coverage." },
  { name: "Pongify", role: "interaction", colors: ["U"], tags: ["blue"], bracketMax: 4, why: "It gives blue decks a clean one-mana answer to creature-based engines and commanders." },
  { name: "Village Rites", role: "draw", colors: ["B"], tags: ["sacrifice", "aristocrats"], bracketMax: 3, why: "It turns expendable creatures into cards, which is perfect when your deck already wants bodies to die." },
  { name: "Skullclamp", role: "draw", tags: ["tokens", "sacrifice", "creatures"], bracketMax: 4, why: "Your small creatures become a repeatable draw engine, especially if the deck is making tokens." },
  { name: "Guardian Project", role: "draw", colors: ["G"], tags: ["creatures"], bracketMax: 3, why: "Creature-heavy lists need steady refill, and this rewards you for simply casting your threats." },
  { name: "Archmage Emeritus", role: "draw", colors: ["U"], tags: ["spellslinger", "storm"], bracketMax: 3, why: "Every instant and sorcery starts replacing itself, which keeps spell chains from running dry." },
  { name: "Storm-Kiln Artist", role: "ramp", colors: ["R"], tags: ["spellslinger", "storm"], bracketMax: 3, why: "It turns each spell into mana, helping the deck chain big turns while still attacking if needed." },
  { name: "Young Pyromancer", role: "engine", colors: ["R"], tags: ["spellslinger", "tokens"], bracketMax: 3, why: "It converts normal spellcasting into board presence, giving your noncreature plan a creature payoff." },
  { name: "Anointed Procession", role: "engine", colors: ["W"], tags: ["tokens"], bracketMax: 3, why: "If your deck already makes tokens, doubling that output makes every token maker scale dramatically harder." },
  { name: "Aura Shards", role: "interaction", colors: ["G", "W"], tags: ["tokens", "creatures"], bracketMax: 3, why: "Creature and token production becomes repeatable artifact/enchantment removal, which is excellent board control." },
  { name: "Hardened Scales", role: "engine", colors: ["G"], tags: ["counters"], bracketMax: 3, why: "It makes every +1/+1 counter effect more efficient, increasing pressure without needing extra cards." },
  { name: "Kami of Whispered Hopes", role: "ramp", colors: ["G"], tags: ["counters"], bracketMax: 3, why: "It both increases counter placement and turns your board growth into mana for larger follow-up plays." },
  { name: "Foundry Inspector", role: "ramp", tags: ["artifacts"], bracketMax: 3, why: "Artifact decks love cost reduction because it lets several cheap pieces land in the same turn." },
  { name: "Thought Monitor", role: "draw", colors: ["U"], tags: ["artifacts"], bracketMax: 3, why: "Affinity turns your artifact count into cheap card draw on a relevant body." },
  { name: "Victimize", role: "recursion", colors: ["B"], tags: ["graveyard", "sacrifice"], bracketMax: 3, why: "It converts one creature into two better creatures from the graveyard, which is a huge tempo swing." },
  { name: "Eternal Witness", role: "recursion", colors: ["G"], tags: ["graveyard", "value"], bracketMax: 3, why: "It rebuying your best spell gives the deck resilience after removal or a failed push." },
  { name: "Sythis, Harvest's Hand", role: "draw", colors: ["G", "W"], tags: ["enchantments"], bracketMax: 3, why: "Enchantress decks need draw tied to enchantment casting, and Sythis makes every setup piece replace itself." },
  { name: "Sram, Senior Edificer", role: "draw", colors: ["W"], tags: ["equipment", "auras"], bracketMax: 3, why: "Equipment and Aura decks can run out of gas; Sram turns those setup cards into a steady hand." },
  { name: "Well of Lost Dreams", role: "draw", tags: ["lifegain"], bracketMax: 3, why: "If you are already gaining life, this converts that life gain into real card advantage." },
  { name: "Vito, Thorn of the Dusk Rose", role: "finisher", colors: ["B"], tags: ["lifegain"], bracketMax: 3, why: "It turns life gain into opponent life loss, giving the deck a cleaner way to close games." },
  { name: "Mystic Remora", role: "draw", colors: ["U"], tags: ["optimized"], bracketMin: 4, why: "At stronger tables, it taxes fast noncreature starts and draws enough cards to keep pace." },
  { name: "Fierce Guardianship", role: "interaction", colors: ["U"], tags: ["optimized"], bracketMin: 4, why: "Free protection lets your commander or combo turn survive without holding mana open." },
];

const reviewSuggestionTargetCount = 5;

function safeReadJson(key, fallback) {
  if (!deckBuilder.storageAvailable) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    deckBuilder.storageAvailable = false;
    return fallback;
  }
}

function safeWriteJson(key, value) {
  if (!deckBuilder.storageAvailable) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    deckBuilder.storageAvailable = false;
  }
}

function createDeck() {
  const id = `deck-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    name: "New Commander Deck",
    format: "commander",
    commanderName: "",
    commanderScryfallId: "",
    commanderArtUrl: "",
    bracket: null,
    powerLevel: 7,
    tags: [],
    notes: "",
    isFavorite: false,
    version: 1,
    cards: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeSavedCard(card = {}) {
  return {
    id: card.id || card.scryfall_id || `00000000-0000-4000-8000-${Math.random().toString().slice(2, 14).padStart(12, "0")}`,
    oracle_id: card.oracle_id || "",
    illustration_id: card.illustration_id || "",
    name: card.name || "Unknown card",
    type_line: card.type_line || card.typeLine || "",
    oracle_text: card.oracle_text || card.oracleText || "",
    mana_cost: card.mana_cost || card.manaCost || "",
    cmc: Number(card.cmc ?? card.manaValue ?? 0),
    color_identity: Array.isArray(card.color_identity) ? card.color_identity : Array.isArray(card.colorIdentity) ? card.colorIdentity : [],
    legalities: card.legalities || {},
    image_uris: card.image_uris || card.imageUris || {},
    card_faces: card.card_faces || card.cardFaces,
    keywords: Array.isArray(card.keywords) ? card.keywords : [],
    scryfall_uri: card.scryfall_uri || card.scryfallUri || "",
    prices: card.prices || {},
    produced_mana: Array.isArray(card.produced_mana) ? card.produced_mana : Array.isArray(card.producedMana) ? card.producedMana : [],
  };
}

function normalizeSavedDeck(deck) {
  const fallback = createDeck();
  return {
    ...fallback,
    ...deck,
    id: deck?.id || fallback.id,
    name: deck?.name || fallback.name,
    format: deck?.format || fallback.format,
    cards: Array.isArray(deck?.cards)
      ? deck.cards.map((entry) => {
          const cardSnapshot = entry.card || entry.card_snapshot || entry.cardSnapshot || {
            ...entry,
            id: entry.scryfallId || entry.scryfall_id || entry.id,
            name: entry.cardName || entry.name,
          };

          return {
            id: entry.id || `card-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            quantity: Math.max(1, Number(entry.quantity || 1)),
            section: ["commander", "mainboard", "sideboard", "maybeboard"].includes(entry.section) ? entry.section : "mainboard",
            card: normalizeSavedCard(cardSnapshot),
            tags: Array.isArray(entry.tags) ? entry.tags : [],
            notes: entry.notes || "",
          };
        })
      : [],
  };
}

function getActiveDeck() {
  if (!deckBuilder.decks.length) {
    const deck = createDeck();
    deckBuilder.decks.push(deck);
    deckBuilder.activeDeckId = deck.id;
  }

  return deckBuilder.decks.find((deck) => deck.id === deckBuilder.activeDeckId) || deckBuilder.decks[0];
}

function loadDeckBuilder() {
  const saved = safeReadJson(deckBuilderStorageKey, {});
  deckBuilder.decks = Array.isArray(saved.decks) && saved.decks.length ? saved.decks.map(normalizeSavedDeck) : [createDeck()];
  deckBuilder.activeDeckId = saved.activeDeckId || deckBuilder.decks[0].id;
  deckBuilder.favorites = new Set(Array.isArray(saved.favorites) ? saved.favorites : []);

  const cached = safeReadJson(scryfallSearchCacheKey, []);
  deckBuilder.searchCache = new Map(Array.isArray(cached) ? cached : []);
}

function saveDeckBuilder() {
  const deck = getActiveDeck();
  deck.updatedAt = new Date().toISOString();
  deck.version += 1;

  safeWriteJson(deckBuilderStorageKey, {
    decks: deckBuilder.decks,
    activeDeckId: deckBuilder.activeDeckId,
    favorites: [...deckBuilder.favorites],
  });

  const cacheEntries = [...deckBuilder.searchCache.entries()].slice(-40);
  safeWriteJson(scryfallSearchCacheKey, cacheEntries);
  window.dispatchEvent(new CustomEvent("mtg-deck-library-updated"));
}

function getDeckCardImage(card) {
  const faces = card?.card_faces?.[0]?.image_uris;
  return card?.image_uris?.png ||
    card?.image_uris?.large ||
    card?.image_uris?.normal ||
    faces?.png ||
    faces?.large ||
    faces?.normal ||
    "";
}

function getDeckCardArtCrop(card) {
  return card?.image_uris?.art_crop ||
    card?.card_faces?.[0]?.image_uris?.art_crop ||
    getDeckCardImage(card);
}

function getDeckCardArtKey(card) {
  const faceWithArt = card?.card_faces?.find((face) => face.illustration_id || face.image_uris?.art_crop || face.image_uris?.normal);
  return card?.illustration_id ||
    faceWithArt?.illustration_id ||
    card?.image_uris?.art_crop ||
    faceWithArt?.image_uris?.art_crop ||
    getDeckCardImage(card);
}

function getUniqueDeckArtPrints(cards) {
  const seen = new Set();
  return cards.filter((card) => {
    const imageUrl = getDeckCardImage(card);
    if (!imageUrl) return false;
    const key = getDeckCardArtKey(card) || imageUrl;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getOracleText(card) {
  return card?.oracle_text || card?.card_faces?.map((face) => face.oracle_text).filter(Boolean).join(" ") || "";
}

function normalizeCard(card) {
  return {
    id: card.id,
    oracle_id: card.oracle_id,
    illustration_id: card.illustration_id || card.card_faces?.find((face) => face.illustration_id)?.illustration_id || "",
    name: card.name,
    type_line: card.type_line || card.card_faces?.[0]?.type_line || "",
    oracle_text: getOracleText(card),
    mana_cost: card.mana_cost || card.card_faces?.[0]?.mana_cost || "",
    cmc: Number(card.cmc || 0),
    color_identity: card.color_identity || [],
    legalities: card.legalities || {},
    image_uris: card.image_uris || card.card_faces?.[0]?.image_uris || {},
    card_faces: card.card_faces || [],
    keywords: Array.isArray(card.keywords) ? card.keywords : [],
    scryfall_uri: card.scryfall_uri || "",
    prices: card.prices || {},
    produced_mana: Array.isArray(card.produced_mana) ? card.produced_mana : [],
  };
}

function getDeckPrintSubtitle(card, fallback = "") {
  const setName = card.set_name || card.setName;
  const collectorNumber = card.collector_number || card.collectorNumber;
  return [setName, collectorNumber].filter(Boolean).join(" #") || fallback;
}

function getDeckArtGridShape(count) {
  const safeCount = Math.max(1, count);
  const isCompact = typeof window !== "undefined" && window.matchMedia?.("(max-width: 720px)").matches;
  const ratio = isCompact ? 0.72 : 1.36;
  const columns = Math.min(safeCount, Math.max(1, Math.ceil(Math.sqrt(safeCount * ratio))));
  return {
    columns,
    rows: Math.max(1, Math.ceil(safeCount / columns)),
  };
}

async function fetchDeckCardPrints(name) {
  const exactNameQuery = encodeURIComponent(`!"${name}"`);
  const response = await fetch(`https://api.scryfall.com/cards/search?unique=prints&order=released&q=${exactNameQuery}`);
  if (!response.ok) {
    throw new Error("No prints found");
  }

  const data = await response.json();
  return getUniqueDeckArtPrints(data.data || []);
}

async function fetchDeckNamedCard(name) {
  const url = new URL("https://api.scryfall.com/cards/named");
  url.searchParams.set("exact", name);
  return fetchScryfallJson(url);
}

function setDeckStatus(message, tone = "info") {
  deckEls.aiReview.hidden = false;
  deckEls.aiReview.textContent = message;
  deckEls.aiReview.dataset.tone = tone;
}

function clearDeckStatus() {
  deckEls.aiReview.hidden = true;
  deckEls.aiReview.textContent = "";
  deckEls.aiReview.removeAttribute("data-tone");
}

function showDeckToast(message, tone = "success") {
  deckEls.toast.textContent = message;
  deckEls.toast.dataset.tone = tone;
  deckEls.toast.hidden = false;
  deckEls.toast.classList.remove("show");
  void deckEls.toast.offsetWidth;
  deckEls.toast.classList.add("show");
  window.clearTimeout(deckEls.toastTimer);
  deckEls.toastTimer = window.setTimeout(() => {
    deckEls.toast.hidden = true;
    deckEls.toast.classList.remove("show");
  }, 1800);
}

function deckExtractMoxfieldId(link) {
  const trimmed = link.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/decks\/([^/?#]+)/i);
    return match?.[1] || "";
  } catch {
    return trimmed;
  }
}

function deckExtractJsonFromRelayText(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Relay did not return JSON");
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

async function deckFetchJsonWithRelay(url) {
  try {
    const direct = await fetch(url);
    if (direct.ok) return direct.json();
  } catch {
    // Browser/file origins can hit CORS blocks before a response exists.
  }

  const relays = [
    `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];

  for (const relayUrl of relays) {
    try {
      const relayed = await fetch(relayUrl);
      if (!relayed.ok) continue;

      const text = await relayed.text();
      const jsonText = deckExtractJsonFromRelayText(text);
      const parsed = JSON.parse(jsonText);
      return typeof parsed.contents === "string" ? JSON.parse(parsed.contents) : parsed;
    } catch {
      // Try the next public relay.
    }
  }

  throw new Error("Deck unavailable");
}

function deckGetBoardEntries(deck, boardName) {
  const board =
    deck[boardName] ||
    deck.boards?.[boardName]?.cards ||
    deck.boards?.[boardName] ||
    deck[`${boardName}Cards`] ||
    {};

  if (Array.isArray(board)) return board;
  if (Array.isArray(board.cards)) return board.cards;
  return Object.values(board || {});
}

function deckGetCardName(card) {
  return card.name || card.cardName || card.faceName || card.front?.name || "Unknown card";
}

function normalizeMoxfieldDeckCards(deck) {
  const boardNames = ["commanders", "mainboard", "sideboard", "companions", "maybeboard"];
  const cards = [];

  boardNames.forEach((boardName) => {
    deckGetBoardEntries(deck, boardName).forEach((entry) => {
      const card = entry.card || entry.Card || entry;
      if (!card) return;

      cards.push({
        quantity: Math.max(1, Number(entry.quantity || entry.qty || 1)),
        board: boardName,
        name: deckGetCardName(card),
        type_line: card.type_line || card.typeLine || card.type || "",
        oracle_text: card.oracle_text || card.oracleText || card.text || "",
        mana_cost: card.mana_cost || card.manaCost || "",
        cmc: Number(card.cmc ?? card.manaValue ?? 0),
        color_identity: card.color_identity || card.colorIdentity || [],
        legalities: card.legalities || {},
        image_uris: card.image_uris || card.imageUris || card.imageUrls || card.card?.image_uris || {},
        card_faces: card.card_faces || card.cardFaces,
        raw: card,
      });
    });
  });

  return cards.filter((card) => card.name && card.name !== "Unknown card");
}

function moxfieldBoardToDeckSection(board) {
  if (board === "commanders") return "commander";
  if (board === "sideboard" || board === "companions") return "sideboard";
  if (board === "maybeboard") return "maybeboard";
  return "mainboard";
}

async function hydrateMoxfieldCardsWithScryfall(cards) {
  const hydrated = [];

  for (let index = 0; index < cards.length; index += 75) {
    const chunk = cards.slice(index, index + 75);
    const response = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifiers: chunk.map((card) => ({ name: card.name })),
      }),
    });

    if (!response.ok) {
      throw new Error("Could not hydrate Moxfield deck with Scryfall");
    }

    const data = await response.json();
    const found = new Map((data.data || []).map((card) => [card.name.toLowerCase(), card]));
    chunk.forEach((card) => {
      const scryfall = found.get(card.name.toLowerCase());
      hydrated.push({
        ...card,
        card: normalizeCard(scryfall || card),
      });
    });
  }

  return hydrated;
}

function getMoxfieldDeckName(deck, deckId) {
  return deck.name || deck.deckName || deck.title || `Moxfield deck ${deckId}`;
}

function isBlankStarterDeck(deck) {
  return !deck.cards.length &&
    deck.name === "New Commander Deck" &&
    !deck.notes &&
    !deck.commanderName;
}

function getDeckForMoxfieldImport(deckId) {
  const existing = deckBuilder.decks.find((deck) => deck.sourceDeckId === deckId || deck.sourceUrl === `https://moxfield.com/decks/${deckId}`);
  if (existing) {
    deckBuilder.activeDeckId = existing.id;
    deckBuilder.deckListQuery = "";
    deckEls.deckListSearch.value = "";
    saveDeckBuilder();
    renderDeckEditor();
    showDeckToast("Deck already imported!", "warning");
    setDeckStatus("Deck already imported. I opened the saved copy instead.", "warning");
    return null;
  }

  const active = getActiveDeck();
  if (isBlankStarterDeck(active)) {
    return active;
  }

  const deck = createDeck();
  deckBuilder.decks.push(deck);
  deckBuilder.activeDeckId = deck.id;
  return deck;
}

function applyMoxfieldDeckToBuilder(moxfieldDeck, cards, deckId) {
  const deck = getDeckForMoxfieldImport(deckId);
  if (!deck) return false;

  const entries = cards.map((card) => ({
    id: `card-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    quantity: card.quantity,
    section: moxfieldBoardToDeckSection(card.board),
    card: card.card || normalizeSavedCard(card),
    tags: [],
    notes: "",
  }));
  const commander = entries.find((entry) => entry.section === "commander") || entries[0];

  deck.name = getMoxfieldDeckName(moxfieldDeck, deckId);
  deck.format = "commander";
  deck.cards = entries;
  deck.sourceUrl = `https://moxfield.com/decks/${deckId}`;
  deck.sourceDeckId = deckId;
  deck.commanderName = commander?.card?.name || "";
  deck.commanderScryfallId = commander?.card?.id || "";
  deck.commanderArtUrl = commander ? getDeckCardArtCrop(commander.card) : "";
  deckBuilder.pendingFocusCardId = commander?.id || entries[0]?.id || "";
  deckBuilder.deckListQuery = "";
  deckEls.deckListSearch.value = "";
  invalidateDeckReview(deck);

  saveDeckBuilder();
  renderDeckEditor();
  showDeckToast("Deck loaded!", "success");
  return true;
}

function tableBoardToDeckSection(board) {
  if (board === "commanders" || board === "commander") return "commander";
  if (board === "sideboard" || board === "companions") return "sideboard";
  if (board === "maybeboard") return "maybeboard";
  return "mainboard";
}

function normalizeTableDeckCard(card = {}) {
  const raw = card.raw || card.card || card;
  return normalizeCard({
    ...raw,
    id: raw.id || raw.scryfall_id || raw.scryfallId || card.scryfall_id || card.id,
    oracle_id: raw.oracle_id || raw.oracleId || card.oracle_id,
    name: card.name || raw.name,
    type_line: card.type_line || raw.type_line || raw.typeLine || "",
    oracle_text: card.oracle_text || raw.oracle_text || raw.oracleText || raw.text || "",
    mana_cost: card.mana_cost || raw.mana_cost || raw.manaCost || "",
    cmc: card.cmc ?? raw.cmc ?? raw.manaValue ?? 0,
    color_identity: card.color_identity || raw.color_identity || raw.colorIdentity || [],
    legalities: card.legalities || raw.legalities || {},
    image_uris: card.image_uris || raw.image_uris || raw.imageUris || raw.imageUrls || {},
    card_faces: card.card_faces || raw.card_faces || raw.cardFaces,
    prices: card.prices || raw.prices || {},
    produced_mana: card.produced_mana || raw.produced_mana || raw.producedMana || [],
  });
}

function getDeckForTableImport() {
  const active = getActiveDeck();
  const isUnusedStarter =
    !active.cards.length &&
    active.name === "New Commander Deck" &&
    !active.notes &&
    !active.commanderName;

  if (isUnusedStarter) {
    return active;
  }

  const deck = createDeck();
  deckBuilder.decks.push(deck);
  deckBuilder.activeDeckId = deck.id;
  return deck;
}

function getDeckSignature(cards) {
  return cards
    .map((card) => `${normalizeDeckCardName(card.name)}:${card.quantity || 1}:${tableBoardToDeckSection(card.board || card.section || "")}`)
    .sort()
    .join("|");
}

function importTableDeckToBuilder(detail = {}) {
  const cards = Array.isArray(detail.cards) ? detail.cards : [];
  if (!cards.length) {
    setDeckStatus("That table deck does not have cards to import yet.", "warning");
    return;
  }

  const incomingSignature = getDeckSignature(cards);
  const duplicate = deckBuilder.decks.find((deck) => getDeckSignature(deck.cards.map((entry) => ({
    name: entry.card.name,
    quantity: entry.quantity,
    board: entry.section,
  }))) === incomingSignature);
  if (duplicate) {
    deckBuilder.activeDeckId = duplicate.id;
    saveDeckBuilder();
    renderDeckEditor();
    showDeckToast("Deck already imported!", "warning");
    setDeckStatus("Deck already imported. I opened the saved copy instead.", "warning");
    return;
  }

  const deck = getDeckForTableImport();
  const entries = cards.map((card) => ({
    id: `card-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    quantity: Math.max(1, Number(card.quantity || 1)),
    section: tableBoardToDeckSection(card.board),
    card: normalizeTableDeckCard(card),
    tags: [],
    notes: "",
  }));
  const commander = entries.find((entry) => entry.section === "commander") || entries[0];

  deck.name = detail.name || detail.commanderName || "Table deck";
  deck.format = detail.format || "commander";
  deck.cards = entries;
  deck.sourceUrl = "";
  deck.commanderName = detail.commanderName || commander?.card?.name || "";
  deck.commanderScryfallId = commander?.card?.id || "";
  deck.commanderArtUrl = detail.commanderArtUrl || (commander ? getDeckCardArtCrop(commander.card) : "");
  deckBuilder.pendingFocusCardId = commander?.id || entries[0]?.id || "";
  deckBuilder.deckListQuery = "";
  deckEls.deckListSearch.value = "";
  invalidateDeckReview(deck);

  saveDeckBuilder();
  clearDeckStatus();
  renderDeckEditor();
  setDeckStatus(`Imported ${entries.reduce((sum, entry) => sum + entry.quantity, 0)} cards from the life counter.`, "success");
}

function deckExtractArchidektId(link) {
  const m = String(link || "").match(/archidekt\.com\/decks\/(\d+)/i);
  return m ? m[1] : "";
}

function normalizeArchidektDeckCards(data) {
  const cards = [];
  (data && data.cards ? data.cards : []).forEach((entry) => {
    const name = entry && entry.card && entry.card.oracleCard && entry.card.oracleCard.name;
    if (!name) return;
    const cats = (entry.categories || []).map((c) => String(c).toLowerCase());
    const board = cats.some((c) => c.indexOf("commander") !== -1)
      ? "commanders"
      : cats.some((c) => c.indexOf("sideboard") !== -1)
        ? "sideboard"
        : cats.some((c) => c.indexOf("maybe") !== -1)
          ? "maybeboard"
          : "mainboard";
    cards.push({ quantity: Math.max(1, Number(entry.quantity || 1)), board, name, type_line: "", oracle_text: "" });
  });
  return cards;
}

async function importArchidektToDeckBuilder(deckId) {
  deckEls.importMoxfield.disabled = true;
  deckEls.importMoxfield.textContent = "Importing...";
  setDeckStatus("Importing Archidekt deck...", "info");
  try {
    const data = await deckFetchJsonWithRelay("https://archidekt.com/api/decks/" + deckId + "/small/");
    if (!data) throw new Error("Archidekt deck unavailable");
    const cards = normalizeArchidektDeckCards(data);
    if (!cards.length) throw new Error("No cards found");
    const hydrated = await hydrateMoxfieldCardsWithScryfall(cards);
    applyMoxfieldDeckToBuilder({ name: data.name || ("Archidekt deck " + deckId) }, hydrated, "archidekt-" + deckId);
    const n = hydrated.reduce((sum, card) => sum + (card.quantity || 1), 0);
    setDeckStatus("Imported " + n + " cards from Archidekt.", "success");
  } catch {
    setDeckStatus("Could not import that Archidekt deck. If it is private, make it public.", "warning");
  } finally {
    deckEls.importMoxfield.disabled = false;
    deckEls.importMoxfield.textContent = "Import deck";
  }
}

async function importMoxfieldToDeckBuilder() {
  const value = deckEls.moxfieldInput.value.trim();
  const archiId = deckExtractArchidektId(value);
  if (archiId) { await importArchidektToDeckBuilder(archiId); return; }
  const deckId = deckExtractMoxfieldId(value);
  if (!deckId) {
    setDeckStatus("Paste a Moxfield deck link or deck ID first.", "warning");
    return;
  }

  deckEls.importMoxfield.disabled = true;
  deckEls.importMoxfield.textContent = "Importing...";
  setDeckStatus("Importing Moxfield deck...", "info");

  try {
    let moxfieldDeck = null;
    const endpoints = [
      `https://api2.moxfield.com/v3/decks/all/${encodeURIComponent(deckId)}`,
      `https://api2.moxfield.com/v2/decks/all/${encodeURIComponent(deckId)}`,
    ];

    for (const endpoint of endpoints) {
      try {
        moxfieldDeck = await deckFetchJsonWithRelay(endpoint);
        if (moxfieldDeck) break;
      } catch {
        // Try the next known public deck endpoint.
      }
    }

    if (!moxfieldDeck) throw new Error("Moxfield deck unavailable");

    const cards = normalizeMoxfieldDeckCards(moxfieldDeck);
    if (!cards.length) throw new Error("No cards found");

    const hydratedCards = await hydrateMoxfieldCardsWithScryfall(cards);
    const imported = applyMoxfieldDeckToBuilder(moxfieldDeck, hydratedCards, deckId);
    if (imported) {
      setDeckStatus(`Imported ${hydratedCards.reduce((sum, card) => sum + card.quantity, 0)} cards from Moxfield.`, "success");
    }
  } catch {
    setDeckStatus("Could not import that Moxfield deck. If it is private, make it public or paste an exported list into the player deck box.", "warning");
  } finally {
    deckEls.importMoxfield.disabled = false;
    deckEls.importMoxfield.textContent = "Import deck";
  }
}

// Public helper: resolve a Moxfield/Archidekt deck URL (or ID) to a plain card list for the tabletop.
// Reuses the CORS-relay fetch + normalizers. Returns { name, cards:[{name,qty,isCommander}] } or null.
window.MTGDeckUrlImport = async function (input) {
  const value = String(input || "").trim();
  const archiId = deckExtractArchidektId(value);
  const moxId = archiId ? "" : deckExtractMoxfieldId(value);
  try {
    let deckName = "Imported deck", normalized = null;
    if (archiId) {
      const data = await deckFetchJsonWithRelay("https://archidekt.com/api/decks/" + archiId + "/small/");
      if (!data) return null;
      deckName = data.name || ("Archidekt deck " + archiId);
      normalized = normalizeArchidektDeckCards(data);
    } else if (moxId) {
      let mox = null;
      const endpoints = [
        "https://api2.moxfield.com/v3/decks/all/" + encodeURIComponent(moxId),
        "https://api2.moxfield.com/v2/decks/all/" + encodeURIComponent(moxId),
      ];
      for (const ep of endpoints) { try { mox = await deckFetchJsonWithRelay(ep); if (mox) break; } catch (e) {} }
      if (!mox) return null;
      deckName = getMoxfieldDeckName(mox, moxId);
      normalized = normalizeMoxfieldDeckCards(mox);
    } else {
      return null;
    }
    if (!normalized || !normalized.length) return null;
    // Only commander + mainboard belong in a game (drop sideboard/maybeboard/companions).
    const cards = normalized
      .filter((c) => c.board === "commanders" || c.board === "mainboard")
      .map((c) => ({ name: c.name, qty: Math.max(1, Number(c.quantity || 1)), isCommander: c.board === "commanders" }));
    return cards.length ? { name: deckName, cards } : null;
  } catch (e) {
    return null;
  }
};

function buildSearchQuery() {
  const terms = [deckEls.search.value.trim()];
  const format = deckEls.format.value;
  const colors = deckEls.colors.value.trim().toLowerCase().replace(/[^wubrg]/g, "");

  if (format) terms.push(`f:${format}`);
  if (colors) terms.push(`id<=${colors}`);

  return terms.filter(Boolean).join(" ");
}

async function fetchScryfallJson(url) {
  const cacheKey = url.toString();
  if (deckBuilder.searchCache.has(cacheKey)) {
    return deckBuilder.searchCache.get(cacheKey);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Scryfall request failed");
  }

  const json = await response.json();
  deckBuilder.searchCache.set(cacheKey, json);
  return json;
}

async function refreshGameChangerList() {
  const names = new Set(commanderGameChangerNames);
  let url = new URL("https://api.scryfall.com/cards/search");
  url.searchParams.set("q", "is:gamechanger");
  url.searchParams.set("unique", "cards");
  url.searchParams.set("order", "name");

  try {
    while (url) {
      const data = await fetchScryfallJson(url);
      (data.data || []).forEach((card) => {
        if (card.name) {
          names.add(normalizeDeckCardName(card.name));
        }
      });
      url = data.has_more && data.next_page ? new URL(data.next_page) : null;
    }

    commanderGameChangerNames = names;
    writeCachedGameChangers([...names]);
    renderDeckResults();
    renderDeckEditor();
  } catch {
    // Keep the seeded/cached list if Scryfall is unavailable.
  }
}

async function searchCards() {
  const query = buildSearchQuery();
  if (!query.trim()) {
    deckEls.results.textContent = "Search by card name, type, keyword, or Scryfall syntax.";
    return;
  }

  deckEls.results.textContent = "Searching Scryfall...";
  hideDeckSuggestions();

  try {
    const url = new URL("https://api.scryfall.com/cards/search");
    url.searchParams.set("q", query);
    url.searchParams.set("order", deckEls.sort.value || "name");
    url.searchParams.set("unique", "cards");
    url.searchParams.set("include_extras", "false");
    const data = await fetchScryfallJson(url);
    deckBuilder.results = data.data || [];
    renderDeckResults();
    saveDeckBuilder();
  } catch {
    deckEls.results.textContent = "Could not search Scryfall right now.";
  }
}

async function updateDeckAutocomplete() {
  const query = deckEls.search.value.trim();
  if (query.length < 2) {
    hideDeckSuggestions();
    return;
  }

  window.clearTimeout(deckBuilder.autocompleteTimer);
  const requestId = ++deckBuilder.autocompleteRequestId;
  deckBuilder.autocompleteTimer = window.setTimeout(async () => {
    try {
      const url = new URL("https://api.scryfall.com/cards/autocomplete");
      url.searchParams.set("q", query);
      url.searchParams.set("include_extras", "false");
      const data = await fetchScryfallJson(url);
      if (requestId !== deckBuilder.autocompleteRequestId || deckEls.search.value.trim() !== query) {
        return;
      }
      renderDeckSuggestions(data.data || []);
    } catch {
      hideDeckSuggestions();
    }
  }, 180);
}

function renderDeckSuggestions(names) {
  deckEls.suggestions.innerHTML = "";
  names.slice(0, 12).forEach((name) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name;
    button.addEventListener("click", () => {
      deckEls.search.value = name;
      hideDeckSuggestions();
      searchCards();
    });
    deckEls.suggestions.appendChild(button);
  });
  deckEls.suggestions.hidden = names.length === 0;
}

function hideDeckSuggestions() {
  deckEls.suggestions.hidden = true;
  deckEls.suggestions.innerHTML = "";
}

function addCardToDeck(card, section = "mainboard") {
  const deck = getActiveDeck();
  const normalized = normalizeCard(card);
  const existing = deck.cards.find((entry) => entry.card.name === normalized.name && entry.section === section);
  let targetId = "";

  if (existing) {
    existing.quantity += 1;
    targetId = existing.id;
  } else {
    const entry = {
      id: `card-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      quantity: 1,
      section,
      card: normalized,
      tags: [],
      notes: "",
    };
    deck.cards.push(entry);
    targetId = entry.id;
  }

  if (section === "commander") {
    deck.commanderName = normalized.name;
    deck.commanderScryfallId = normalized.id;
    deck.commanderArtUrl = getDeckCardArtCrop(normalized);
  }

  deckBuilder.pendingFocusCardId = targetId;
  deckBuilder.deckListQuery = "";
  deckEls.deckListSearch.value = "";
  invalidateDeckReview(deck);
  saveDeckBuilder();
  renderDeckEditor();
}

function changeDeckQuantity(entryId, delta) {
  const deck = getActiveDeck();
  const entry = deck.cards.find((card) => card.id === entryId);
  if (!entry) return;

  entry.quantity += delta;
  deckBuilder.pendingFocusCardId = entry.id;
  if (entry.quantity <= 0) {
    deckBuilder.pendingFocusCardId = "";
    deck.cards = deck.cards.filter((card) => card.id !== entryId);
  }

  invalidateDeckReview(deck);
  saveDeckBuilder();
  renderDeckEditor();
}

function changeDeckSection(entryId, section) {
  const deck = getActiveDeck();
  const entry = deck.cards.find((card) => card.id === entryId);
  if (!entry) return;

  entry.section = section;
  deckBuilder.pendingFocusCardId = entry.id;
  if (section === "commander") {
    deck.commanderName = entry.card.name;
    deck.commanderScryfallId = entry.card.id;
    deck.commanderArtUrl = getDeckCardArtCrop(entry.card);
  }

  invalidateDeckReview(deck);
  saveDeckBuilder();
  renderDeckEditor();
}

function toggleFavorite(card) {
  const normalized = normalizeCard(card);
  if (deckBuilder.favorites.has(normalized.id)) {
    deckBuilder.favorites.delete(normalized.id);
  } else {
    deckBuilder.favorites.add(normalized.id);
  }
  saveDeckBuilder();
  renderDeckResults();
}

function renderDeckResults() {
  deckEls.results.innerHTML = "";

  if (!deckBuilder.results.length) {
    deckEls.results.textContent = "No cards found.";
    return;
  }

  deckBuilder.results.slice(0, 24).forEach((card) => {
    const normalized = normalizeCard(card);
    const imageUrl = getDeckCardImage(card);
    const result = document.createElement("article");
    result.className = "deck-result-card";
    result.tabIndex = 0;
    result.setAttribute("role", "button");
    result.setAttribute("aria-label", `Preview ${normalized.name}`);
    result.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      openDeckCardPreview(card);
    });
    result.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("button")) return;
      event.preventDefault();
      openDeckCardPreview(card);
    });

    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = normalized.name;
      image.loading = "lazy";
      result.appendChild(image);
    }

    const text = document.createElement("div");
    text.className = "deck-result-text";
    const title = document.createElement("strong");
    title.textContent = normalized.name;
    const type = document.createElement("small");
    type.textContent = normalized.type_line;
    const oracle = document.createElement("p");
    oracle.textContent = normalized.oracle_text.slice(0, 180);
    text.append(title, type);
    appendGameChangerBadge(text, normalized);
    text.appendChild(oracle);
    result.appendChild(text);

    const actions = document.createElement("div");
    actions.className = "deck-result-actions";
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "Add";
    add.addEventListener("click", (event) => {
      event.stopPropagation();
      addCardToDeck(card);
    });
    const commander = document.createElement("button");
    commander.type = "button";
    commander.textContent = "Cmdr";
    commander.title = "Set as commander";
    commander.addEventListener("click", (event) => {
      event.stopPropagation();
      addCardToDeck(card, "commander");
    });
    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.textContent = deckBuilder.favorites.has(normalized.id) ? "Saved" : "Fav";
    favorite.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(card);
    });
    actions.append(add, commander, favorite);
    result.appendChild(actions);

    deckEls.results.appendChild(result);
  });
}

function getDeckStats(deck) {
  const tracked = deck.cards.filter((entry) => entry.section !== "maybeboard");
  const active = tracked.filter((entry) => entry.section !== "sideboard");
  // Single pass: resolve getEntryType once per entry instead of ~7 reduce passes.
  let total = 0, lands = 0, creatures = 0, artifacts = 0, instants = 0, sorceries = 0, manaTotal = 0, manaCount = 0;
  for (const entry of active) {
    const q = entry.quantity, t = getEntryType(entry);
    total += q;
    const isLand = t.includes("land");
    if (isLand) lands += q;
    if (t.includes("creature")) creatures += q;
    if (t.includes("artifact")) artifacts += q;
    if (t.includes("instant")) instants += q;
    if (t.includes("sorcery")) sorceries += q;
    if (!isLand) { manaTotal += entry.card.cmc * q; manaCount += q; }
  }
  const avgMana = manaCount ? manaTotal / manaCount : 0;
  return { total, lands, creatures, artifacts, instants, sorceries, avgMana, active };
}

function getEntryType(entry) {
  return String(entry?.card?.type_line || "").toLowerCase();
}

function isBasicLand(entry) {
  const type = getEntryType(entry);
  return type.includes("basic") && type.includes("land");
}

function getDeckWarnings(deck) {
  const warnings = [];
  const stats = getDeckStats(deck);
  const format = deck.format || "commander";

  if (format === "commander") {
    if (!deck.commanderName) warnings.push("Choose a commander before importing this deck to the table.");
    if (stats.total !== 100) warnings.push(`Commander decks should be 100 cards including commander. Current total: ${stats.total}.`);

    const copies = new Map();
    stats.active.forEach((entry) => {
      copies.set(entry.card.name, (copies.get(entry.card.name) || 0) + entry.quantity);
    });
    stats.active.forEach((entry) => {
      if (!isBasicLand(entry) && copies.get(entry.card.name) > 1) {
        warnings.push(`${entry.card.name} has more than one copy in Commander.`);
      }
    });

    const commander = deck.cards.find((entry) => entry.section === "commander");
    if (commander) {
      const commanderColors = new Set(commander.card.color_identity || []);
      stats.active.forEach((entry) => {
        const offColor = (entry.card.color_identity || []).some((color) => !commanderColors.has(color));
        if (offColor) warnings.push(`${entry.card.name} is outside the commander's color identity.`);
      });
    }
  } else if (stats.total < 60) {
    warnings.push(`${format} decks need at least 60 main deck cards. Current total: ${stats.total}.`);
  }

  stats.active.forEach((entry) => {
    const legality = entry.card.legalities?.[format];
    if (legality && legality !== "legal") {
      warnings.push(`${entry.card.name} is ${legality.replace(/_/g, " ")} in ${format}.`);
    }
  });

  return [...new Set(warnings)].slice(0, 8);
}

function renderDeckStats(deck) {
  const stats = getDeckStats(deck);
  const sections = [
    ["Cards", stats.total],
    ["Lands", stats.lands],
    ["Creatures", stats.creatures],
    ["Avg mana", stats.avgMana.toFixed(2)],
  ];

  deckEls.stats.innerHTML = "";
  sections.forEach(([label, value]) => {
    const stat = document.createElement("div");
    stat.className = "deck-stat";
    const strong = document.createElement("strong");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    stat.append(strong, span);
    deckEls.stats.appendChild(stat);
  });
}

const manaProfileColors = [
  { key: "W", label: "White", symbolUrl: "https://svgs.scryfall.io/card-symbols/W.svg" },
  { key: "U", label: "Blue", symbolUrl: "https://svgs.scryfall.io/card-symbols/U.svg" },
  { key: "B", label: "Black", symbolUrl: "https://svgs.scryfall.io/card-symbols/B.svg" },
  { key: "R", label: "Red", symbolUrl: "https://svgs.scryfall.io/card-symbols/R.svg" },
  { key: "G", label: "Green", symbolUrl: "https://svgs.scryfall.io/card-symbols/G.svg" },
  { key: "C", label: "Colorless", symbolUrl: "https://svgs.scryfall.io/card-symbols/C.svg" },
];

function getManaCostSymbols(card) {
  let mc = String(card.mana_cost || "");
  // MDFC / adventure cards keep their cost on the front face; fall back so their colors still count.
  if (!mc && Array.isArray(card.card_faces) && card.card_faces[0]) mc = String(card.card_faces[0].mana_cost || "");
  return [...mc.matchAll(/\{([^}]+)\}/g)].map((match) => match[1].toUpperCase());
}

function landProducesColor(entry, color) {
  const name = normalizeDeckCardName(entry.card.name);
  const text = String(entry.card.oracle_text || "").toLowerCase();
  const producedMana = Array.isArray(entry.card.produced_mana) ? entry.card.produced_mana.map((mana) => String(mana).toUpperCase()) : [];
  if (producedMana.includes(color)) return true;

  const basicNames = { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" };
  if (basicNames[color] && name.includes(basicNames[color])) return true;
  if (color === "C" && /add \{c\}|add one colorless|add two colorless/.test(text)) return true;
  if (color !== "C" && /add (one mana of )?any color|add mana of any color|mana of any one color|commander's color identity/.test(text)) return true;
  return text.includes(`{${color.toLowerCase()}}`);
}

function getDeckManaProfile(deck) {
  const active = getDeckStats(deck).active;
  if (!active.length) {
    return [];
  }
  const lands = active.filter((entry) => getEntryType(entry).includes("land"));
  const spells = active.filter((entry) => !getEntryType(entry).includes("land"));
  const spellTotal = Math.max(1, spells.reduce((sum, entry) => sum + entry.quantity, 0));
  const landTotal = Math.max(1, lands.reduce((sum, entry) => sum + entry.quantity, 0));
  const symbolCounts = Object.fromEntries(manaProfileColors.map((color) => [color.key, 0]));
  let symbolTotal = 0;

  spells.forEach((entry) => {
    getManaCostSymbols(entry.card).forEach((symbol) => {
      const symbols = symbol.includes("/") ? symbol.split("/") : [symbol];
      symbols.forEach((singleSymbol) => {
        const key = ["W", "U", "B", "R", "G"].includes(singleSymbol) ? singleSymbol : singleSymbol === "C" ? "C" : "";
        if (!key) return;
        symbolCounts[key] += entry.quantity;
        symbolTotal += entry.quantity;
      });
    });
  });
  symbolTotal = Math.max(1, symbolTotal);

  return manaProfileColors.map((color) => {
    const spellMatches = spells.reduce((sum, entry) => {
      const identity = entry.card.color_identity || [];
      const matches = color.key === "C" ? !identity.length : identity.includes(color.key);
      return sum + (matches ? entry.quantity : 0);
    }, 0);
    const landMatches = lands.reduce((sum, entry) => sum + (landProducesColor(entry, color.key) ? entry.quantity : 0), 0);
    return {
      ...color,
      spellPercent: Math.round((spellMatches / spellTotal) * 100),
      symbolPercent: Math.round((symbolCounts[color.key] / symbolTotal) * 100),
      landPercent: Math.round((landMatches / landTotal) * 100),
      barUnits: Math.min(6, Math.max(0, Math.round((symbolCounts[color.key] / symbolTotal) * 6))),
    };
  }).filter((profile) => profile.spellPercent > 0 || profile.symbolPercent > 0 || profile.landPercent > 0);
}

function renderDeckManaProfile(deck) {
  deckEls.manaProfile.innerHTML = "";
  const profiles = getDeckManaProfile(deck);
  deckEls.manaProfile.hidden = profiles.length === 0;
  if (!profiles.length) {
    return;
  }

  const title = document.createElement("div");
  title.className = "mana-profile-title";
  const heading = document.createElement("strong");
  heading.textContent = "Mana color ratios";
  const hint = document.createElement("span");
  hint.textContent = "Percentages can overlap on multi-color cards.";
  title.append(heading, hint);
  deckEls.manaProfile.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "mana-profile-grid";
  profiles.forEach((profile) => {
    const item = document.createElement("article");
    item.className = `mana-profile-item mana-${profile.key.toLowerCase()}`;
    const icon = document.createElement("div");
    icon.className = "mana-profile-icon";
    icon.setAttribute("aria-hidden", "true");
    const symbol = document.createElement("img");
    symbol.src = profile.symbolUrl;
    symbol.alt = "";
    symbol.loading = "lazy";
    const fallback = document.createElement("span");
    fallback.textContent = profile.key;
    symbol.addEventListener("error", () => {
      symbol.hidden = true;
      fallback.classList.add("show");
    }, { once: true });
    icon.append(symbol, fallback);

    const details = document.createElement("div");
    details.className = "mana-profile-details";
    details.innerHTML = `
      <strong>${profile.spellPercent}%</strong>
      <span>${profile.symbolPercent}% of all symbols</span>
      <div class="mana-pips">${Array.from({ length: 6 }, (_, index) => `<i class="${index < profile.barUnits ? "active" : ""}"></i>`).join("")}</div>
      <p>${profile.label} Mana Production</p>
      <div class="mana-bar"><b style="width:${profile.landPercent}%">${profile.landPercent}%</b></div>
      <small>${profile.landPercent}% of symbols on lands</small>
    `;
    item.append(icon, details);
    grid.appendChild(item);
  });
  deckEls.manaProfile.appendChild(grid);
}

function clearDeckWarnings() {
  deckEls.warnings.innerHTML = "";
}

function dismissDeckWarning(item) {
  item.classList.add("closing");
  item.addEventListener("animationend", () => item.remove(), { once: true });
}

function renderDeckWarnings(deck) {
  const warnings = getDeckWarnings(deck);
  deckEls.warnings.innerHTML = "";
  warnings.forEach((warning) => {
    const item = document.createElement("div");
    item.className = "deck-warning";
    const text = document.createElement("span");
    text.textContent = warning;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "deck-warning-close";
    close.setAttribute("aria-label", `Dismiss warning: ${warning}`);
    close.textContent = "X";
    close.addEventListener("click", () => dismissDeckWarning(item));
    item.append(text, close);
    deckEls.warnings.appendChild(item);
  });
}

function renderDeckArtPicker(status = "") {
  const previousPrints = deckBuilder.artPickerPrints;
  const previousSelected = previousPrints[deckBuilder.artPickerSelectedIndex] || previousPrints[0];
  const prints = getUniqueDeckArtPrints(previousPrints);
  if (prints.length !== previousPrints.length) {
    const previousKey = getDeckCardArtKey(previousSelected);
    deckBuilder.artPickerPrints = prints;
    deckBuilder.artPickerSelectedIndex = Math.max(0, prints.findIndex((print) => getDeckCardArtKey(print) === previousKey));
  }
  const selected = prints[deckBuilder.artPickerSelectedIndex] || prints[0];
  if (!selected) return;
  const canSetArt = deckBuilder.artPickerMode === "entry";
  deckEls.selectArt.hidden = !canSetArt;
  deckEls.selectArt.textContent = "Set art";
  // When browsing a search result (preview mode), offer Add-to-deck / Set-as-commander right here.
  const canAdd = deckBuilder.artPickerMode === "preview";
  if (deckEls.imageAdd) deckEls.imageAdd.hidden = !canAdd;
  if (deckEls.imageCmdr) deckEls.imageCmdr.hidden = !canAdd;

  const imageUrl = getDeckCardImage(selected);
  deckEls.imageModalTitle.textContent = selected.name || "Card preview";
  deckEls.imagePreview.src = imageUrl;
  deckEls.imagePreview.alt = selected.name || "Card preview";
  deckEls.imageStatus.textContent = status || getDeckPrintSubtitle(selected, `${deckBuilder.artPickerSelectedIndex + 1} of ${prints.length}`);
  deckEls.artChoices.innerHTML = "";
  const imageLayout = deckEls.artChoices.closest(".deck-image-layout");
  const hasMultipleArts = prints.length > 1;
  deckEls.artChoices.hidden = !hasMultipleArts;
  imageLayout?.classList.toggle("single-art", !hasMultipleArts);
  if (!hasMultipleArts) {
    return;
  }

  const shape = getDeckArtGridShape(prints.length);
  deckEls.artChoices.style.setProperty("--deck-art-columns", shape.columns);
  deckEls.artChoices.style.setProperty("--deck-art-rows", shape.rows);

  prints.forEach((print, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-tile deck-art-choice";
    button.classList.toggle("active", index === deckBuilder.artPickerSelectedIndex);
    button.setAttribute("aria-label", `Preview ${getDeckPrintSubtitle(print, `print ${index + 1}`)}`);

    const image = document.createElement("img");
    image.src = getDeckCardImage(print);
    image.alt = getDeckPrintSubtitle(print, print.name);
    const label = document.createElement("span");
    label.textContent = getDeckPrintSubtitle(print, `Print ${index + 1}`);
    button.append(image, label);

    button.addEventListener("click", () => {
      deckBuilder.artPickerSelectedIndex = index;
      const suffix = canSetArt ? " Click Set art to save." : "";
      renderDeckArtPicker(`${getDeckPrintSubtitle(print, `${index + 1} of ${prints.length}`)} previewed.${suffix}`);
    });

    deckEls.artChoices.appendChild(button);
  });
}

async function openDeckImagePreview(entry) {
  const card = entry.card;
  const imageUrl = getDeckCardImage(card);
  if (!imageUrl || !deckEls.imageModal) return;

  const requestId = deckBuilder.artPickerRequestId + 1;
  deckBuilder.artPickerRequestId = requestId;
  deckBuilder.artPickerMode = "entry";
  deckBuilder.artPickerEntryId = entry.id;
  deckBuilder.artPickerPrints = [card];
  deckBuilder.artPickerSelectedIndex = 0;
  renderDeckArtPicker("Loading all prints...");
  deckEls.imageModal.showModal();

  try {
    const prints = await fetchDeckCardPrints(card.name);
    if (deckBuilder.artPickerRequestId !== requestId || !deckEls.imageModal.open || deckBuilder.artPickerMode !== "entry" || deckBuilder.artPickerEntryId !== entry.id) {
      return;
    }

    if (prints.length) {
      deckBuilder.artPickerPrints = prints;
      const currentImage = getDeckCardImage(card);
      deckBuilder.artPickerSelectedIndex = Math.max(0, prints.findIndex((print) => getDeckCardImage(print) === currentImage));
      renderDeckArtPicker(`${deckBuilder.artPickerSelectedIndex + 1} of ${prints.length} prints`);
    } else {
      renderDeckArtPicker("No alternate prints found");
    }
  } catch {
    if (deckBuilder.artPickerRequestId !== requestId || !deckEls.imageModal.open || deckBuilder.artPickerMode !== "entry" || deckBuilder.artPickerEntryId !== entry.id) {
      return;
    }
    renderDeckArtPicker("Could not load alternate prints");
  }
}

async function openDeckCardPreview(card, status = "Loading all prints...") {
  const normalized = normalizeCard(card);
  const imageUrl = getDeckCardImage(normalized);
  if (!imageUrl || !deckEls.imageModal) return;

  const requestId = deckBuilder.artPickerRequestId + 1;
  deckBuilder.artPickerRequestId = requestId;
  deckBuilder.artPickerMode = "preview";
  deckBuilder.artPickerEntryId = "";
  deckBuilder.artPickerPrints = [normalized];
  deckBuilder.artPickerSelectedIndex = 0;
  renderDeckArtPicker(status);
  deckEls.imageModal.showModal();

  try {
    const prints = await fetchDeckCardPrints(normalized.name);
    if (deckBuilder.artPickerRequestId !== requestId || !deckEls.imageModal.open || deckBuilder.artPickerMode !== "preview") {
      return;
    }

    if (prints.length) {
      deckBuilder.artPickerPrints = prints;
      const currentImage = getDeckCardImage(normalized);
      const currentIndex = prints.findIndex((print) => getDeckCardImage(print) === currentImage || print.id === normalized.id);
      deckBuilder.artPickerSelectedIndex = Math.max(0, currentIndex);
      renderDeckArtPicker(`${deckBuilder.artPickerSelectedIndex + 1} of ${prints.length} prints`);
    } else {
      renderDeckArtPicker("No alternate prints found");
    }
  } catch {
    if (deckBuilder.artPickerRequestId !== requestId || !deckEls.imageModal.open || deckBuilder.artPickerMode !== "preview") {
      return;
    }
    renderDeckArtPicker("Could not load alternate prints");
  }
}

async function openDeckCardPreviewByName(name) {
  try {
    const card = await fetchDeckNamedCard(name);
    openDeckCardPreview(card);
  } catch {
    setDeckStatus(`Could not load a card preview for ${name}.`, "warning");
  }
}

function selectDeckEntryArt() {
  if (deckBuilder.artPickerMode !== "entry") return;
  const deck = getActiveDeck();
  const entry = deck.cards.find((card) => card.id === deckBuilder.artPickerEntryId);
  const selected = deckBuilder.artPickerPrints[deckBuilder.artPickerSelectedIndex];
  if (!entry || !selected) return;

  const normalized = normalizeCard(selected);
  entry.card = {
    ...entry.card,
    ...normalized,
    name: entry.card.name,
    oracle_text: entry.card.oracle_text || normalized.oracle_text,
    type_line: entry.card.type_line || normalized.type_line,
    color_identity: entry.card.color_identity?.length ? entry.card.color_identity : normalized.color_identity,
    legalities: Object.keys(entry.card.legalities || {}).length ? entry.card.legalities : normalized.legalities,
  };

  if (entry.section === "commander") {
    deck.commanderArtUrl = getDeckCardArtCrop(entry.card);
  }

  deckBuilder.pendingFocusCardId = entry.id;
  saveDeckBuilder();
  renderDeckEditor();
  deckEls.imageModal.close();
}

function getDeckListSearchText(entry) {
  return [
    entry.card.name,
    entry.card.type_line,
    entry.card.oracle_text,
    entry.section,
  ].join(" ").toLowerCase();
}

function matchesDeckListSearch(entry) {
  const query = deckBuilder.deckListQuery.trim().toLowerCase();
  return !query || getDeckListSearchText(entry).includes(query);
}

function getDeckListGroup(entry) {
  if (entry.section === "commander") return "commander";
  if (entry.section === "sideboard") return "sideboard";
  if (entry.section === "maybeboard") return "maybeboard";

  const type = getEntryType(entry);
  if (type.includes("legendary") && type.includes("creature")) return "legendary-creatures";
  if (type.includes("creature")) return "creatures";
  if (type.includes("artifact")) return "artifacts";
  if (type.includes("instant")) return "instants";
  if (type.includes("sorcery")) return "sorceries";
  if (type.includes("land")) return "lands";
  if (type.includes("enchantment")) return "enchantments";
  if (type.includes("planeswalker")) return "planeswalkers";
  return "other";
}

const deckListGroupOrder = [
  ["commander", "Commander"],
  ["legendary-creatures", "Legendary creatures"],
  ["creatures", "Creatures"],
  ["artifacts", "Artifacts"],
  ["instants", "Instants"],
  ["sorceries", "Sorceries"],
  ["lands", "Lands"],
  ["enchantments", "Enchantments"],
  ["planeswalkers", "Planeswalkers"],
  ["other", "Other"],
  ["sideboard", "Sideboard"],
  ["maybeboard", "Maybeboard"],
];

function buildDeckListRow(entry) {
  const row = document.createElement("div");
  row.className = "deck-list-row";
  row.dataset.entryId = entry.id;
  if (entry.id === deckBuilder.pendingFocusCardId) {
    row.classList.add("deck-row-flash");
  }

  const imageUrl = getDeckCardImage(entry.card);
  const imageButton = document.createElement("button");
  imageButton.type = "button";
  imageButton.className = "deck-card-thumb";
  imageButton.setAttribute("aria-label", `Enlarge ${entry.card.name}`);
  imageButton.addEventListener("click", () => openDeckImagePreview(entry));
  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = entry.card.name;
    image.loading = "lazy";
    imageButton.appendChild(image);
  } else {
    imageButton.textContent = "?";
    imageButton.disabled = true;
  }

  const quantity = document.createElement("span");
  quantity.className = "deck-qty-badge";
  quantity.textContent = `${entry.quantity}x`;

  const info = document.createElement("div");
  info.className = "deck-card-info";
  const title = document.createElement("strong");
  title.textContent = entry.card.name;
  const type = document.createElement("span");
  type.textContent = entry.card.type_line;
  info.append(title, type);
  appendGameChangerBadge(info, entry.card);

  const select = document.createElement("select");
  ["commander", "mainboard", "sideboard", "maybeboard"].forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === entry.section;
    select.appendChild(option);
  });
  select.addEventListener("change", () => changeDeckSection(entry.id, select.value));

  const minus = document.createElement("button");
  minus.type = "button";
  minus.className = "deck-quantity-button minus";
  minus.textContent = "-";
  minus.setAttribute("aria-label", `Remove one ${entry.card.name}`);
  minus.addEventListener("click", () => changeDeckQuantity(entry.id, -1));

  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "deck-quantity-button plus";
  plus.textContent = "+";
  plus.setAttribute("aria-label", `Add one ${entry.card.name}`);
  plus.addEventListener("click", () => changeDeckQuantity(entry.id, 1));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "X";
  remove.addEventListener("click", () => changeDeckQuantity(entry.id, -entry.quantity));

  row.append(imageButton, quantity, info, select, minus, plus, remove);
  return row;
}

function getSavedDeckTotal(deck) {
  return deck.cards.reduce((sum, entry) => sum + Number(entry.quantity || 1), 0);
}

function getSavedDeckCommander(deck) {
  return deck.cards.find((entry) => entry.section === "commander") || deck.cards[0] || null;
}

function buildSavedDeckPreviewRow(entry) {
  const row = document.createElement("div");
  row.className = "saved-deck-card-row";

  const imageWrap = document.createElement("div");
  imageWrap.className = "deck-card-thumb";
  const imageUrl = getDeckCardImage(entry.card);
  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = entry.card.name;
    image.loading = "lazy";
    imageWrap.appendChild(image);
  } else {
    imageWrap.textContent = "?";
  }

  const quantity = document.createElement("span");
  quantity.className = "deck-qty-badge";
  quantity.textContent = `${entry.quantity}x`;

  const info = document.createElement("div");
  info.className = "deck-card-info";
  const title = document.createElement("strong");
  title.textContent = entry.card.name;
  const type = document.createElement("span");
  type.textContent = entry.card.type_line;
  info.append(title, type);
  appendGameChangerBadge(info, entry.card);

  row.append(imageWrap, quantity, info);
  return row;
}

function buildSavedDeckPreview(deck) {
  const article = document.createElement("article");
  article.className = "saved-deck-card";
  article.classList.toggle("active", deck.id === deckBuilder.activeDeckId);
  article.tabIndex = 0;
  article.setAttribute("role", "button");
  article.setAttribute("aria-label", `Open ${deck.name || "saved deck"}`);
  article.addEventListener("click", () => openDeckLibraryModal(deck.id));
  article.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openDeckLibraryModal(deck.id);
  });

  const commander = getSavedDeckCommander(deck);
  const hero = document.createElement("div");
  hero.className = "saved-deck-hero";
  hero.setAttribute("aria-hidden", "true");
  const commanderImage = deck.commanderArtUrl || (commander ? getDeckCardArtCrop(commander.card) : "");
  if (commanderImage) {
    hero.style.backgroundImage = `url("${commanderImage}")`;
  }

  const titleBlock = document.createElement("div");
  titleBlock.className = "saved-deck-title";
  const title = document.createElement("span");
  title.className = "saved-deck-name-button";
  title.textContent = deck.name || "Untitled deck";
  titleBlock.appendChild(title);

  const header = document.createElement("div");
  header.className = "saved-deck-card-head";
  header.append(hero, titleBlock);
  article.appendChild(header);

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "saved-deck-play";
  playBtn.textContent = "\u25B6 Play";
  playBtn.title = "Open this deck in the virtual tabletop";
  playBtn.style.cssText = "margin-top:8px;background:#14b8a6;color:#06302b;font-weight:700;border:none;border-radius:7px;padding:5px 12px;cursor:pointer;font-size:12px";
  playBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (window.MTGTable && typeof window.MTGTable.playDeck === "function") window.MTGTable.playDeck(deck.id);
  });
  article.appendChild(playBtn);

  return article;
}

function getDeckById(deckId) {
  return deckBuilder.decks.find((deck) => deck.id === deckId) || null;
}

function getCardPageUrl(card) {
  return card.scryfall_uri || `https://scryfall.com/search?exact=${encodeURIComponent(card.name || "")}`;
}

const synergyMatchers = [
  { label: "Counters", terms: ["counter", "proliferate", "+1/+1"] },
  { label: "Tokens", terms: ["token", "create"] },
  { label: "Artifacts", terms: ["artifact", "treasure", "clue", "food"] },
  { label: "Enchantments", terms: ["enchantment", "aura", "saga"] },
  { label: "Graveyard", terms: ["graveyard", "mill", "return target", "reanimate"] },
  { label: "Sacrifice", terms: ["sacrifice", "dies"] },
  { label: "Lifegain", terms: ["gain life", "lifelink"] },
  { label: "Card draw", terms: ["draw a card", "draw two", "draw x"] },
  { label: "Spellslinger", terms: ["instant", "sorcery", "copy target"] },
  { label: "Equipment", terms: ["equipment", "equip"] },
  { label: "Poison", terms: ["poison", "toxic", "infect"] },
  { label: "Combat", terms: ["attack", "combat damage", "double strike"] },
];

function getCardSynergyLabels(entry, deck) {
  const text = `${entry.card.name} ${entry.card.type_line} ${entry.card.oracle_text} ${(entry.card.keywords || []).join(" ")}`.toLowerCase();
  const deckText = getDeckText(deck);
  const labels = new Set();
  synergyMatchers.forEach((matcher) => {
    const cardHit = matcher.terms.some((term) => text.includes(term));
    const deckHit = matcher.terms.some((term) => deckText.includes(term));
    if (cardHit || (deckHit && text.includes(matcher.label.toLowerCase()))) {
      labels.add(matcher.label);
    }
  });
  (entry.card.keywords || []).slice(0, 4).forEach((keyword) => labels.add(keyword));
  return [...labels].slice(0, 8);
}

function getCardRecommendationObjects(entry, deck) {
  const labels = getCardSynergyLabels(entry, deck).map((label) => label.toLowerCase());
  const recommendations = cardRecommendationCatalog
    .filter((card) => card.tags.some((tag) => labels.includes(tag) || labels.some((label) => tag.includes(label))))
    .filter((card) => !hasDeckCard(deck, card.name))
    .slice(0, 3);

  if (recommendations.length) {
    return recommendations.map((card) => ({
      ...card,
      note: card.why,
    }));
  }

  if (labels.length) {
    return labels.slice(0, 3).map((label) => ({
      name: `${label} payoff`,
      role: label.toLowerCase(),
      note: `Look for cards that reward ${label.toLowerCase()} lines already present in this deck.`,
    }));
  }

  return [{
    name: "Role check",
    role: "deck fit",
    note: "This card looks more role-based than keyword-based. Check its mana value, removal role, and whether it supports your commander plan.",
  }];
}

async function hydrateSynergyRecommendations(recommendations) {
  const concreteNames = recommendations
    .filter((recommendation) => cardRecommendationCatalog.some((card) => card.name === recommendation.name))
    .map((recommendation) => recommendation.name);

  if (!concreteNames.length) {
    return recommendations;
  }

  try {
    const response = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifiers: concreteNames.map((name) => ({ name })),
      }),
    });
    if (!response.ok) return recommendations;

    const data = await response.json();
    const found = new Map((data.data || []).map((card) => [normalizeDeckCardName(card.name), normalizeCard(card)]));
    return recommendations.map((recommendation) => ({
      ...recommendation,
      card: found.get(normalizeDeckCardName(recommendation.name)) || null,
    }));
  } catch {
    return recommendations;
  }
}

function openSynergyRecommendationCard(deck, sourceEntry, recommendation) {
  if (!recommendation.card) return;

  deckBuilder.libraryDeckId = deck.id;
  deckBuilder.libraryCardId = sourceEntry?.id || "";
  deckBuilder.libraryView = "suggestion";
  deckBuilder.librarySuggestedCard = normalizeCard(recommendation.card);
  deckBuilder.librarySuggestedNote = recommendation.note || "";
  deckBuilder.librarySuggestedRole = recommendation.role || "synergy";
  renderDeckLibraryModal();
}

function getDismissedSynergySuggestions(container) {
  if (!container.dismissedSynergySuggestions) {
    container.dismissedSynergySuggestions = new Set();
  }
  return container.dismissedSynergySuggestions;
}

function dismissSynergySuggestion(container, item, recommendation) {
  getDismissedSynergySuggestions(container).add(normalizeDeckCardName(recommendation.name));
  item.classList.add("closing");
  item.addEventListener("animationend", () => item.remove(), { once: true });
}

function renderSynergyRecommendations(container, recommendations, deck = null, sourceEntry = null) {
  let list = container.querySelector(".synergy-card-grid");
  if (!list) {
    list = document.createElement("div");
    list.className = "synergy-card-grid";
    container.appendChild(list);
  }

  list.innerHTML = "";
  const dismissedSuggestions = getDismissedSynergySuggestions(container);
  recommendations
    .filter((recommendation) => !dismissedSuggestions.has(normalizeDeckCardName(recommendation.name)))
    .forEach((recommendation) => {
    const item = document.createElement("article");
    item.className = "synergy-card";
    const card = recommendation.card ? normalizeCard(recommendation.card) : null;
    const canPreview = Boolean(card && deck);
    if (canPreview) {
      item.classList.add("clickable");
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.setAttribute("aria-label", `Preview ${recommendation.name}`);
      item.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        openSynergyRecommendationCard(deck, sourceEntry, { ...recommendation, card });
      });
      item.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (event.target.closest("button")) return;
        event.preventDefault();
        openSynergyRecommendationCard(deck, sourceEntry, { ...recommendation, card });
      });
    }

    const close = document.createElement("button");
    close.type = "button";
    close.className = "synergy-card-close";
    close.setAttribute("aria-label", `Dismiss ${recommendation.name}`);
    close.textContent = "X";
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      dismissSynergySuggestion(container, item, recommendation);
    });

    const imageUrl = card ? getDeckCardImage(card) : "";
    const media = document.createElement("div");
    media.className = "synergy-card-image";
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = recommendation.name;
      media.appendChild(image);
    } else {
      media.textContent = "?";
    }

    const copy = document.createElement("div");
    copy.className = "synergy-card-copy";
    const name = document.createElement("strong");
    name.textContent = recommendation.name;
    const role = document.createElement("span");
    role.textContent = recommendation.role || "synergy";
    const note = document.createElement("p");
    note.textContent = recommendation.note;
    copy.append(name, role, note);
    if (card) {
      const actions = document.createElement("div");
      actions.className = "synergy-card-actions";
      const scryfallButton = document.createElement("button");
      scryfallButton.type = "button";
      scryfallButton.className = "synergy-scryfall-button";
      scryfallButton.textContent = "View on Scryfall";
      scryfallButton.addEventListener("click", (event) => {
        event.stopPropagation();
        window.open(getCardPageUrl(card), "_blank", "noopener");
      });
      actions.appendChild(scryfallButton);
      copy.appendChild(actions);
    }

    item.append(close, media, copy);
    list.appendChild(item);
  });
}

function openDeckLibraryCard(deckId, entryId) {
  deckBuilder.libraryDeckId = deckId;
  deckBuilder.libraryCardId = entryId;
  deckBuilder.libraryView = "card";
  deckBuilder.librarySuggestedCard = null;
  deckBuilder.librarySuggestedNote = "";
  deckBuilder.librarySuggestedRole = "";
  renderDeckLibraryModal();
  if (!deckEls.libraryModal.open) {
    deckEls.libraryModal.showModal();
  }
}

function buildDeckLibraryRow(deck, entry) {
  const row = buildSavedDeckPreviewRow(entry);
  row.classList.add("deck-library-card-row");
  row.setAttribute("role", "button");
  row.tabIndex = 0;
  row.addEventListener("click", () => openDeckLibraryCard(deck.id, entry.id));
  row.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openDeckLibraryCard(deck.id, entry.id);
  });
  return row;
}

function renderDeckLibraryList(deck) {
  deckEls.libraryBack.hidden = true;
  deckEls.libraryContent.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "deck-library-list";

  deckListGroupOrder.forEach(([groupKey, label]) => {
    const cards = deck.cards
      .filter((entry) => getDeckListGroup(entry) === groupKey)
      .sort((a, b) => a.card.name.localeCompare(b.card.name));
    if (!cards.length) return;

    const group = document.createElement("section");
    group.className = "saved-deck-card-group";
    const heading = document.createElement("h4");
    heading.textContent = `${label} (${cards.reduce((sum, entry) => sum + entry.quantity, 0)})`;
    group.appendChild(heading);
    cards.forEach((entry) => {
      group.appendChild(buildDeckLibraryRow(deck, entry));
    });
    wrap.appendChild(group);
  });

  deckEls.libraryContent.appendChild(wrap);
}

function renderDeckLibraryCard(deck, entry, options = {}) {
  deckEls.libraryBack.hidden = false;
  deckEls.libraryContent.innerHTML = "";
  const isSuggestion = Boolean(options.isSuggestion);

  const detail = document.createElement("article");
  detail.className = "deck-library-detail";

  const imageFrame = document.createElement("div");
  imageFrame.className = "deck-library-detail-image";
  const imageUrl = getDeckCardImage(entry.card);
  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = entry.card.name;
    imageFrame.appendChild(image);
  }

  const info = document.createElement("div");
  info.className = "deck-library-detail-info";
  const title = document.createElement("h3");
  title.textContent = isSuggestion ? `Suggested: ${entry.card.name}` : entry.card.name;
  const type = document.createElement("p");
  type.textContent = entry.card.type_line;
  const text = document.createElement("p");
  text.textContent = entry.card.oracle_text || "No rules text available.";
  info.append(title, type);
  appendGameChangerBadge(info, entry.card);
  if (isSuggestion && options.note) {
    const suggestionNote = document.createElement("p");
    suggestionNote.className = "deck-library-suggestion-note";
    suggestionNote.textContent = `${options.role || "Synergy"}: ${options.note}`;
    info.appendChild(suggestionNote);
  }
  info.appendChild(text);

  const suggestions = document.createElement("div");
  suggestions.className = "card-synergy-panel";
  const synergyTitle = document.createElement("h4");
  synergyTitle.textContent = "Synergy notes";
  suggestions.appendChild(synergyTitle);

  const chips = document.createElement("div");
  chips.className = "synergy-chips";
  getCardSynergyLabels(entry, deck).forEach((label) => {
    const chip = document.createElement("span");
    chip.textContent = label;
    chips.appendChild(chip);
  });
  suggestions.appendChild(chips);

  const recommendationTitle = document.createElement("h4");
  recommendationTitle.textContent = "Suggested synergy cards";
  suggestions.appendChild(recommendationTitle);
  const recommendations = getCardRecommendationObjects(entry, deck);
  renderSynergyRecommendations(suggestions, recommendations, deck, entry);
  hydrateSynergyRecommendations(recommendations).then((hydrated) => {
    const currentDeckCard = deckBuilder.libraryDeckId === deck.id
      && deckBuilder.libraryCardId === entry.id
      && deckBuilder.libraryView === "card";
    const currentSuggestedCard = isSuggestion
      && deckBuilder.libraryDeckId === deck.id
      && deckBuilder.libraryView === "suggestion"
      && deckBuilder.librarySuggestedCard?.id === entry.card.id;
    if (currentDeckCard || currentSuggestedCard) {
      renderSynergyRecommendations(suggestions, hydrated, deck, entry);
    }
  });

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.textContent = "View on Scryfall";
  openButton.addEventListener("click", () => window.open(getCardPageUrl(entry.card), "_blank", "noopener"));
  info.append(openButton, suggestions);

  detail.append(imageFrame, info);
  deckEls.libraryContent.appendChild(detail);
}

function renderDeckLibraryModal() {
  const deck = getDeckById(deckBuilder.libraryDeckId);
  if (!deck) return;

  deckEls.libraryTitle.textContent = deck.name || "Saved deck";
  deckEls.librarySelect.disabled = false;
  deckEls.librarySelect.textContent = "Select deck";
  if (deckBuilder.libraryView === "card") {
    const entry = deck.cards.find((card) => card.id === deckBuilder.libraryCardId);
    if (entry) {
      renderDeckLibraryCard(deck, entry);
      return;
    }
  }
  if (deckBuilder.libraryView === "suggestion" && deckBuilder.librarySuggestedCard) {
    const card = deckBuilder.librarySuggestedCard;
    renderDeckLibraryCard(deck, {
      id: `suggestion-${card.id || normalizeDeckCardName(card.name)}`,
      quantity: 1,
      section: "suggestion",
      card,
    }, {
      isSuggestion: true,
      note: deckBuilder.librarySuggestedNote,
      role: deckBuilder.librarySuggestedRole,
    });
    return;
  }

  deckBuilder.libraryView = "list";
  deckBuilder.librarySuggestedCard = null;
  deckBuilder.librarySuggestedNote = "";
  deckBuilder.librarySuggestedRole = "";
  renderDeckLibraryList(deck);
}

function openDeckLibraryModal(deckId) {
  deckBuilder.libraryDeckId = deckId;
  deckBuilder.libraryView = "list";
  deckBuilder.libraryCardId = "";
  deckBuilder.librarySuggestedCard = null;
  deckBuilder.librarySuggestedNote = "";
  deckBuilder.librarySuggestedRole = "";
  renderDeckLibraryModal();
  deckEls.libraryModal.showModal();
}

function selectDeckFromLibrary() {
  const deck = getDeckById(deckBuilder.libraryDeckId);
  if (!deck) return;

  deckBuilder.activeDeckId = deck.id;
  deckBuilder.deckListQuery = "";
  deckEls.deckListSearch.value = "";
  saveDeckBuilder();
  clearDeckStatus();
  renderDeckEditor();
  deckEls.libraryModal.close();
  showDeckToast(`${deck.name || "Deck"} selected.`, "success");
}

function renderSavedDeckLibrary() {
  deckEls.savedGrid.innerHTML = "";
  const decks = deckBuilder.decks.filter((deck) => deck.cards.length);
  const totalCards = decks.reduce((sum, deck) => sum + getSavedDeckTotal(deck), 0);
  deckEls.savedSummary.textContent = decks.length
    ? `${decks.length} saved ${decks.length === 1 ? "deck" : "decks"} • ${totalCards} total cards`
    : "No saved decks yet.";

  if (!decks.length) {
    const empty = document.createElement("p");
    empty.className = "saved-decks-empty";
    empty.textContent = "Save or import a deck and it will appear here.";
    deckEls.savedGrid.appendChild(empty);
    return;
  }

  decks.forEach((deck) => {
    deckEls.savedGrid.appendChild(buildSavedDeckPreview(deck));
  });
}

function focusPendingDeckCard() {
  const pendingId = deckBuilder.pendingFocusCardId;
  if (!pendingId) return;

  window.requestAnimationFrame(() => {
    const row = deckEls.list.querySelector?.(`[data-entry-id="${pendingId}"]`);
    if (!row) {
      deckBuilder.pendingFocusCardId = "";
      return;
    }
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      deckBuilder.pendingFocusCardId = "";
    }, 900);
  });
}

function renderDeckList(deck) {
  deckEls.list.innerHTML = "";
  const filteredCards = deck.cards.filter(matchesDeckListSearch);

  deckListGroupOrder.forEach(([groupKey, label]) => {
    const cards = filteredCards
      .filter((entry) => getDeckListGroup(entry) === groupKey)
      .sort((a, b) => {
        if (groupKey === "commander") return a.card.name.localeCompare(b.card.name);
        return a.card.name.localeCompare(b.card.name);
      });
    if (!cards.length) return;

    const group = document.createElement("section");
    group.className = "deck-list-section";
    const heading = document.createElement("h3");
    heading.textContent = `${label} (${cards.reduce((sum, entry) => sum + entry.quantity, 0)})`;
    group.appendChild(heading);

    cards.forEach((entry) => {
      group.appendChild(buildDeckListRow(entry));
    });

    deckEls.list.appendChild(group);
  });

  if (!deck.cards.length) {
    deckEls.list.textContent = "Search for cards and add them here.";
  } else if (!filteredCards.length) {
    deckEls.list.textContent = "No cards in this deck match that search.";
  }

  focusPendingDeckCard();
}

function syncDeckInputs(deck) {
  deckEls.name.value = deck.name;
  deckEls.deckFormat.value = deck.format;
  const bracketText = deck.bracket ? commanderBracketNames[deck.bracket] || `Bracket ${deck.bracket}` : "Review needed";
  deckEls.bracket.value = bracketText;
  deckEls.bracket.textContent = bracketText;
  deckEls.notes.value = deck.notes || "";
}

function renderDeckEditor() {
  const deck = getActiveDeck();
  syncDeckInputs(deck);
  renderDeckStats(deck);
  renderDeckManaProfile(deck);
  clearDeckWarnings();
  deckEls.aiReview.hidden = true;
  deckEls.aiReview.innerHTML = "";
  deckEls.aiReview.removeAttribute("data-tone");
  renderDeckList(deck);
  renderSavedDeckLibrary();
}

function invalidateDeckReview(deck = getActiveDeck()) {
  deck.bracket = null;
  deckBuilder.reviewDismissedSuggestions = new Set();
  deckBuilder.reviewVisibleSuggestions = [];
  if (deckEls.aiReview) {
    deckEls.aiReview.hidden = true;
    deckEls.aiReview.innerHTML = "";
    deckEls.aiReview.removeAttribute("data-tone");
  }
}

function updateDeckFromInputs() {
  const deck = getActiveDeck();
  deck.name = deckEls.name.value.trim() || "Untitled Deck";
  deck.format = deckEls.deckFormat.value;
  deck.notes = deckEls.notes.value;
  saveDeckBuilder();
  renderDeckStats(deck);
  clearDeckWarnings();
}

function normalizeDeckCardName(name = "") {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getDeckText(deck) {
  return deck.cards
    .map((entry) => `${entry.card.name} ${entry.card.type_line} ${entry.card.oracle_text}`)
    .join(" ")
    .toLowerCase();
}

function getDeckNameSet(deck) {
  return new Set(deck.cards.map((entry) => normalizeDeckCardName(entry.card.name)));
}

function hasDeckCard(deck, name) {
  return getDeckNameSet(deck).has(normalizeDeckCardName(name));
}

function getCommanderEntry(deck) {
  return deck.cards.find((entry) => entry.section === "commander") || null;
}

function getDeckColorIdentity(deck) {
  const commander = getCommanderEntry(deck);
  if (commander) {
    return new Set(commander.card.color_identity || []);
  }

  const colors = new Set();
  deck.cards.forEach((entry) => {
    (entry.card.color_identity || []).forEach((color) => colors.add(color));
  });
  return colors;
}

function detectDeckThemes(deck) {
  const text = getDeckText(deck);
  const themes = new Set();
  const themeChecks = [
    ["tokens", ["token", "create a", "populate"]],
    ["spellslinger", ["instant", "sorcery", "magecraft", "copy target instant", "copy target sorcery"]],
    ["storm", ["storm", "copy target instant", "copy target sorcery"]],
    ["counters", ["+1/+1 counter", "proliferate", "counter on"]],
    ["artifacts", ["artifact", "treasure", "equipment"]],
    ["graveyard", ["graveyard", "reanimate", "return target creature card", "escape"]],
    ["sacrifice", ["sacrifice", "dies", "whenever a creature dies"]],
    ["lifegain", ["gain life", "lifelink", "whenever you gain life"]],
    ["enchantments", ["enchantment", "aura", "constellation"]],
    ["equipment", ["equipment", "equip", "aura"]],
    ["creatures", ["creature", "enters the battlefield"]],
  ];

  themeChecks.forEach(([theme, words]) => {
    if (words.some((word) => text.includes(word))) {
      themes.add(theme);
    }
  });

  return themes;
}

// `active` is the already-resolved active card list (stats.active) — avoids recomputing getDeckStats per call.
function countCardsMatching(active, predicate) {
  return active.reduce((sum, entry) => sum + (predicate(entry) ? entry.quantity : 0), 0);
}

function analyzeDeckForBracket(deck) {
  const stats = getDeckStats(deck);
  const names = getDeckNameSet(deck);
  const text = getDeckText(deck);
  const gameChangers = deck.cards
    .filter((entry) => isGameChangerCard(entry.card))
    .map((entry) => entry.card.name);
  const tutors = ["demonic tutor", "vampiric tutor", "imperial seal", "enlightened tutor", "worldly tutor", "mystical tutor", "intuition"].filter((name) => names.has(name));
  const fastMana = ["mana crypt", "mana vault", "sol ring", "chrome mox", "mox diamond", "lion's eye diamond", "grim monolith", "ancient tomb", "jeweled lotus"].filter((name) => names.has(name));
  const freeInteraction = ["force of will", "fierce guardianship", "deflecting swat", "force of negation", "pact of negation"].filter((name) => names.has(name));
  // Two-card infinite/near-infinite combos — require BOTH halves present (fewer false positives).
  const comboSignals = [
    names.has("thassa's oracle") && (names.has("demonic consultation") || names.has("tainted pact")),
    names.has("underworld breach") && (names.has("lion's eye diamond") || names.has("brain freeze")),
    names.has("food chain") && text.includes("exile") && text.includes("creature"),
    names.has("isochron scepter") && names.has("dramatic reversal"),
    names.has("splinter twin") && (names.has("deceiver exarch") || names.has("pestermite")),
    names.has("kiki-jiki, mirror breaker") && (names.has("deceiver exarch") || names.has("pestermite") || names.has("zealous conscripts")),
    names.has("heliod, sun-crowned") && names.has("walking ballista"),
    names.has("mikaeus, the unhallowed") && names.has("triskelion"),
    names.has("noose constrictor") && names.has("nourishing shoal") && names.has("worldspine wurm"),
    names.has("dockside extortionist") && (names.has("temur sabertooth") || names.has("cloudstone curio")),
    names.has("grand architect") && names.has("pili-pala"),
    names.has("devoted druid") && (names.has("vizier of remedies") || names.has("swift reconfiguration")),
  ].filter(Boolean).length;
  const massLandDenial = ["armageddon", "ravages of war", "winter orb", "stasis", "static orb", "decree of annihilation", "jokulhaups", "obliterate", "catastrophe", "sunder", "upheaval", "mana vortex", "ruination", "back to basics", "blood moon", "boil", "choke", "flashfires", "fall of the thran"].filter((name) => names.has(name));
  const extraTurns = deck.cards
    .filter((entry) => entry.section !== "maybeboard" && entry.section !== "sideboard" && /take an extra turn|extra turn after this one/i.test(entry.card.oracle_text || ""))
    .map((entry) => entry.card.name);
  const colorPct = computeDeckColorPct(deck);
  const interactionCount = countCardsMatching(stats.active, (entry) => /destroy target|exile target|counter target|return target|deals .* damage to target/i.test(entry.card.oracle_text));
  const drawCount = countCardsMatching(stats.active, (entry) => /draw (a|two|three|x) card|investigate|connive/i.test(entry.card.oracle_text));
  const rampCount = countCardsMatching(stats.active, (entry) => /add .*mana|search your library for .*land|treasure token/i.test(entry.card.oracle_text)) + fastMana.length;
  const synergyThemes = detectDeckThemes(deck);

  let bracket = 2;
  const reasons = [];

  if (stats.total < 60) {
    bracket = 1;
    reasons.push("The deck is still incomplete, so I would treat it as an exhibition/build-in-progress list until it reaches a full Commander shell.");
  } else {
    reasons.push("The list has enough cards to evaluate as a Commander deck.");
  }

  if (gameChangers.length > 0) {
    bracket = Math.max(bracket, Math.min(4, 2 + gameChangers.length));
    reasons.push(`${gameChangers.length} Game Changer card(s) show up: ${gameChangers.slice(0, 5).join(", ")}${gameChangers.length > 5 ? ", and more" : ""}.`);
  }

  if (stats.total >= 95 && gameChangers.length <= 3 && (rampCount >= 8 || drawCount >= 8 || interactionCount >= 8 || synergyThemes.size >= 2)) {
    bracket = Math.max(bracket, 3);
    reasons.push("The deck has a recognizable engine with enough ramp, draw, interaction, or theme density to feel upgraded rather than stock/precon.");
  }

  if (gameChangers.length > 3 || tutors.length >= 2 || fastMana.length >= 4 || freeInteraction.length >= 2 || massLandDenial.length > 0 || extraTurns.length >= 2) {
    bracket = Math.max(bracket, 4);
    reasons.push("The deck has optimized-table signals such as multiple tutors, fast mana, free interaction, several Game Changers, resource denial, or extra-turn chains.");
  }
  if (extraTurns.length > 0) {
    reasons.push(`${extraTurns.length} extra-turn effect(s) detected: ${extraTurns.slice(0, 4).join(", ")}${extraTurns.length > 4 ? ", and more" : ""}.`);
  }

  if (comboSignals > 0 || (tutors.length >= 3 && fastMana.length >= 4 && gameChangers.length >= 4)) {
    bracket = 5;
    reasons.push("The list shows cEDH-style pressure: compact combo signals, dense tutors, fast mana, or high-efficiency protection.");
  }

  if (stats.total >= 95 && bracket === 2 && gameChangers.length === 0) {
    reasons.push("I do not see obvious Game Changer pressure or compact combo lines, so this looks closer to a core casual Commander build.");
  }

  // Upper/Lower half within the bracket: more "pushed" signals → upper half (closer to the next bracket).
  const pushScore = gameChangers.length * 2 + tutors.length + fastMana.length + freeInteraction.length * 2 + massLandDenial.length * 2 + extraTurns.length + comboSignals * 3;
  const upperThreshold = { 1: 1, 2: 2, 3: 4, 4: 6, 5: 3 };
  const subRating = pushScore >= (upperThreshold[bracket] || 3) ? "U" : "L";

  return {
    bracket,
    subRating,
    bracketLabel: subRating + bracket,
    pushScore,
    reasons,
    gameChangers,
    tutors,
    fastMana,
    freeInteraction,
    massLandDenial,
    extraTurns,
    colorPct,
    comboSignals,
    interactionCount,
    drawCount,
    rampCount,
    themes: [...synergyThemes],
    stats,
  };
}

// Color breakdown by mana pips across the deck (excludes lands' produced mana; counts cost symbols).
const COLOR_PIP_RE = { W: /\{W\}/g, U: /\{U\}/g, B: /\{B\}/g, R: /\{R\}/g, G: /\{G\}/g };
function computeDeckColorPct(deck) {
  const counts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let total = 0;
  deck.cards
    .filter((entry) => entry.section !== "maybeboard" && entry.section !== "sideboard")
    .forEach((entry) => {
      const cost = String(entry.card.mana_cost || "");
      const qty = entry.quantity || 1;
      ["W", "U", "B", "R", "G"].forEach((c) => {
        const n = (cost.match(COLOR_PIP_RE[c]) || []).length; // hoisted regex (no per-entry RegExp alloc)
        if (n) { counts[c] += n * qty; total += n * qty; }
      });
    });
  const pct = {};
  ["W", "U", "B", "R", "G"].forEach((c) => { pct[c] = total ? Math.round((counts[c] / total) * 100) : 0; });
  return { counts, total, pct };
}

// ---------- Card Insights (offline analytics) ----------
// Expand the playable library (excludes commander/maybeboard/sideboard) into a flat card list.
function getLibraryCardList(deck) {
  const list = [];
  deck.cards
    .filter((entry) => entry.section !== "maybeboard" && entry.section !== "sideboard" && entry.section !== "commander")
    .forEach((entry) => { for (let i = 0; i < (entry.quantity || 1); i++) list.push(entry.card); });
  return list;
}
function isLandCard(card) { return String(card.type_line || "").toLowerCase().includes("land"); }
// Hypergeometric probability P(X = k): k successes in n draws from N with K successes.
function hyperProb(N, K, n, k) {
  if (k < 0 || k > K || n - k < 0 || n - k > N - K) return 0;
  const logC = (a, b) => { if (b < 0 || b > a) return -Infinity; let s = 0; for (let i = 0; i < b; i++) s += Math.log(a - i) - Math.log(i + 1); return s; };
  return Math.exp(logC(K, k) + logC(N - K, n - k) - logC(N, n));
}
function computeCardInsights(deck) {
  const lib = getLibraryCardList(deck);
  const N = lib.length;
  if (N < 7) return null;
  const K = lib.filter(isLandCard).length;
  const hand = 7;
  // Opening-hand land distribution.
  const dist = [];
  for (let k = 0; k <= Math.min(hand, K); k++) dist[k] = hyperProb(N, K, hand, k);
  const pKeep = (dist[2] || 0) + (dist[3] || 0) + (dist[4] || 0) + (dist[5] || 0);
  const pFlood = (dist[6] || 0) + (dist[7] || 0);
  const pScrew = (dist[0] || 0) + (dist[1] || 0);
  const avgLands = (hand * K) / N;
  // Curve / early-play density.
  const spells = lib.filter((c) => !isLandCard(c));
  const earlyPlays = spells.filter((c) => (c.cmc || 0) <= 2).length;
  const earlyPct = spells.length ? Math.round((earlyPlays / spells.length) * 100) : 0;
  const avgCmc = spells.length ? spells.reduce((s, c) => s + (c.cmc || 0), 0) / spells.length : 0;
  // Best opener via Monte Carlo (score = keepable lands + cheap-spell count).
  let best = null, bestScore = -1;
  for (let t = 0; t < 400; t++) {
    const idx = [];
    while (idx.length < 7) { const r = Math.floor(Math.random() * N); if (idx.indexOf(r) < 0) idx.push(r); }
    const h = idx.map((i) => lib[i]);
    const nl = h.filter(isLandCard).length;
    const cheap = h.filter((c) => !isLandCard(c) && (c.cmc || 0) <= 3).length;
    const landOk = nl >= 2 && nl <= 4 ? 3 : nl === 1 || nl === 5 ? 1 : 0;
    const score = landOk * 2 + cheap;
    if (score > bestScore) { bestScore = score; best = h; }
  }
  return {
    N, K, avgLands, pKeep, pFlood, pScrew, earlyPct, avgCmc,
    bestOpener: (best || []).map((c) => c.name),
  };
}

function cardFitsDeckColors(card, colors) {
  if (!card.colors?.length) return true;
  return card.colors.every((color) => colors.has(color));
}

function recommendCardsForDeck(deck, analysis, options = {}) {
  const names = getDeckNameSet(deck);
  const colors = getDeckColorIdentity(deck);
  const themes = new Set(analysis.themes);
  const missingRoles = [];
  const excludedNames = new Set([...(options.excludedNames || [])].map(normalizeDeckCardName));
  const limit = Math.max(1, Number(options.limit || 5));
  const relaxed = Boolean(options.relaxed);

  if (analysis.rampCount < 8) missingRoles.push("ramp");
  if (analysis.drawCount < 8) missingRoles.push("draw");
  if (analysis.interactionCount < 8) missingRoles.push("interaction");

  const candidates = cardRecommendationCatalog
    .filter((card) => !names.has(normalizeDeckCardName(card.name)))
    .filter((card) => !excludedNames.has(normalizeDeckCardName(card.name)))
    .filter((card) => cardFitsDeckColors(card, colors))
    .filter((card) => !card.bracketMin || analysis.bracket >= card.bracketMin)
    .filter((card) => !card.bracketMax || analysis.bracket <= card.bracketMax)
    .map((card) => {
      let score = 0;
      if (missingRoles.includes(card.role)) score += 5;
      if (card.tags?.some((tag) => themes.has(tag))) score += 4;
      if (card.tags?.includes("any")) score += 1;
      if (relaxed) {
        if (["ramp", "draw", "interaction"].includes(card.role)) score += 2;
        if (!score) score = 1;
      }
      return { ...card, score };
    })
    .filter((card) => card.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return candidates.slice(0, limit);
}

function buildReviewParagraph(deck, analysis) {
  const commander = deck.commanderName || getCommanderEntry(deck)?.card.name || "your commander";
  const themeText = analysis.themes.length ? `I can see ${analysis.themes.slice(0, 3).join(", ")} signals` : "I do not see a strong mechanical theme yet";
  return `${deck.name || "This deck"} looks like a ${commander} build where ${themeText}. I would place it at ${commanderBracketNames[analysis.bracket]} right now. That rating is not just a power score: it is based on bracket pressure from Game Changers, tutors, fast mana, compact combo signals, and how polished the deck's engine appears.`;
}

function getReviewSuggestionReason(card, analysis) {
  return `${card.why} I chose it because your deck appears to want more ${card.role}, and it lines up with ${card.tags.filter((tag) => analysis.themes.includes(tag) || tag === "any").join(", ") || "your current color identity"}.`;
}

function dismissReviewSuggestion(item, card) {
  const name = normalizeDeckCardName(card.name);
  deckBuilder.reviewDismissedSuggestions.add(name);
  deckBuilder.reviewVisibleSuggestions = deckBuilder.reviewVisibleSuggestions.filter((visibleName) => visibleName !== name);
  item.classList.add("closing");
  item.addEventListener("animationend", () => item.remove(), { once: true });
}

function renderReviewSuggestions(list, recommendations, analysis) {
  list.innerHTML = "";
  deckBuilder.reviewVisibleSuggestions = recommendations.map((card) => normalizeDeckCardName(card.name));

  if (!recommendations.length) {
    const empty = document.createElement("p");
    empty.className = "review-suggestions-empty";
    empty.textContent = "No fresh recommendation is available from the local synergy set right now.";
    list.appendChild(empty);
    return;
  }

  recommendations.forEach((card) => {
    const item = document.createElement("article");
    item.className = "review-suggestion";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "review-suggestion-close";
    close.setAttribute("aria-label", `Dismiss ${card.name}`);
    close.textContent = "X";
    close.addEventListener("click", () => dismissReviewSuggestion(item, card));
    const title = document.createElement("strong");
    title.textContent = card.name;
    const reason = document.createElement("p");
    reason.textContent = getReviewSuggestionReason(card, analysis);
    const search = document.createElement("button");
    search.type = "button";
    search.textContent = "Review card";
    search.addEventListener("click", () => openDeckCardPreviewByName(card.name));
    item.append(close, title, reason, search);
    list.appendChild(item);
  });
}

function refreshDeckReviewSuggestions() {
  const deck = getActiveDeck();
  const analysis = analyzeDeckForBracket(deck);
  const excluded = new Set([
    ...deckBuilder.reviewDismissedSuggestions,
    ...deckBuilder.reviewVisibleSuggestions,
  ]);
  let recommendations = recommendCardsForDeck(deck, analysis, { excludedNames: excluded, limit: reviewSuggestionTargetCount });
  const list = deckEls.aiReview.querySelector(".review-suggestions");

  if (recommendations.length < reviewSuggestionTargetCount) {
    const alreadyPicked = new Set([...excluded, ...recommendations.map((card) => normalizeDeckCardName(card.name))]);
    recommendations = [
      ...recommendations,
      ...recommendCardsForDeck(deck, analysis, {
        excludedNames: alreadyPicked,
        limit: reviewSuggestionTargetCount - recommendations.length,
        relaxed: true,
      }),
    ];
  }

  if (!recommendations.length || recommendations.length < reviewSuggestionTargetCount) {
    const visibleNames = new Set(recommendations.map((card) => normalizeDeckCardName(card.name)));
    const fallbackExcluded = new Set([
      ...deckBuilder.reviewDismissedSuggestions,
      ...visibleNames,
    ]);
    recommendations = [
      ...recommendations,
      ...recommendCardsForDeck(deck, analysis, {
        excludedNames: fallbackExcluded,
        limit: reviewSuggestionTargetCount - recommendations.length,
        relaxed: true,
      }),
    ];
  }

  if (list) {
    renderReviewSuggestions(list, recommendations, analysis);
  }
}

function renderDeckReview(deck, analysis, recommendations) {
  deckEls.aiReview.hidden = false;
  deckEls.aiReview.innerHTML = "";
  deckEls.aiReview.dataset.tone = "review";

  const heading = document.createElement("div");
  heading.className = "review-bracket";
  const label = document.createElement("span");
  label.textContent = "Assigned bracket";
  const bracket = document.createElement("strong");
  const half = analysis.subRating === "U" ? " · Upper half" : analysis.subRating === "L" ? " · Lower half" : "";
  bracket.textContent = commanderBracketNames[analysis.bracket] + (analysis.bracketLabel ? ` (${analysis.bracketLabel})` : "") + half;
  heading.append(label, bracket);

  const summary = document.createElement("p");
  summary.textContent = buildReviewParagraph(deck, analysis);

  const details = document.createElement("p");
  details.textContent = `I counted about ${analysis.rampCount} ramp pieces, ${analysis.drawCount} draw/card-advantage pieces, and ${analysis.interactionCount} interaction pieces. ${analysis.reasons.join(" ")}`;

  const typeStats = document.createElement("div");
  typeStats.className = "review-type-stats";
  [
    ["Creatures", analysis.stats.creatures],
    ["Artifacts", analysis.stats.artifacts],
    ["Instants", analysis.stats.instants],
    ["Sorceries", analysis.stats.sorceries],
  ].forEach(([label, value]) => {
    const stat = document.createElement("span");
    stat.innerHTML = `<strong>${value}</strong>${label}`;
    typeStats.appendChild(stat);
  });

  deckEls.aiReview.append(heading, summary, typeStats);

  if (analysis.colorPct && analysis.colorPct.total > 0) {
    const colorLabels = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
    const colorStats = document.createElement("div");
    colorStats.className = "review-color-stats";
    ["W", "U", "B", "R", "G"].forEach((c) => {
      if (!analysis.colorPct.pct[c]) return;
      const span = document.createElement("span");
      span.className = "review-color review-color-" + c;
      span.innerHTML = `<strong>${analysis.colorPct.pct[c]}%</strong>${colorLabels[c]}`;
      colorStats.appendChild(span);
    });
    deckEls.aiReview.appendChild(colorStats);
  }

  deckEls.aiReview.appendChild(details);

  // Card Insights: dead-draw / mulligan risk, early-play density, simulated best opener.
  const insights = computeCardInsights(deck);
  if (insights) {
    const insTitle = document.createElement("h3");
    insTitle.textContent = "Card Insights";
    deckEls.aiReview.appendChild(insTitle);

    const grid = document.createElement("div");
    grid.className = "review-insight-stats";
    const pct = (x) => Math.round(x * 100) + "%";
    [
      ["Keepable opener", pct(insights.pKeep), "2–5 lands in hand"],
      ["Mana screw", pct(insights.pScrew), "0–1 lands (mulligan risk)"],
      ["Mana flood", pct(insights.pFlood), "6–7 lands"],
      ["Avg lands / 7", insights.avgLands.toFixed(1), "expected opening lands"],
      ["Early plays", insights.earlyPct + "%", "spells at 2 CMC or less"],
      ["Avg spell CMC", insights.avgCmc.toFixed(1), "nonland mana value"],
    ].forEach(([label, value, hint]) => {
      const cell = document.createElement("span");
      cell.innerHTML = `<strong>${value}</strong><em>${label}</em><small>${hint}</small>`;
      grid.appendChild(cell);
    });
    deckEls.aiReview.appendChild(grid);

    if (insights.bestOpener.length) {
      const opener = document.createElement("p");
      opener.className = "review-best-opener";
      const lead = document.createElement("strong");
      lead.textContent = "Best simulated opener: ";
      opener.appendChild(lead);
      insights.bestOpener.forEach((n, i) => {
        const span = document.createElement("span");
        span.textContent = n; // textContent avoids HTML injection from crafted/imported card names
        opener.appendChild(span);
        if (i < insights.bestOpener.length - 1) opener.appendChild(document.createTextNode(", "));
      });
      deckEls.aiReview.appendChild(opener);
    }
  }

  const suggestionTitle = document.createElement("h3");
  suggestionTitle.textContent = "Suggested upgrades";
  deckEls.aiReview.appendChild(suggestionTitle);
  const controls = document.createElement("div");
  controls.className = "review-suggestion-toolbar";
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.textContent = "Refresh suggestions";
  refresh.addEventListener("click", refreshDeckReviewSuggestions);
  controls.appendChild(refresh);
  deckEls.aiReview.appendChild(controls);

  const list = document.createElement("div");
  list.className = "review-suggestions";
  renderReviewSuggestions(list, recommendations, analysis);
  deckEls.aiReview.appendChild(list);
}

function buildDeckExport(deck) {
  return deck.cards
    .filter((entry) => entry.section !== "maybeboard")
    .map((entry) => `${entry.quantity} ${entry.card.name}`)
    .join("\n");
}

function importDeckToTable() {
  const deck = getActiveDeck();
  if (!deck.cards.length) {
    deckEls.aiReview.hidden = false;
    deckEls.aiReview.textContent = "Add cards before importing a deck to the table.";
    return;
  }

  window.dispatchEvent(new CustomEvent("mtg-deck-import-request", {
    detail: {
      id: deck.id,
      name: deck.name,
      format: deck.format,
      commanderName: deck.commanderName,
      commanderArtUrl: deck.commanderArtUrl || getDeckCardArtCrop(deck.cards.find((entry) => entry.section === "commander")?.card || deck.cards[0]?.card || {}),
      deckText: buildDeckExport(deck),
      cards: deck.cards.map((entry) => ({
        quantity: entry.quantity,
        board: entry.section === "commander" ? "commanders" : entry.section,
        name: entry.card.name,
        type_line: entry.card.type_line,
        oracle_text: entry.card.oracle_text,
        image_uris: entry.card.image_uris,
        color_identity: entry.card.color_identity,
        legalities: entry.card.legalities,
        scryfall_id: entry.card.id,
        raw: entry.card,
      })),
    },
  }));
  setDeckStatus("Choose a table player for this deck.", "info");
}

function getOpeningHandPool(deck) {
  return deck.cards
    .filter((entry) => entry.section === "mainboard")
    .flatMap((entry) => Array.from({ length: Math.max(1, Number(entry.quantity || 1)) }, () => entry));
}

function shuffleDeckEntries(entries) {
  const shuffled = [...entries];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function renderDrawHand(deck) {
  const pool = getOpeningHandPool(deck);
  const hand = shuffleDeckEntries(pool).slice(0, 7);
  deckEls.drawGrid.innerHTML = "";
  deckEls.drawTitle.textContent = `${deck.name || "Opening hand"} - ${hand.length} cards`;

  if (!hand.length) {
    deckEls.drawGrid.textContent = "Add mainboard cards before drawing a hand.";
    return;
  }

  hand.forEach((entry, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "draw-hand-card rolling-slot";
    card.style.setProperty("--slot-delay", `${index * 80}ms`);
    card.setAttribute("aria-label", `Open ${entry.card.name} details and synergy notes`);
    card.addEventListener("click", () => openDeckLibraryCard(deck.id, entry.id));
    const imageUrl = getDeckCardImage(entry.card);
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = entry.card.name;
      card.appendChild(image);
    }
    const name = document.createElement("strong");
    name.textContent = entry.card.name;
    card.appendChild(name);
    deckEls.drawGrid.appendChild(card);
  });

  window.setTimeout(() => {
    deckEls.drawGrid.querySelectorAll(".rolling-slot").forEach((card) => card.classList.remove("rolling-slot"));
  }, 1200);
}

function openDrawHandModal() {
  const deck = getActiveDeck();
  if (!getOpeningHandPool(deck).length) {
    setDeckStatus("Add mainboard cards before drawing a hand.", "warning");
    return;
  }

  deckBuilder.drawDeckId = deck.id;
  renderDrawHand(deck);
  deckEls.drawModal.showModal();
}

function drawAgain() {
  const deck = getDeckById(deckBuilder.drawDeckId) || getActiveDeck();
  renderDrawHand(deck);
}

function reviewDeckLocally() {
  const deck = getActiveDeck();
  if (!deck.cards.length) {
    setDeckStatus("Add or import a deck before asking for an AI bracket review.", "warning");
    return;
  }

  const analysis = analyzeDeckForBracket(deck);
  deckBuilder.reviewDismissedSuggestions = new Set();
  deckBuilder.reviewVisibleSuggestions = [];
  const recommendations = recommendCardsForDeck(deck, analysis, { limit: reviewSuggestionTargetCount });
  deck.bracket = analysis.bracket;
  saveDeckBuilder();
  syncDeckInputs(deck);
  renderDeckWarnings(deck);
  renderDeckReview(deck, analysis, recommendations);
}

function bindDeckBuilderEvents() {
  deckEls.form.addEventListener("submit", (event) => {
    event.preventDefault();
    searchCards();
  });
  deckEls.search.addEventListener("input", updateDeckAutocomplete);
  deckEls.search.addEventListener("focus", updateDeckAutocomplete);
  deckEls.search.addEventListener("blur", () => window.setTimeout(hideDeckSuggestions, 160));
  [deckEls.name, deckEls.deckFormat, deckEls.notes].forEach((input) => {
    input.addEventListener("input", updateDeckFromInputs);
  });
  deckEls.deckListSearch.addEventListener("input", () => {
    deckBuilder.deckListQuery = deckEls.deckListSearch.value;
    renderDeckList(getActiveDeck());
  });
  deckEls.newDeck.addEventListener("click", () => {
    const deck = createDeck();
    deckBuilder.decks.push(deck);
    deckBuilder.activeDeckId = deck.id;
    deckBuilder.deckListQuery = "";
    deckEls.deckListSearch.value = "";
    saveDeckBuilder();
    clearDeckStatus();
    renderDeckEditor();
  });
  deckEls.saveDeck.addEventListener("click", () => {
    updateDeckFromInputs();
    const defaultLabel = deckEls.saveDeck.dataset.defaultLabel || deckEls.saveDeck.textContent || "Save deck to library";
    deckEls.saveDeck.dataset.defaultLabel = defaultLabel;
    deckEls.saveDeck.textContent = "Saved";
    window.setTimeout(() => {
      deckEls.saveDeck.textContent = defaultLabel;
    }, 900);
  });
  deckEls.importToTable.addEventListener("click", importDeckToTable);
  deckEls.review.addEventListener("click", reviewDeckLocally);
  deckEls.drawHand.addEventListener("click", openDrawHandModal);
  deckEls.importMoxfield.addEventListener("click", importMoxfieldToDeckBuilder);
  deckEls.moxfieldInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    importMoxfieldToDeckBuilder();
  });
  deckEls.closeImageModal.addEventListener("click", () => deckEls.imageModal.close());
  deckEls.imageModal.addEventListener("click", (event) => {
    if (event.target === deckEls.imageModal) {
      deckEls.imageModal.close();
    }
  });
  deckEls.selectArt.addEventListener("click", selectDeckEntryArt);
  // Add the currently-previewed print to the deck straight from the card-preview modal.
  function addPreviewedCard(section) {
    const prints = deckBuilder.artPickerPrints || [];
    const card = prints[deckBuilder.artPickerSelectedIndex] || prints[0];
    if (!card) return;
    addCardToDeck(card, section);
    deckEls.imageModal.close();
  }
  if (deckEls.imageAdd) deckEls.imageAdd.addEventListener("click", () => addPreviewedCard());
  if (deckEls.imageCmdr) deckEls.imageCmdr.addEventListener("click", () => addPreviewedCard("commander"));
  deckEls.imageModal.addEventListener("close", () => {
    deckBuilder.artPickerRequestId += 1;
    deckBuilder.artPickerEntryId = "";
    deckBuilder.artPickerMode = "entry";
    deckBuilder.artPickerPrints = [];
    deckBuilder.artPickerSelectedIndex = 0;
    deckEls.artChoices.innerHTML = "";
    deckEls.imageStatus.textContent = "";
    deckEls.selectArt.hidden = false;
  });

  const closeLibrary = (event) => {
    event?.preventDefault?.();
    deckEls.libraryModal.close();
  };
  deckEls.closeLibraryModal.addEventListener("pointerdown", closeLibrary);
  deckEls.closeLibraryModal.addEventListener("click", closeLibrary);
  deckEls.libraryModal.addEventListener("click", (event) => {
    if (event.target === deckEls.libraryModal) {
      deckEls.libraryModal.close();
    }
  });
  deckEls.libraryBack.addEventListener("click", () => {
    deckBuilder.libraryView = "list";
    deckBuilder.libraryCardId = "";
    deckBuilder.librarySuggestedCard = null;
    deckBuilder.librarySuggestedNote = "";
    deckBuilder.librarySuggestedRole = "";
    renderDeckLibraryModal();
  });
  deckEls.librarySelect.addEventListener("click", selectDeckFromLibrary);

  deckEls.closeDrawModal.addEventListener("click", () => deckEls.drawModal.close());
  deckEls.closeDrawButton.addEventListener("click", () => deckEls.drawModal.close());
  deckEls.drawAgain.addEventListener("click", drawAgain);
  deckEls.drawModal.addEventListener("click", (event) => {
    if (event.target === deckEls.drawModal) {
      deckEls.drawModal.close();
    }
  });

  window.addEventListener("mtg-table-deck-import", (event) => {
    importTableDeckToBuilder(event.detail || {});
  });
}

if (deckBuilderReady) {
  seedGameChangerNames();
  loadDeckBuilder();
  bindDeckBuilderEvents();
  renderDeckEditor();
  refreshGameChangerList();
}
