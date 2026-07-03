const colors = ["#c94f4f", "#4f8cc9", "#5aa66a", "#d5ae5d", "#9867c5", "#d5794f"];

const counterTypes = [
  { key: "poison", label: "Poison", matches: ["poison", "toxic", "corrupted"] },
  { key: "infect", label: "Infect", matches: ["infect"] },
  { key: "energy", label: "Energy", matches: ["energy"] },
  { key: "mana_w", label: "White mana", mana: true },
  { key: "mana_u", label: "Blue mana", mana: true },
  { key: "mana_b", label: "Black mana", mana: true },
  { key: "mana_r", label: "Red mana", mana: true },
  { key: "mana_g", label: "Green mana", mana: true },
  { key: "mana_c", label: "Colorless mana", mana: true },
  { key: "experience", label: "XP", matches: ["experience counter"] },
  { key: "storm", label: "Storm", matches: ["storm", "magecraft", "copy target instant", "copy target sorcery"] },
  { key: "treasure", label: "Treasure", matches: ["treasure token"] },
  { key: "clue", label: "Clue", matches: ["clue token", "investigate"] },
  { key: "food", label: "Food", matches: ["food token"] },
  { key: "blood", label: "Blood", matches: ["blood token"] },
  { key: "map", label: "Map", matches: ["map token"] },
  { key: "rad", label: "Rad", matches: ["rad counter"] },
  { key: "shield", label: "Shield", matches: ["shield counter"] },
  { key: "oil", label: "Oil", matches: ["oil counter"] },
  { key: "charge", label: "Charge", matches: ["charge counter"] },
  { key: "loyalty", label: "Loyalty", matches: ["planeswalker", "loyalty counter"] },
  { key: "monarch", label: "Monarch", matches: ["become the monarch", "you are the monarch"] },
  { key: "initiative", label: "Initiative", matches: ["take the initiative", "you have the initiative"] },
  { key: "tax", label: "Cmdr tax", always: true },
];

const counterHistoryStyles = {
  poison: { icon: "PSN", color: "#c08cff", rgb: "192, 140, 255" },
  infect: { icon: "INF", color: "#b46cff", rgb: "180, 108, 255" },
  energy: { icon: "NRG", color: "#55d7ff", rgb: "85, 215, 255" },
  mana_w: { icon: "W", color: "#f7f3da", rgb: "247, 243, 218" },
  mana_u: { icon: "U", color: "#5aa9e6", rgb: "90, 169, 230" },
  mana_b: { icon: "B", color: "#a193b8", rgb: "161, 147, 184" },
  mana_r: { icon: "R", color: "#e0604f", rgb: "224, 96, 79" },
  mana_g: { icon: "G", color: "#5aa66a", rgb: "90, 166, 106" },
  mana_c: { icon: "C", color: "#c7ccd6", rgb: "199, 204, 214" },
  commander: { icon: "CMD", color: "#f3c969", rgb: "243, 201, 105" },
  experience: { icon: "XP", color: "#ffb7e8", rgb: "255, 183, 232" },
  storm: { icon: "STM", color: "#8aa7ff", rgb: "138, 167, 255" },
  treasure: { icon: "TRS", color: "#f2b84b", rgb: "242, 184, 75" },
  clue: { icon: "CLU", color: "#7bdcff", rgb: "123, 220, 255" },
  food: { icon: "FOD", color: "#d8c189", rgb: "216, 193, 137" },
  blood: { icon: "BLD", color: "#c77dff", rgb: "199, 125, 255" },
  map: { icon: "MAP", color: "#e0d6a7", rgb: "224, 214, 167" },
  rad: { icon: "RAD", color: "#75f0ff", rgb: "117, 240, 255" },
  shield: { icon: "SHD", color: "#c6dbff", rgb: "198, 219, 255" },
  oil: { icon: "OIL", color: "#9d93ff", rgb: "157, 147, 255" },
  charge: { icon: "CHG", color: "#ffd166", rgb: "255, 209, 102" },
  loyalty: { icon: "LOY", color: "#e8ecff", rgb: "232, 236, 255" },
  monarch: { icon: "MON", color: "#ffe08a", rgb: "255, 224, 138" },
  initiative: { icon: "INI", color: "#ffb86b", rgb: "255, 184, 107" },
  tax: { icon: "TAX", color: "#9cc9ff", rgb: "156, 201, 255" },
};

const state = {
  players: [],
  playerCount: 4,
  startingLife: 40,
  layout: "auto",
  totalTurns: 0,
  turnCycle: 0,
  turnTrackingEnabled: true,
  rolling: false,
  randomRolling: false,
  commanderDamageTaken: {},
  undoStack: [],
  activeCommanderDamagePlayerId: "",
  history: [],
  historySequence: 0,
};

const board = document.querySelector("#board");
const template = document.querySelector("#playerTemplate");
const startLifeInput = document.querySelector("#startLife");
const tableMessage = document.querySelector("#tableMessage");
const rollDisplay = document.querySelector("#rollDisplay");
const rollResult = document.querySelector("#rollResult");
const randomDisplay = document.querySelector("#randomDisplay");
const randomResult = document.querySelector("#randomResult");
const cardModal = document.querySelector("#cardModal");
const modalTitle = document.querySelector("#modalTitle");
const modalGrid = document.querySelector("#modalGrid");
const cardPreview = document.querySelector("#cardPreview");
const closeModalButton = document.querySelector("#closeModal");
const globalSuggestions = document.querySelector("#globalSuggestions");
const turnTrackerPanel = document.querySelector("#turnTrackerPanel");
const turnTrackingEnabledInput = document.querySelector("#turnTrackingEnabled");
const turnTrackerText = document.querySelector("#turnTrackerText");
const turnDownButton = document.querySelector("#turnDown");
const turnUpButton = document.querySelector("#turnUp");
const undoButton = document.querySelector("#undoButton");
const rulesSearchForm = document.querySelector("#rulesSearch");
const rulesQueryInput = document.querySelector("#rulesQuery");
const rulesSuggestions = document.querySelector("#rulesSuggestions");
const pageTabs = document.querySelectorAll("[data-page-target]");
const pagePanels = document.querySelectorAll(".page-panel[data-page]");
const historyButton = document.querySelector("#historyButton");
const historyCount = document.querySelector("#historyCount");
const historyModal = document.querySelector("#historyModal");
const historyList = document.querySelector("#historyList");
const historySummary = document.querySelector("#historySummary");
const closeHistoryModal = document.querySelector("#closeHistoryModal");
const copyHistoryButton = document.querySelector("#copyHistoryButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");

const suggestionTimers = new WeakMap();
const defaultCounterKeys = ["tax"];
const lifeTrackerTimers = new WeakMap();
const historyMergeWindowMs = 2000;
let activeLifeHold = null;
let activeCommanderDamageHold = null;
let rulesIndex = [];
let rulesLoadPromise = null;
let selectedRuleSuggestion = null;
const officialRulesTextUrl = "https://media.wizards.com/2026/downloads/MagicCompRules%2020260417.txt";
const artColorCache = new Map();
const savedDeckStorageKey = "magic-table-tracker-decks-v1";
let nextPlayerId = 1;

function readSavedDeckBuilderState() {
  try {
    return JSON.parse(localStorage.getItem(savedDeckStorageKey) || "{}");
  } catch {
    return {};
  }
}

function getSavedDecks() {
  const saved = readSavedDeckBuilderState();
  return Array.isArray(saved.decks) ? saved.decks.filter((deck) => Array.isArray(deck.cards) && deck.cards.length) : [];
}

function getSavedDeckEntryCard(entry = {}) {
  const card = entry.card || entry.card_snapshot || entry.cardSnapshot || {};
  if (card.name) {
    return card;
  }

  return {
    ...card,
    id: entry.scryfallId || entry.scryfall_id || card.id || "",
    name: entry.cardName || entry.name || "Unknown card",
    type_line: entry.typeLine || entry.type_line || "",
    oracle_text: entry.oracleText || entry.oracle_text || "",
    image_uris: entry.imageUris || entry.image_uris || {},
    card_faces: entry.cardFaces || entry.card_faces,
    color_identity: entry.colorIdentity || entry.color_identity || [],
    legalities: entry.legalities || {},
  };
}

function getSavedDeckCommanderEntry(deck) {
  return deck.cards.find((entry) => entry.section === "commander") || deck.cards[0] || null;
}

function normalizeSearchText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getSavedDeckSearchTerms(deck) {
  const commander = getSavedDeckCommanderEntry(deck);
  const commanderCard = getSavedDeckEntryCard(commander);
  return [
    deck.name,
    deck.commanderName,
    commanderCard.name,
  ].filter(Boolean);
}

function getSavedDeckTotalCards(deck) {
  return deck.cards.reduce((sum, entry) => sum + Math.max(1, Number(entry.quantity || 1)), 0);
}

function getSavedDeckSubtitle(deck) {
  const commander = getSavedDeckCommanderEntry(deck);
  const commanderName = deck.commanderName || getSavedDeckEntryCard(commander).name || "No commander set";
  return `${commanderName} | ${getSavedDeckTotalCards(deck)} cards`;
}

function getSavedDeckMatchScore(deck, normalizedQuery) {
  const terms = getSavedDeckSearchTerms(deck).map(normalizeSearchText);
  if (terms.some((term) => term === normalizedQuery)) return 0;
  if (terms.some((term) => term.startsWith(normalizedQuery))) return 1;
  if (terms.some((term) => term.includes(normalizedQuery))) return 2;
  return -1;
}

function findSavedDeckMatches(query, limit = 5) {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 2) {
    return [];
  }

  return getSavedDecks()
    .map((deck) => ({ deck, score: getSavedDeckMatchScore(deck, normalizedQuery) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => a.score - b.score || String(a.deck.name || "").localeCompare(String(b.deck.name || "")))
    .slice(0, limit)
    .map(({ deck }) => deck);
}

function findExactSavedDeck(query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return null;
  }

  return getSavedDecks().find((deck) => {
    return getSavedDeckSearchTerms(deck).some((term) => normalizeSearchText(term) === normalizedQuery);
  }) || null;
}

function deckSectionToPlayerBoard(section) {
  if (section === "commander") return "commanders";
  if (section === "sideboard") return "sideboard";
  if (section === "maybeboard") return "maybeboard";
  return "mainboard";
}

function savedDeckEntryToPlayerCard(entry) {
  const card = getSavedDeckEntryCard(entry);
  return {
    quantity: Math.max(1, Number(entry.quantity || 1)),
    board: deckSectionToPlayerBoard(entry.section),
    name: card.name || "Unknown card",
    type_line: card.type_line || "",
    oracle_text: card.oracle_text || "",
    image_uris: card.image_uris || {},
    card_faces: card.card_faces || card.cardFaces,
    color_identity: card.color_identity || [],
    legalities: card.legalities || {},
    id: card.id || "",
    raw: card,
  };
}

function populateSavedDeckSelect(select) {
  const savedDecks = getSavedDecks();
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = savedDecks.length ? "Saved decks" : "No saved decks";
  select.appendChild(placeholder);

  savedDecks.forEach((deck) => {
    const commander = getSavedDeckCommanderEntry(deck);
    const commanderCard = getSavedDeckEntryCard(commander);
    const option = document.createElement("option");
    option.value = deck.id;
    option.textContent = `${deck.name || "Untitled deck"}${commanderCard.name ? ` - ${commanderCard.name}` : ""}`;
    select.appendChild(option);
  });

  select.disabled = savedDecks.length === 0;
}

function refreshSavedDeckSelects() {
  document.querySelectorAll(".saved-deck-select").forEach((select) => {
    populateSavedDeckSelect(select);
  });
}

function playerHasCommanderOrDeckContext(player) {
  return Boolean(
    player.backgroundUrl ||
    player.commanderQuery?.trim() ||
    player.deckInput?.trim() ||
    player.deckCards?.length,
  );
}

function setPlayerActionDisabled(button, disabled, reason) {
  button.disabled = disabled;
  button.classList.toggle("is-disabled", disabled);
  button.setAttribute("aria-disabled", String(disabled));
  if (disabled) {
    button.title = reason;
  } else {
    button.removeAttribute("title");
  }
}

function loadSavedDeckForPlayer(player, deckId) {
  const deck = getSavedDecks().find((savedDeck) => savedDeck.id === deckId);
  if (!deck) return;

  const commanderEntry = getSavedDeckCommanderEntry(deck);
  const commanderCard = getSavedDeckEntryCard(commanderEntry);
  const playerCards = deck.cards.map(savedDeckEntryToPlayerCard);
  const commanderName = deck.commanderName || commanderCard.name || deck.name || player.name;
  const commanderArt = deck.commanderArtUrl || getCommanderBackgroundImage(commanderCard);

  player.deckCards = playerCards;
  player.deckInput = buildPlayerDeckExport(playerCards);
  player.visibleCounterKeys = detectSmartCounters(playerCards);
  player.showDeckEditor = false;

  if (commanderArt) {
    setCommanderForPlayer(player, commanderName, commanderArt, { keepDeckInput: true, card: commanderCard });
  } else {
    player.name = commanderName;
    player.commanderQuery = commanderName;
  }

  tableMessage.value = `${deck.name || "Saved deck"} loaded for ${player.name}.`;
  render();
}

function loadExactSavedDeckForPlayer(player, query) {
  const deck = findExactSavedDeck(query);
  if (!deck) {
    return false;
  }

  hideSuggestions();
  loadSavedDeckForPlayer(player, deck.id);
  return true;
}

function createCounters() {
  return Object.fromEntries(counterTypes.map((counter) => [counter.key, 0]));
}

function createLifeTrackers() {
  return {
    gain: { amount: 0, visible: false, flash: false, flashId: 0, renderedFlashId: 0 },
    loss: { amount: 0, visible: false, flash: false, flashId: 0, renderedFlashId: 0 },
  };
}

function createPlayer(index) {
  return {
    id: `player-${nextPlayerId++}`,
    name: `Player ${index + 1}`,
    life: state.startingLife,
    counters: createCounters(),
    visibleCounterKeys: [...defaultCounterKeys],
    colorIndex: index % colors.length,
    commanderQuery: "",
    backgroundUrl: "",
    artColor: "",
    deckInput: "",
    showCommanderEditor: true,
    showDeckEditor: true,
    deckCards: [],
    lifeFlash: "",
    lifeFlashId: 0,
    renderedLifeFlashId: 0,
    lifeTrackers: createLifeTrackers(),
    spawnFlash: false,
    counterPickerOpen: false,
    isDead: false,
    deathEntering: false,
    deathReason: "",
    commanderDamageDeathRestoreLife: null,
    infectDeathRestoreLife: null,
  };
}

function ensurePlayerIds() {
  state.players.forEach((player) => {
    if (!player.id) {
      player.id = `player-${nextPlayerId++}`;
    }
  });
}

function clonePlayers(players = state.players) {
  return JSON.parse(JSON.stringify(players));
}

function cloneCommanderDamageTaken() {
  return JSON.parse(JSON.stringify(state.commanderDamageTaken || {}));
}

function pushUndoSnapshot(label = "board action") {
  ensurePlayerIds();
  state.undoStack.unshift({
    label,
    players: clonePlayers(),
    commanderDamageTaken: cloneCommanderDamageTaken(),
    totalTurns: state.totalTurns,
    turnCycle: state.turnCycle,
    turnTrackingEnabled: state.turnTrackingEnabled,
    history: JSON.parse(JSON.stringify(state.history || [])),
    historySequence: state.historySequence,
  });
  state.undoStack = state.undoStack.slice(0, 40);
  updateUndoButton();
}

function syncNextPlayerIdFromState() {
  const highest = state.players.reduce((max, player) => {
    const match = String(player.id || "").match(/^player-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  nextPlayerId = Math.max(nextPlayerId, highest + 1);
}

function updateUndoButton() {
  if (!undoButton) return;
  undoButton.disabled = state.undoStack.length === 0;
  undoButton.title = state.undoStack.length ? `Undo ${state.undoStack[0].label}` : "No board actions to undo";
}

function undoLastBoardAction() {
  const snapshot = state.undoStack.shift();
  if (!snapshot) {
    tableMessage.value = "No board actions to undo.";
    updateUndoButton();
    return;
  }

  state.players = clonePlayers(snapshot.players);
  state.commanderDamageTaken = JSON.parse(JSON.stringify(snapshot.commanderDamageTaken || {}));
  state.totalTurns = snapshot.totalTurns;
  state.turnCycle = snapshot.turnCycle;
  state.turnTrackingEnabled = snapshot.turnTrackingEnabled;
  state.history = JSON.parse(JSON.stringify(snapshot.history || []));
  state.historySequence = snapshot.historySequence || 0;
  syncNextPlayerIdFromState();
  updateUndoButton();
  updateHistoryCount();
  tableMessage.value = `Undid ${snapshot.label}.`;
  logHistoryEntry({
    type: "undo",
    title: "Board action undone",
    detail: snapshot.label,
  });
  render();
  if (cardModal.open && state.activeCommanderDamagePlayerId) {
    const defender = state.players.find((player) => player.id === state.activeCommanderDamagePlayerId);
    if (defender) {
      renderCommanderDamagePanel(defender);
    }
  }
}

function setPlayerCount(count) {
  state.playerCount = count;

  while (state.players.length < count) {
    state.players.push(createPlayer(state.players.length));
  }

  state.players = state.players.slice(0, count);
  ensurePlayerIds();
  pruneCommanderDamageState();
  updatePlayerButtons();
  updateTurnCycle();
  render();
}

function updatePlayerButtons() {
  document.querySelectorAll("[data-players]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.players) === state.playerCount);
  });
}

function updateModeButtons() {
  document.querySelectorAll("[data-mode-life]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.modeLife) === state.startingLife);
  });
}

function updateLayoutButtons() {
  document.querySelectorAll("[data-layout]").forEach((button) => {
    button.classList.toggle("active", button.dataset.layout === state.layout);
  });
}

function updateBoardLayout() {
  board.dataset.layout = state.layout;
}

function updateTurnTrackerUi() {
  state.turnCycle = Math.floor(state.totalTurns / Math.max(1, state.playerCount));
  const nextPlayerIndex = state.playerCount ? state.totalTurns % state.playerCount : 0;
  const nextPlayer = state.players[nextPlayerIndex];
  const nextPlayerName = nextPlayer?.name || `Player ${nextPlayerIndex + 1}`;
  const text = `Total turns: ${state.totalTurns} | Turn cycles: ${state.turnCycle} | Next player: ${nextPlayerName}`;
  if (turnTrackerText) {
    turnTrackerText.value = text;
    turnTrackerText.textContent = text;
  }
  if (turnTrackingEnabledInput) {
    turnTrackingEnabledInput.checked = state.turnTrackingEnabled;
  }
  turnTrackerPanel?.classList.toggle("tracking-disabled", !state.turnTrackingEnabled);
  if (turnDownButton) {
    turnDownButton.disabled = !state.turnTrackingEnabled;
  }
  if (turnUpButton) {
    turnUpButton.disabled = !state.turnTrackingEnabled;
  }
}

function updateTurnCycle(amount = 0) {
  if (amount && !state.turnTrackingEnabled) {
    tableMessage.value = "Turn tracking is disabled.";
    updateTurnTrackerUi();
    return;
  }

  const previousTurns = state.totalTurns;
  const nextTurns = Math.max(0, state.totalTurns + amount);
  if (amount && nextTurns !== previousTurns) {
    pushUndoSnapshot(amount > 0 ? "pass turn" : "previous turn");
  }
  state.totalTurns = nextTurns;
  updateTurnTrackerUi();

  if (amount && state.totalTurns !== previousTurns) {
    tableMessage.value = amount > 0
      ? "Turn passed."
      : "Turn reverted.";
    logHistoryEntry({
      type: "turn",
      delta: amount,
      previousValue: previousTurns,
      nextValue: state.totalTurns,
    });
  }
}

function updateHistoryCount() {
  if (!historyCount) return;
  historyCount.textContent = state.history.length;
  historyButton?.classList.toggle("has-history", state.history.length > 0);
}

function getPlayerSeat(player) {
  const index = state.players.indexOf(player);
  return index >= 0 ? index + 1 : 0;
}

function canMergeHistoryEntries(existing, next, nowMs) {
  if (!existing || !["life", "counter"].includes(next.type)) {
    return false;
  }

  const existingTime = Date.parse(existing.at);
  if (!Number.isFinite(existingTime) || nowMs - existingTime > historyMergeWindowMs) {
    return false;
  }

  if (existing.type !== next.type || existing.playerName !== next.playerName || existing.seat !== next.seat) {
    return false;
  }

  if (
    existing.turn !== state.totalTurns ||
    existing.cycle !== state.turnCycle ||
    existing.turnTrackingEnabled !== state.turnTrackingEnabled
  ) {
    return false;
  }

  if (Math.sign(existing.delta) !== Math.sign(next.delta)) {
    return false;
  }

  return next.type === "life" || existing.counter === next.counter;
}

function mergeHistoryEntry(existing, next, nowIso) {
  existing.at = nowIso;
  existing.turn = state.totalTurns;
  existing.cycle = state.turnCycle;
  existing.turnTrackingEnabled = state.turnTrackingEnabled;
  existing.delta += next.delta;
  existing.input = Number(existing.input || 0) + Number(next.input || next.delta || 0);
  existing.nextValue = next.nextValue;

  if (existing.type === "counter") {
    existing.nextLife = next.nextLife;
    existing.lifeDelta = Number(existing.lifeDelta || 0) + Number(next.lifeDelta || 0);
  }
}

function logHistoryEntry(entry) {
  const now = new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const latest = state.history[0];
  if (canMergeHistoryEntries(latest, entry, nowMs)) {
    mergeHistoryEntry(latest, entry, nowIso);
    updateHistoryCount();
    if (historyModal?.open) {
      renderHistory();
    }
    return;
  }

  state.historySequence += 1;
  state.history.unshift({
    id: state.historySequence,
    at: nowIso,
    turn: state.totalTurns,
    cycle: state.turnCycle,
    turnTrackingEnabled: state.turnTrackingEnabled,
    ...entry,
  });
  state.history = state.history.slice(0, 300);
  updateHistoryCount();
  if (historyModal?.open) {
    renderHistory();
  }
}

function getHistoryTone(entry) {
  if (entry.type === "life") {
    return entry.delta > 0 ? "gain" : "loss";
  }
  if (entry.type === "counter") {
    return "token-entry";
  }
  if (entry.type === "commanderDamage") {
    return entry.delta > 0 ? "loss" : "gain";
  }
  if (entry.type === "death") {
    return "death";
  }
  if (entry.type === "reset") {
    return "reset";
  }
  if (entry.type === "roll" || entry.type === "random" || entry.type === "turn" || entry.type === "undo") {
    return "action";
  }
  return "neutral";
}

function getHistoryTitle(entry) {
  if (entry.type === "life") {
    return `${entry.playerName} ${entry.delta > 0 ? "gained" : "lost"} ${Math.abs(entry.delta)} life`;
  }
  if (entry.type === "counter") {
    return `${entry.playerName} ${entry.delta > 0 ? "added" : "removed"} ${Math.abs(entry.delta)} ${entry.label}`;
  }
  if (entry.type === "commanderDamage") {
    return `${entry.playerName} ${entry.delta > 0 ? "took" : "removed"} ${Math.abs(entry.delta)} commander damage`;
  }
  if (entry.type === "death") {
    return `${entry.playerName} has died`;
  }
  if (entry.type === "reset") {
    return entry.title || "New game started";
  }
  if (entry.type === "roll") {
    return entry.kind === "coin" ? `Coin flip: ${entry.result}` : `D${entry.sides} rolled ${entry.result}`;
  }
  if (entry.type === "random") {
    return `Random player: ${entry.playerName}`;
  }
  if (entry.type === "turn") {
    return `Turn cycle ${entry.previousValue} -> ${entry.nextValue}`;
  }
  if (entry.type === "undo") {
    return entry.title || "Board action undone";
  }
  return entry.title || "Game event";
}

function getCounterHistoryStyle(counter) {
  return counterHistoryStyles[counter] || { icon: "CTR", color: "#c9eeff", rgb: "201, 238, 255" };
}

function getHistoryMarkerText(entry) {
  if (entry.type === "life") {
    return "HP";
  }
  if (entry.type === "counter") {
    return getCounterHistoryStyle(entry.counter).icon;
  }
  if (entry.type === "commanderDamage") {
    return "CMD";
  }
  if (entry.type === "death") {
    return "DEATH";
  }
  if (entry.type === "roll") {
    return "DIE";
  }
  if (entry.type === "random") {
    return "RND";
  }
  if (entry.type === "turn") {
    return "TRN";
  }
  if (entry.type === "undo") {
    return "UNDO";
  }
  return "RST";
}

function getHistoryDetail(entry) {
  if (entry.type === "life") {
    return `Life ${entry.previousValue} -> ${entry.nextValue}`;
  }
  if (entry.type === "counter") {
    const parts = [`${entry.label} ${entry.previousValue} -> ${entry.nextValue}`];
    if (entry.lifeDelta) {
      parts.push(`Life ${entry.previousLife} -> ${entry.nextLife}`);
    }
    return parts.join(" | ");
  }
  if (entry.type === "commanderDamage") {
    const parts = [`${entry.commanderName} (${entry.commanderOwner}) ${entry.previousValue} -> ${entry.nextValue}`];
    if (Number.isFinite(entry.previousLife) && Number.isFinite(entry.nextLife)) {
      parts.push(`Life ${entry.previousLife} -> ${entry.nextLife}`);
    }
    return parts.join(" | ");
  }
  if (entry.type === "death") {
    const parts = [];
    if (Number.isFinite(entry.previousLife) && Number.isFinite(entry.nextLife)) {
      parts.push(`Life ${entry.previousLife} -> ${entry.nextLife}`);
    }
    if (entry.reason) {
      parts.push(entry.reason);
    }
    return parts.join(" | ");
  }
  if (entry.type === "reset") {
    return `${entry.playerCount || state.playerCount} players | ${entry.startingLife || state.startingLife} starting life`;
  }
  if (entry.type === "roll") {
    return entry.kind === "coin" ? "Coin toss resolved." : `${entry.sides}-sided die result.`;
  }
  if (entry.type === "random") {
    return `Selected from ${entry.poolSize} eligible ${entry.poolSize === 1 ? "player" : "players"}.`;
  }
  if (entry.type === "turn") {
    return `Turn cycle changed by ${entry.delta > 0 ? "+" : ""}${entry.delta}.`;
  }
  if (entry.type === "undo") {
    return entry.detail || "Restored the previous board state.";
  }
  return entry.detail || "";
}

function getHistoryTimestamp(entry) {
  return new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function shouldShowHistoryTurn(entry) {
  return entry.turnTrackingEnabled ?? state.turnTrackingEnabled;
}

function getHistoryMetaText(entry) {
  const parts = [getHistoryTimestamp(entry)];
  if (shouldShowHistoryTurn(entry) && Number.isFinite(entry.turn)) {
    parts.push(`Turn ${entry.turn}`);
    if (Number.isFinite(entry.cycle)) {
      parts.push(`Cycle ${entry.cycle}`);
    }
  }
  return parts.join(" | ");
}

function getHistoryPlayerArt(entry) {
  const seatPlayer = entry.seat ? state.players[entry.seat - 1] : null;
  if (seatPlayer?.backgroundUrl) {
    return seatPlayer.backgroundUrl;
  }

  const namedPlayer = entry.playerName
    ? state.players.find((player) => player.name === entry.playerName)
    : null;
  return namedPlayer?.backgroundUrl || "";
}

function renderHistory() {
  if (!historyList || !historySummary) return;
  historyList.innerHTML = "";
  historySummary.textContent = `${state.history.length} ${state.history.length === 1 ? "input" : "inputs"} recorded this game.`;

  if (!state.history.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Life changes and counter adjustments will appear here as the game unfolds.";
    historyList.appendChild(empty);
    return;
  }

  state.history.forEach((entry) => {
    const item = document.createElement("article");
    item.className = `history-entry ${getHistoryTone(entry)}`;
    const playerArt = getHistoryPlayerArt(entry);
    if (playerArt) {
      item.classList.add("has-history-art");
      const artLayer = document.createElement("span");
      artLayer.className = "history-entry-art";
      artLayer.setAttribute("aria-hidden", "true");
      artLayer.style.backgroundImage = `url("${String(playerArt || "").replace(/["'()\\]/g, "")}")`;
      item.appendChild(artLayer);
    }
    const marker = document.createElement("span");
    marker.className = "history-marker";
    marker.textContent = getHistoryMarkerText(entry);
    if (entry.type === "counter" || entry.type === "commanderDamage") {
      const markerStyle = entry.type === "commanderDamage"
        ? getCounterHistoryStyle("commander")
        : getCounterHistoryStyle(entry.counter);
      item.style.setProperty("--history-token-color", markerStyle.color);
      item.style.setProperty("--history-token-rgb", markerStyle.rgb);
      marker.style.setProperty("--history-token-color", markerStyle.color);
      marker.style.setProperty("--history-token-rgb", markerStyle.rgb);
    }
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = getHistoryTitle(entry);
    const detail = document.createElement("span");
    detail.textContent = getHistoryDetail(entry);
    copy.append(title, detail);
    const meta = document.createElement("small");
    meta.textContent = getHistoryMetaText(entry);
    item.append(marker, copy, meta);
    historyList.appendChild(item);
  });
}

function getHistoryText() {
  if (!state.history.length) {
    return "No life or counter changes recorded.";
  }

  return [...state.history].reverse().map((entry) => {
    const meta = getHistoryMetaText(entry);
    return `[${meta}] ${getHistoryTitle(entry)} - ${getHistoryDetail(entry)}`;
  }).join("\n");
}

async function copyHistoryLog() {
  const text = getHistoryText();
  try {
    await navigator.clipboard.writeText(text);
    tableMessage.value = "Table log copied to clipboard.";
  } catch {
    tableMessage.value = text;
  }
}

const VALID_PAGES = ["home", "life", "deck", "ranked", "profile", "tournaments", "watch"];
function setActivePage(page, updateHash = true) {
  const targetPage = VALID_PAGES.includes(page) ? page : "home";

  pageTabs.forEach((button) => {
    const active = button.dataset.pageTarget === targetPage;
    button.classList.toggle("active", active);
    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  pagePanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.page === targetPage);
  });

  hideSuggestions();
  hideRulesSuggestions();
  closeCounterMenusOutside(document.body);

  if (targetPage === "life") {
    refreshSavedDeckSelects();
    window.requestAnimationFrame(() => {
      fitPlayerCardsToContent();
      positionOpenCounterMenus();
    });
  }

  // Let the landing hero (home.js) pause/resume its 3D scene when off/on screen.
  document.body.classList.toggle("on-home", targetPage === "home");
  window.dispatchEvent(new CustomEvent("mtg-page-changed", { detail: { page: targetPage } }));

  if (updateHash && window.history?.replaceState) {
    window.history.replaceState(null, "", `#${targetPage}`);
  }
}

function resetGame() {
  state.players = Array.from({ length: state.playerCount }, (_, index) => createPlayer(index));
  state.commanderDamageTaken = {};
  state.undoStack = [];
  state.activeCommanderDamagePlayerId = "";
  state.totalTurns = 0;
  state.turnCycle = 0;
  state.history = [];
  state.historySequence = 0;
  updateTurnCycle();
  startLifeInput.value = state.startingLife;
  updateModeButtons();
  updateUndoButton();
  tableMessage.value = `Reset to ${state.startingLife} life.`;
  logHistoryEntry({
    type: "reset",
    title: "New game started",
    playerCount: state.playerCount,
    startingLife: state.startingLife,
  });
  render();
}

function triggerPlayerSpawn(player) {
  player.spawnFlash = true;
  window.setTimeout(() => {
    player.spawnFlash = false;
    render();
  }, 1100);
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function enhanceBorderColor(red, green, blue) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const brightness = (red + green + blue) / 3;

  if (brightness < 58) {
    const boost = 58 - brightness;
    red = Math.min(255, red + boost);
    green = Math.min(255, green + boost);
    blue = Math.min(255, blue + boost);
  }

  if (saturation < 0.18) {
    blue = Math.min(255, blue + 36);
    green = Math.min(255, green + 18);
  }

  return rgbToHex(Math.round(red), Math.round(green), Math.round(blue));
}

function sampleCommanderArtColor(imageUrl) {
  if (!imageUrl) {
    return Promise.resolve("");
  }

  if (artColorCache.has(imageUrl)) {
    return Promise.resolve(artColorCache.get(imageUrl));
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";

    const finish = (color = "") => {
      if (color) {
        artColorCache.set(imageUrl, color);
      }
      resolve(color);
    };

    const timeout = window.setTimeout(() => finish(""), 4500);

    image.addEventListener("load", () => {
      try {
        window.clearTimeout(timeout);
        const canvas = document.createElement("canvas");
        const size = 48;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, size, size);
        const pixels = context.getImageData(0, 0, size, size).data;
        const buckets = new Map();

        for (let index = 0; index < pixels.length; index += 4) {
          const alpha = pixels[index + 3];
          if (alpha < 180) continue;

          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const brightness = (red + green + blue) / 3;
          const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
          if (brightness < 24 || brightness > 238 || spread < 10) continue;

          const r = Math.round(red / 24) * 24;
          const g = Math.round(green / 24) * 24;
          const b = Math.round(blue / 24) * 24;
          const key = `${r},${g},${b}`;
          const existing = buckets.get(key) || { count: 0, red: 0, green: 0, blue: 0, score: 0 };
          const saturationWeight = 1 + spread / 128;
          existing.count += 1;
          existing.red += red;
          existing.green += green;
          existing.blue += blue;
          existing.score += saturationWeight;
          buckets.set(key, existing);
        }

        const dominant = [...buckets.values()].sort((a, b) => b.score - a.score)[0];
        if (!dominant) {
          finish("");
          return;
        }

        finish(enhanceBorderColor(dominant.red / dominant.count, dominant.green / dominant.count, dominant.blue / dominant.count));
      } catch (error) {
        finish("");
      }
    });

    image.addEventListener("error", () => {
      window.clearTimeout(timeout);
      finish("");
    });

    image.src = imageUrl;
  });
}

function updateCommanderArtColor(player, imageUrl) {
  player.artColor = "";
  sampleCommanderArtColor(imageUrl).then((color) => {
    if (!color || player.backgroundUrl !== imageUrl) {
      return;
    }

    player.artColor = color;
    render();
  });
}

function setCommanderForPlayer(player, name, imageUrl, options = {}) {
  ensurePlayerIds();
  player.name = name;
  player.commanderQuery = name;
  if (!options.keepDeckInput) {
    player.deckInput = name;
  }
  const backgroundImage = getCommanderBackgroundImage(options.card || imageUrl);
  player.backgroundUrl = backgroundImage;
  updateCommanderArtColor(player, backgroundImage);
  player.showCommanderEditor = false;
  triggerPlayerSpawn(player);
}

function normalizeCommanderKey(value = "") {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, "-") || "commander";
}

function getCommanderSourceId(ownerPlayer, card = {}, index = 0) {
  const source = card.raw || card.card || card;
  if (card.isPrimaryCommander) {
    return `${ownerPlayer.id}:primary`;
  }

  const cardId = card.id || source.id || source.scryfall_id || source.scryfallId || "";
  if (cardId) {
    return `${ownerPlayer.id}:${cardId}`;
  }

  const name = card.name || source.name || ownerPlayer.commanderQuery || ownerPlayer.name || `Commander ${index + 1}`;
  if (card.name || source.name || ownerPlayer.commanderQuery || ownerPlayer.backgroundUrl) {
    return `${ownerPlayer.id}:${normalizeCommanderKey(name)}`;
  }

  return `${ownerPlayer.id}:primary`;
}

function getPlayerCommanderSources(ownerPlayer) {
  ensurePlayerIds();
  const commanders = (ownerPlayer.deckCards || []).filter((card) => {
    const board = String(card.board || "").toLowerCase();
    return board === "commanders" || board === "commander";
  });
  const sourceCards = commanders.length ? commanders : [{
    isPrimaryCommander: true,
    name: ownerPlayer.commanderQuery || ownerPlayer.name || "Commander",
    image_uris: ownerPlayer.backgroundUrl ? { art_crop: ownerPlayer.backgroundUrl, normal: ownerPlayer.backgroundUrl } : {},
  }];
  const seen = new Set();

  return sourceCards.map((card, index) => {
    const id = getCommanderSourceId(ownerPlayer, card, index);
    if (seen.has(id)) {
      return null;
    }
    seen.add(id);
    return {
      id,
      ownerId: ownerPlayer.id,
      ownerName: ownerPlayer.name,
      ownerColor: ownerPlayer.artColor || colors[ownerPlayer.colorIndex],
      name: getCardName(card) || ownerPlayer.commanderQuery || ownerPlayer.name || "Commander",
      imageUrl: getCardImage(card, true) || ownerPlayer.backgroundUrl || "",
    };
  }).filter(Boolean);
}

function getCommanderSources() {
  ensurePlayerIds();
  return state.players.flatMap((player) => getPlayerCommanderSources(player));
}

function pruneCommanderDamageState() {
  ensurePlayerIds();
  const playerIds = new Set(state.players.map((player) => player.id));
  const commanderIds = new Set(getCommanderSources().map((commander) => commander.id));
  const nextTaken = {};

  Object.entries(state.commanderDamageTaken || {}).forEach(([defenderId, sourceMap]) => {
    if (!playerIds.has(defenderId)) return;
    const nextSourceMap = {};
    Object.entries(sourceMap || {}).forEach(([commanderId, damage]) => {
      if (commanderIds.has(commanderId) && Number(damage) > 0) {
        nextSourceMap[commanderId] = Math.max(0, Number(damage) || 0);
      }
    });
    nextTaken[defenderId] = nextSourceMap;
  });

  state.commanderDamageTaken = nextTaken;
}

function getCommanderDamageMap(player) {
  ensurePlayerIds();
  if (!state.commanderDamageTaken[player.id]) {
    state.commanderDamageTaken[player.id] = {};
  }
  return state.commanderDamageTaken[player.id];
}

function getCommanderDamage(player, commanderId) {
  return Math.max(0, Number(getCommanderDamageMap(player)[commanderId] || 0));
}

function getCommanderSourceById(commanderId) {
  return getCommanderSources().find((commander) => commander.id === commanderId) || null;
}

function getLethalCommanderDamage(player) {
  const damageMap = state.commanderDamageTaken[player.id] || {};
  const lethalEntry = Object.entries(damageMap).find(([, damage]) => Number(damage) >= 21);
  if (!lethalEntry) {
    return null;
  }

  const [commanderId, damage] = lethalEntry;
  return {
    commanderId,
    damage: Number(damage),
    source: getCommanderSourceById(commanderId),
  };
}

function getDeathState(player) {
  const lethalCommander = getLethalCommanderDamage(player);
  if (lethalCommander) {
    const commanderName = lethalCommander.source?.name || "one commander";
    return {
      type: "commander",
      reason: `21 commander damage from ${commanderName}.`,
      commanderId: lethalCommander.commanderId,
    };
  }

  if ((player.counters.poison || 0) >= 10) {
    return { type: "poison", reason: "10 poison counters." };
  }

  if ((player.counters.infect || 0) >= 10) {
    return { type: "infect", reason: "10 infect counters." };
  }

  if (player.life <= 0) {
    return { type: "life", reason: "Life total reached 0." };
  }

  return null;
}

function checkPlayerDeath(player, context = {}) {
  const deathState = getDeathState(player);
  if (!deathState) {
    if (player.isDead && player.life > 0) {
      player.isDead = false;
      player.deathEntering = false;
      player.deathReason = "";
      player.commanderDamageDeathRestoreLife = null;
      player.infectDeathRestoreLife = null;
    }
    return false;
  }

  if (deathState.type === "commander" || deathState.type === "infect") {
    const wasAlive = player.life > 0;
    player.life = 0;
    if (wasAlive) {
      setLifeFlash(player, "loss");
    }
  }

  if (player.isDead) {
    player.deathReason = deathState.reason;
    return true;
  }

  player.isDead = true;
  player.deathEntering = true;
  player.deathReason = deathState.reason;
  tableMessage.value = `${player.name} is dead: ${deathState.reason}`;
  logHistoryEntry({
    type: "death",
    playerName: player.name,
    seat: getPlayerSeat(player),
    reason: deathState.reason,
    deathType: deathState.type,
    previousLife: Number.isFinite(context.previousLife) ? context.previousLife : null,
    nextLife: player.life,
  });
  return true;
}

function getLifeTrackerTimerSet(player) {
  let timers = lifeTrackerTimers.get(player);
  if (!timers) {
    timers = {
      lifeFlash: 0,
      gainHide: 0,
      gainFlash: 0,
      gainQuickHide: 0,
      lossHide: 0,
      lossFlash: 0,
      lossQuickHide: 0,
    };
    lifeTrackerTimers.set(player, timers);
  }
  return timers;
}

function setLifeFlash(player, direction) {
  if (!direction) {
    return;
  }

  const timers = getLifeTrackerTimerSet(player);
  const flashId = (player.lifeFlashId || 0) + 1;
  player.lifeFlash = direction;
  player.lifeFlashId = flashId;

  window.clearTimeout(timers.lifeFlash);
  timers.lifeFlash = window.setTimeout(() => {
    if (player.lifeFlashId !== flashId) {
      return;
    }

    player.lifeFlash = "";
    render();
  }, 540);
}

function quickHideOppositeLifeTracker(player, direction, timers) {
  const opposite = direction === "gain" ? "loss" : "gain";
  const oppositeTracker = player.lifeTrackers?.[opposite];
  if (!oppositeTracker?.visible) {
    return;
  }

  const hideKey = `${opposite}Hide`;
  const flashKey = `${opposite}Flash`;
  const quickHideKey = `${opposite}QuickHide`;
  window.clearTimeout(timers[hideKey]);
  window.clearTimeout(timers[flashKey]);
  window.clearTimeout(timers[quickHideKey]);
  oppositeTracker.flash = false;
  timers[quickHideKey] = window.setTimeout(() => {
    oppositeTracker.visible = false;
    oppositeTracker.amount = 0;
    oppositeTracker.flash = false;
    render();
  }, 700);
}

function recordLifeButtonChange(player, amount) {
  if (!amount) {
    return;
  }

  if (!player.lifeTrackers) {
    player.lifeTrackers = createLifeTrackers();
  }

  const direction = amount > 0 ? "gain" : "loss";
  const tracker = player.lifeTrackers[direction];
  const timers = getLifeTrackerTimerSet(player);
  const hideKey = `${direction}Hide`;
  const flashKey = `${direction}Flash`;
  const quickHideKey = `${direction}QuickHide`;

  quickHideOppositeLifeTracker(player, direction, timers);

  if (!tracker.visible) {
    tracker.amount = 0;
  }

  tracker.amount += Math.abs(amount);
  tracker.visible = true;
  tracker.flash = true;
  tracker.flashId = (tracker.flashId || 0) + 1;

  window.clearTimeout(timers[hideKey]);
  window.clearTimeout(timers[flashKey]);
  window.clearTimeout(timers[quickHideKey]);
  timers[flashKey] = window.setTimeout(() => {
    tracker.flash = false;
    render();
  }, 420);
  timers[hideKey] = window.setTimeout(() => {
    tracker.visible = false;
    tracker.amount = 0;
    tracker.flash = false;
    render();
  }, 5000);
}

function changeLife(player, amount) {
  const previousLife = player.life;
  const nextLife = Math.max(0, player.life + amount);
  if (nextLife === previousLife) {
    tableMessage.value = `${player.name} is already at ${player.life} life.`;
    checkPlayerDeath(player, { previousLife });
    render();
    return;
  }

  pushUndoSnapshot(`${player.name} life change`);
  player.life = nextLife;
  const actualChange = player.life - previousLife;
  if (actualChange) {
    setLifeFlash(player, actualChange > 0 ? "gain" : "loss");
  }
  tableMessage.value = `${player.name} ${amount > 0 ? "gains" : "loses"} ${Math.abs(actualChange || amount)} life.`;
  recordLifeButtonChange(player, player.life - previousLife);
  if (actualChange) {
    logHistoryEntry({
      type: "life",
      playerName: player.name,
      seat: getPlayerSeat(player),
      delta: actualChange,
      input: amount,
      previousValue: previousLife,
      nextValue: player.life,
    });
  }
  checkPlayerDeath(player, { previousLife });
  render();
}

function stopLifeHold(shouldApplyTap = false) {
  const active = activeLifeHold;
  if (!active) {
    return;
  }

  window.clearTimeout(active.startTimer);
  window.clearInterval(active.interval);
  active.button?.classList.remove("holding");
  if (shouldApplyTap && !active.didHold) {
    changeLife(active.player, active.direction);
  }
  activeLifeHold = null;
}

function bindLifeButton(button, player) {
  const direction = Number(button.dataset.life);

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    stopLifeHold(false);

    activeLifeHold = {
      player,
      direction,
      button,
      didHold: false,
      startTimer: 0,
      interval: 0,
    };
    button.classList.add("holding");

    activeLifeHold.startTimer = window.setTimeout(() => {
      const active = activeLifeHold;
      if (!active) {
        return;
      }

      active.didHold = true;
      changeLife(player, direction * 5);
      active.interval = window.setInterval(() => {
        changeLife(player, direction * 5);
      }, 750);
    }, 420);
  });
}

function stopCommanderDamageHold(shouldApplyTap = false) {
  const active = activeCommanderDamageHold;
  if (!active) {
    return;
  }

  window.clearTimeout(active.startTimer);
  window.clearInterval(active.interval);
  active.button?.classList.remove("holding");
  if (shouldApplyTap && !active.didHold) {
    changeCommanderDamage(active.defender, active.commanderId, active.direction);
  }
  activeCommanderDamageHold = null;
}

function bindCommanderDamageButton(button, defender, commanderId, direction) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    stopLifeHold(false);
    stopCommanderDamageHold(false);

    activeCommanderDamageHold = {
      defender,
      commanderId,
      direction,
      button,
      didHold: false,
      startTimer: 0,
      interval: 0,
    };
    button.classList.add("holding");

    activeCommanderDamageHold.startTimer = window.setTimeout(() => {
      const active = activeCommanderDamageHold;
      if (!active) {
        return;
      }

      active.didHold = true;
      changeCommanderDamage(active.defender, active.commanderId, active.direction * 5);
      active.interval = window.setInterval(() => {
        changeCommanderDamage(active.defender, active.commanderId, active.direction * 5);
      }, 750);
    }, 420);
  });
}

function changeCounter(player, counter, amount) {
  const previousCounter = player.counters[counter] || 0;
  const previousLife = player.life;
  const nextCounter = Math.max(0, previousCounter + amount);
  if (nextCounter === previousCounter) {
    const label = counterTypes.find((item) => item.key === counter)?.label || counter;
    tableMessage.value = `${player.name}: ${label} is already ${previousCounter}.`;
    return;
  }

  pushUndoSnapshot(`${player.name} ${counter} counter`);
  player.counters[counter] = nextCounter;
  const label = counterTypes.find((item) => item.key === counter)?.label || counter;
  if (counter === "infect" && amount > 0) {
    if (previousCounter < 10 && player.counters[counter] >= 10) {
      player.infectDeathRestoreLife = previousLife;
    }
    tableMessage.value = `${player.name}: ${label} is now ${player.counters[counter]}.`;
  } else if (counter === "infect" && amount < 0) {
    const restoreLife = Number(player.infectDeathRestoreLife);
    if (previousCounter >= 10 && player.counters[counter] < 10 && player.infectDeathRestoreLife !== null && Number.isFinite(restoreLife)) {
      player.life = Math.max(0, restoreLife);
      if (player.life > previousLife) {
        setLifeFlash(player, "gain");
      }
      tableMessage.value = `${player.name}: ${label} is now ${player.counters[counter]}. Life restored to ${player.life}.`;
    } else {
      tableMessage.value = `${player.name}: ${label} is now ${player.counters[counter]}.`;
    }
    player.infectDeathRestoreLife = null;
  } else {
    tableMessage.value = `${player.name}: ${label} is now ${player.counters[counter]}.`;
  }
  checkPlayerDeath(player, { previousLife });
  const counterDelta = player.counters[counter] - previousCounter;
  if (counterDelta) {
    logHistoryEntry({
      type: "counter",
      playerName: player.name,
      seat: getPlayerSeat(player),
      counter,
      label,
      delta: counterDelta,
      input: amount,
      previousValue: previousCounter,
      nextValue: player.counters[counter],
      previousLife,
      nextLife: player.life,
      lifeDelta: player.life - previousLife,
    });
  }
  render();
}

function changeCommanderDamage(defender, commanderId, amount) {
  const commander = getCommanderSourceById(commanderId);
  if (!defender || !commander || !amount) {
    return;
  }

  const damageMap = getCommanderDamageMap(defender);
  const previousDamage = getCommanderDamage(defender, commanderId);
  const nextDamage = Math.max(0, previousDamage + amount);
  const actualDamageDelta = nextDamage - previousDamage;
  if (!actualDamageDelta) {
    tableMessage.value = `${defender.name} has no commander damage from ${commander.name} to remove.`;
    return;
  }

  pushUndoSnapshot(`${defender.name} commander damage from ${commander.name}`);
  const previousLife = defender.life;
  damageMap[commanderId] = nextDamage;

  if (actualDamageDelta > 0) {
    if (previousDamage < 21 && nextDamage >= 21) {
      defender.commanderDamageDeathRestoreLife = previousLife;
    }
    defender.life = Math.max(0, defender.life - actualDamageDelta);
    setLifeFlash(defender, "loss");
    tableMessage.value = `${defender.name} took ${actualDamageDelta} commander damage from ${commander.name}.`;
  } else {
    const removedDamage = Math.abs(actualDamageDelta);
    if (previousDamage >= 21 && nextDamage < 21 && defender.commanderDamageDeathRestoreLife !== null) {
      defender.life = Math.max(0, Number(defender.commanderDamageDeathRestoreLife));
      defender.commanderDamageDeathRestoreLife = null;
    } else {
      defender.life += removedDamage;
    }
    setLifeFlash(defender, "gain");
    tableMessage.value = `${defender.name} removed ${removedDamage} commander damage from ${commander.name}.`;
  }

  checkPlayerDeath(defender, { previousLife });
  logHistoryEntry({
    type: "commanderDamage",
    playerName: defender.name,
    seat: getPlayerSeat(defender),
    commanderName: commander.name,
    commanderOwner: commander.ownerName,
    commanderId,
    delta: actualDamageDelta,
    previousValue: previousDamage,
    nextValue: nextDamage,
    previousLife,
    nextLife: defender.life,
    lifeDelta: defender.life - previousLife,
  });

  render();
  if (cardModal.open && state.activeCommanderDamagePlayerId === defender.id) {
    renderCommanderDamagePanel(defender);
  }
}

function getCardImage(card, preferArt = true) {
  const source = card.raw || card.card || card;
  const uris = card.image_uris || card.imageUris || card.imageUrls || source.image_uris || source.imageUris || source.imageUrls || source.card?.image_uris || source.card?.imageUris || source.card?.imageUrls;
  if (uris) {
    return (preferArt && uris.art_crop) || uris.png || uris.large || uris.normal || uris.small || "";
  }

  const moxfieldImageId = card.id || source.id || card.uniqueCardId || source.uniqueCardId;
  const moxfieldImageSeq = card.image_seq || source.image_seq || Date.now();
  if (moxfieldImageId) {
    return `https://assets.moxfield.net/cards/card-${moxfieldImageId}-normal.webp?${moxfieldImageSeq}`;
  }

  const faces = card.card_faces || card.cardFaces || source.card_faces || source.cardFaces || source.card?.card_faces || source.card?.cardFaces || [];
  const faceWithImage = faces.find((face) => face.image_uris || face.imageUris || face.imageUrls);
  const faceUris = faceWithImage?.image_uris || faceWithImage?.imageUris || faceWithImage?.imageUrls;
  return ((preferArt && faceUris?.art_crop) || faceUris?.png || faceUris?.large || faceUris?.normal || faceUris?.small || "");
}

function getCardArtKey(card) {
  const source = card.raw || card.card || card;
  const faces = card.card_faces || card.cardFaces || source.card_faces || source.cardFaces || source.card?.card_faces || source.card?.cardFaces || [];
  const faceWithArt = faces.find((face) => face.illustration_id || face.image_uris?.art_crop || face.imageUris?.art_crop || face.imageUrls?.art_crop || face.image_uris?.normal || face.imageUris?.normal || face.imageUrls?.normal);
  const uris = card.image_uris || card.imageUris || card.imageUrls || source.image_uris || source.imageUris || source.imageUrls || source.card?.image_uris || source.card?.imageUris || source.card?.imageUrls;
  const faceUris = faceWithArt?.image_uris || faceWithArt?.imageUris || faceWithArt?.imageUrls;
  return card.illustration_id ||
    card.illustrationId ||
    source.illustration_id ||
    source.illustrationId ||
    faceWithArt?.illustration_id ||
    faceWithArt?.illustrationId ||
    uris?.art_crop ||
    uris?.artCrop ||
    faceUris?.art_crop ||
    faceUris?.artCrop ||
    getCardImage(card, false) ||
    getCardImage(card);
}

function getUniqueArtCards(cards) {
  const seen = new Set();
  return cards.filter((card) => {
    const imageUrl = getCardImage(card, false) || getCardImage(card);
    if (!imageUrl) return false;
    const key = getCardArtKey(card) || imageUrl;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getCommanderBackgroundImage(cardOrUrl) {
  if (!cardOrUrl) return "";
  if (typeof cardOrUrl === "string") return cardOrUrl;
  return getCardImage(cardOrUrl, true);
}

function getCardName(card) {
  return card.name || card.card?.name || card.front?.name || "Unknown card";
}

function getCardText(card) {
  return [
    card.name,
    card.type_line,
    card.typeLine,
    card.oracle_text,
    card.oracleText,
    card.card?.name,
    card.card?.type_line,
    card.card?.typeLine,
    card.card?.oracle_text,
    card.card?.oracleText,
    card.type,
    card.text,
  ].filter(Boolean).join(" ").toLowerCase();
}

async function fetchNamedCard(query) {
  const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error("Card not found");
  }
  return response.json();
}

async function setCommanderArt(player, query) {
  const search = query.trim();

  if (!search) {
    player.commanderQuery = "";
    player.backgroundUrl = "";
    player.artColor = "";
    tableMessage.value = `${player.name} background cleared.`;
    render();
    return;
  }

  player.commanderQuery = search;
  tableMessage.value = `Searching Scryfall for ${search}...`;
  render();

  try {
    const card = await fetchNamedCard(search);
    const imageUrl = getCardImage(card);

    if (!imageUrl) {
      throw new Error("No card image available");
    }

    setCommanderForPlayer(player, card.name, imageUrl);
    tableMessage.value = `${card.name} spawned in as commander.`;
  } catch (error) {
    tableMessage.value = `Could not find art for ${search}.`;
  }

  render();
}

function getVisibleCounters(player) {
  const keys = player.visibleCounterKeys;
  const visible = keys ? counterTypes.filter((counter) => keys.includes(counter.key)) : counterTypes.filter((counter) => defaultCounterKeys.includes(counter.key));
  return visible.length ? visible : counterTypes.filter((counter) => counter.always);
}

function buildCounter(counter, player) {
  const row = document.createElement("div");
  row.className = "counter";

  const label = document.createElement("span");
  label.textContent = counter.label;

  const controls = document.createElement("div");
  const decrease = document.createElement("button");
  decrease.type = "button";
  decrease.dataset.counter = counter.key;
  decrease.dataset.counterDelta = "-1";
  decrease.setAttribute("aria-label", `Decrease ${counter.label}`);
  decrease.textContent = "-";

  const value = document.createElement("output");
  value.textContent = player.counters[counter.key] || 0;

  const increase = document.createElement("button");
  increase.type = "button";
  increase.dataset.counter = counter.key;
  increase.dataset.counterDelta = "1";
  increase.setAttribute("aria-label", `Increase ${counter.label}`);
  increase.textContent = "+";

  controls.append(decrease, value, increase);
  row.append(label, controls);
  return row;
}

function getHighestCommanderDamage(player) {
  const values = Object.values(state.commanderDamageTaken[player.id] || {});
  return values.length ? Math.max(...values.map((value) => Number(value) || 0)) : 0;
}

function buildCommanderDamageTile(defender, commander) {
  const damageValue = getCommanderDamage(defender, commander.id);
  const tile = document.createElement("article");
  tile.className = "commander-damage-tile";
  tile.style.setProperty("--owner-color", commander.ownerColor || "var(--accent)");
  tile.classList.toggle("lethal", damageValue >= 21);

  const imageWrap = document.createElement("div");
  imageWrap.className = "commander-damage-art";
  if (commander.imageUrl) {
    const image = document.createElement("img");
    image.src = commander.imageUrl;
    image.alt = commander.name;
    image.loading = "lazy";
    imageWrap.appendChild(image);
  } else {
    imageWrap.textContent = commander.name.slice(0, 2).toUpperCase();
  }

  const meta = document.createElement("div");
  meta.className = "commander-damage-meta";
  const name = document.createElement("strong");
  name.textContent = commander.name;
  const owner = document.createElement("span");
  owner.textContent = commander.ownerName;
  meta.append(name, owner);

  const damage = document.createElement("output");
  damage.className = "commander-damage-value";
  damage.value = damageValue;
  damage.textContent = damage.value;
  damage.setAttribute("aria-label", `${damage.value} commander damage from ${commander.name}`);

  const controls = document.createElement("div");
  controls.className = "commander-damage-controls";
  const decrease = document.createElement("button");
  decrease.type = "button";
  decrease.className = "commander-damage-step minus";
  decrease.dataset.commanderDelta = "-1";
  decrease.textContent = "-";
  decrease.setAttribute("aria-label", `Remove commander damage from ${commander.name}`);
  decrease.disabled = damageValue <= 0;
  bindCommanderDamageButton(decrease, defender, commander.id, -1);
  const increase = document.createElement("button");
  increase.type = "button";
  increase.className = "commander-damage-step plus";
  increase.dataset.commanderDelta = "1";
  increase.textContent = "+";
  increase.setAttribute("aria-label", `Add commander damage from ${commander.name}`);
  bindCommanderDamageButton(increase, defender, commander.id, 1);
  controls.append(decrease, increase);

  tile.append(imageWrap, meta, damage, controls);
  return tile;
}

function renderCommanderDamagePanel(defender) {
  const currentDefender = state.players.find((player) => player.id === defender.id) || defender;
  modalTitle.textContent = `Commander damage to ${currentDefender.name}`;
  cardPreview.hidden = true;
  cardPreview.className = "card-preview";
  cardPreview.innerHTML = "";
  modalGrid.innerHTML = "";
  modalGrid.className = "modal-grid commander-damage-grid";

  const commanders = getCommanderSources();
  if (!commanders.length) {
    showModalMessage("Set a commander or load a deck to track commander damage.");
    return;
  }

  commanders.forEach((commander) => {
    modalGrid.appendChild(buildCommanderDamageTile(currentDefender, commander));
  });
}

function openCommanderDamagePanel(defender) {
  ensurePlayerIds();
  state.activeCommanderDamagePlayerId = defender.id;
  showModal(`Commander damage to ${defender.name}`);
  renderCommanderDamagePanel(defender);
}

function setCounterVisible(player, key, visible) {
  player.counterPickerOpen = true;
  const keys = new Set(player.visibleCounterKeys || defaultCounterKeys);
  if (visible) {
    keys.add(key);
  } else if (!defaultCounterKeys.includes(key)) {
    keys.delete(key);
  }

  defaultCounterKeys.forEach((defaultKey) => keys.add(defaultKey));
  player.visibleCounterKeys = counterTypes.filter((counter) => keys.has(counter.key)).map((counter) => counter.key);
  render();
}

function buildCounterOption(counter, player) {
  const label = document.createElement("label");
  label.className = "counter-option";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = (player.visibleCounterKeys || defaultCounterKeys).includes(counter.key);
  checkbox.disabled = defaultCounterKeys.includes(counter.key);
  checkbox.addEventListener("change", () => setCounterVisible(player, counter.key, checkbox.checked));

  label.appendChild(checkbox);
  label.append(counter.label);
  return label;
}

function showModal(title) {
  modalTitle.textContent = title;
  modalGrid.innerHTML = "";
  modalGrid.className = "modal-grid";
  cardPreview.hidden = true;
  cardPreview.className = "card-preview";
  cardPreview.innerHTML = "";
  cardModal.showModal();
}

function showModalMessage(message) {
  modalGrid.innerHTML = "";
  const note = document.createElement("p");
  note.className = "modal-note";
  note.textContent = message;
  modalGrid.appendChild(note);
}

function buildCardTile({ title, imageUrl, subtitle, actionLabel, onClick }) {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "card-tile";

  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = title;
    tile.appendChild(image);
  } else {
    const fallback = document.createElement("div");
    fallback.className = "image-fallback";
    fallback.textContent = title;
    tile.appendChild(fallback);
  }

  const label = document.createElement("span");
  label.textContent = title;
  tile.appendChild(label);

  if (subtitle) {
    const detail = document.createElement("small");
    detail.textContent = subtitle;
    tile.appendChild(detail);
  }

  if (actionLabel) {
    const action = document.createElement("strong");
    action.textContent = actionLabel;
    tile.appendChild(action);
  }

  tile.addEventListener("click", onClick);
  return tile;
}

function showCardPreview({
  title,
  imageUrl,
  subtitle,
  status,
  artChoices = [],
  selectedArtIndex = 0,
  onSelectArt,
  onUse,
  selectLabel = "Select commander",
  previewClass = "",
  artGridClass = "",
}) {
  cardPreview.hidden = false;
  cardPreview.className = ["card-preview", previewClass].filter(Boolean).join(" ");
  cardPreview.classList.toggle("single-art", artChoices.length <= 1);
  cardPreview.innerHTML = "";

  const image = document.createElement("img");
  image.src = imageUrl;
  image.alt = title;
  cardPreview.appendChild(image);

  const details = document.createElement("div");
  details.className = "card-preview-details";

  const heading = document.createElement("h3");
  heading.textContent = title;
  details.appendChild(heading);

  if (subtitle) {
    const sub = document.createElement("p");
    sub.textContent = subtitle;
    details.appendChild(sub);
  }

  if (status) {
    const statusLine = document.createElement("small");
    statusLine.className = "art-status";
    statusLine.textContent = status;
    details.appendChild(statusLine);
  }

  if (artChoices.length > 1) {
    const artGrid = document.createElement("div");
    artGrid.className = ["art-choice-grid", artGridClass].filter(Boolean).join(" ");
    artGrid.setAttribute("aria-label", "Alternate card arts");

    artChoices.forEach((choice, index) => {
      const artButton = document.createElement("button");
      artButton.type = "button";
      artButton.className = "card-tile art-choice";
      artButton.classList.toggle("active", index === selectedArtIndex);
      artButton.setAttribute("aria-label", `Select art ${index + 1}`);

      const thumbnail = document.createElement("img");
      thumbnail.src = getCardImage(choice, false) || getCardImage(choice);
      thumbnail.alt = getPrintSubtitle(choice, `Print ${index + 1}`);
      const label = document.createElement("span");
      label.textContent = getPrintSubtitle(choice, `Print ${index + 1}`);
      artButton.appendChild(thumbnail);
      artButton.appendChild(label);

      artButton.addEventListener("click", () => onSelectArt(index));
      artGrid.appendChild(artButton);
    });

    details.appendChild(artGrid);
  }

  const actions = document.createElement("div");
  actions.className = "card-preview-actions";

  const useButton = document.createElement("button");
  useButton.type = "button";
  useButton.textContent = selectLabel;
  useButton.addEventListener("click", onUse);
  actions.appendChild(useButton);

  details.appendChild(actions);

  cardPreview.appendChild(details);
}

function getPrintSubtitle(card, fallback = "") {
  const setName = card.set_name || card.setName || card.raw?.set_name || card.raw?.setName;
  const collectorNumber = card.collector_number || card.collectorNumber || card.raw?.collector_number || card.raw?.collectorNumber;
  const print = [setName, collectorNumber].filter(Boolean).join(" #");
  return print || fallback;
}

async function fetchCardPrints(name) {
  const named = await fetchNamedCard(name);
  const exactNameQuery = encodeURIComponent(`!"${named.name}"`);
  const response = await fetch(`https://api.scryfall.com/cards/search?unique=prints&order=released&q=${exactNameQuery}`);

  if (!response.ok) {
    throw new Error("No prints found");
  }

  const data = await response.json();
  return getUniqueArtCards(data.data || []);
}

async function showDeckCardArtPreview(player, deckCard, subtitle) {
  let prints = getUniqueArtCards([deckCard]);
  let currentIndex = 0;

  const renderPreview = (status = "Loading alternate prints...") => {
    prints = getUniqueArtCards(prints);
    const selected = prints[currentIndex] || deckCard;
    const imageUrl = getCardImage(selected, false) || getCardImage(selected);
    const title = getCardName(selected);

    showCardPreview({
      title,
      imageUrl,
      subtitle: getPrintSubtitle(selected, subtitle),
      status,
      artChoices: prints,
      selectedArtIndex: currentIndex,
      onSelectArt: (index) => {
        currentIndex = index;
        renderPreview(`${currentIndex + 1} of ${prints.length} prints`);
      },
      onUse: () => {
        setCommanderForPlayer(player, title, getCardImage(selected));
        tableMessage.value = `${title} spawned in as commander.`;
        cardModal.close();
        render();
      },
    });
  };

  renderPreview();

  try {
    const fetchedPrints = await fetchCardPrints(deckCard.name);
    if (fetchedPrints.length) {
      prints = getUniqueArtCards(fetchedPrints);
      currentIndex = Math.max(0, prints.findIndex((card) => getCardImage(card, false) === getCardImage(deckCard, false)));
      renderPreview(`${currentIndex + 1} of ${prints.length} prints`);
    } else {
      renderPreview("No alternate prints found");
    }
  } catch (error) {
    renderPreview("Could not load alternate prints");
  }
}

async function openArtPicker(player, query) {
  const search = query.trim() || player.commanderQuery.trim();

  if (!search) {
    tableMessage.value = "Enter a card name first.";
    return;
  }

  showModal(`Arts for ${search}`);
  showModalMessage("Loading Scryfall prints...");

  try {
    const named = await fetchNamedCard(search);
    const exactNameQuery = encodeURIComponent(`!"${named.name}"`);
    const response = await fetch(`https://api.scryfall.com/cards/search?unique=prints&order=released&q=${exactNameQuery}`);

    if (!response.ok) {
      throw new Error("No prints found");
    }

    const data = await response.json();
    const prints = getUniqueArtCards(data.data || []);

    if (!prints.length) {
      showModalMessage("No card images were available for that search.");
      return;
    }

    let currentIndex = 0;
    const renderArtSelection = (status = `${prints.length} unique ${prints.length === 1 ? "art" : "arts"} available`) => {
      const selected = prints[currentIndex] || prints[0];
      const title = getCardName(selected);
      modalGrid.innerHTML = "";
      modalGrid.className = "modal-grid commander-art-selector-grid";
      showCardPreview({
        title,
        imageUrl: getCardImage(selected, false) || getCardImage(selected),
        subtitle: getPrintSubtitle(selected, `Print ${currentIndex + 1}`),
        status,
        artChoices: prints,
        selectedArtIndex: currentIndex,
        previewClass: "commander-art-preview",
        artGridClass: "commander-art-choice-grid",
        selectLabel: "Select commander",
        onSelectArt: (index) => {
          currentIndex = index;
          renderArtSelection(`${currentIndex + 1} of ${prints.length} prints selected`);
        },
        onUse: () => {
          setCommanderForPlayer(player, title, getCommanderBackgroundImage(selected), { card: selected });
          tableMessage.value = `${title} spawned in as commander.`;
          cardModal.close();
          render();
        },
      });
    };

    renderArtSelection();
  } catch (error) {
    showModalMessage("Could not load alternate arts for that card.");
  }
}

function positionSuggestions(input) {
  const rect = input.getBoundingClientRect();
  globalSuggestions.style.left = `${rect.left}px`;
  globalSuggestions.style.top = `${rect.bottom + 5}px`;
  globalSuggestions.style.width = `${rect.width}px`;
}

function positionCounterMenu(details) {
  const summary = details.querySelector("summary");
  const menu = details.querySelector(".counter-options");
  if (!summary || !menu) {
    return;
  }

  const counterGrid = details.parentElement?.querySelector(".counter-grid");
  const anchor = counterGrid || summary;
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(330, window.innerWidth - 16);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  const preferredTop = rect.top;
  const maxTop = window.innerHeight - Math.min(230, window.innerHeight - 16) - 8;
  const top = Math.max(8, Math.min(preferredTop, maxTop));
  const buttonTop = Math.max(8, top - 34);

  details.style.setProperty("--counter-menu-left", `${left}px`);
  details.style.setProperty("--counter-menu-top", `${top}px`);
  details.style.setProperty("--counter-menu-width", `${width}px`);
  details.style.setProperty("--counter-button-top", `${buttonTop}px`);
}

function positionOpenCounterMenus() {
  document.querySelectorAll(".counter-picker[open]").forEach(positionCounterMenu);
}

function closeCounterMenusOutside(target) {
  if (target.closest?.(".counter-picker") || target.closest?.(".counter-options")) {
    return;
  }

  document.querySelectorAll(".counter-picker[open]").forEach((picker) => {
    picker.open = false;
  });
  state.players.forEach((player) => {
    player.counterPickerOpen = false;
  });
}

function fitPlayerCardToContent(card) {
  const anchor = card.querySelector(".counter-picker") || [...card.children].filter((child) => {
    return !child.classList.contains("card-art") && !child.classList.contains("card-shade") && !child.classList.contains("death-overlay");
  }).at(-1);

  if (!anchor) {
    return;
  }

  const cardRect = card.getBoundingClientRect();
  const lastRect = anchor.getBoundingClientRect();
  const style = window.getComputedStyle(card);
  const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
  const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
  const targetHeight = Math.ceil(lastRect.bottom - cardRect.top + paddingBottom + borderBottom);
  card.style.height = `${targetHeight}px`;
  card.style.minHeight = `${targetHeight}px`;
  card.style.maxHeight = `${targetHeight}px`;
}

function fitPlayerCardsToContent() {
  document.querySelectorAll(".player-card").forEach(fitPlayerCardToContent);
}

function hideSuggestions() {
  globalSuggestions.hidden = true;
  globalSuggestions.innerHTML = "";
}

function isDeckImportLikeInput(value = "") {
  return looksLikeMoxfieldImport(value) || /moxfield\.com/i.test(value) || /^https?:\/\//i.test(value) || value.includes("\n");
}

function closeDeckImportEditor(player) {
  player.showDeckEditor = false;
  hideSuggestions();
  render();
}

function positionRulesSuggestions() {
  const rect = rulesQueryInput.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width, 360), window.innerWidth - 16);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  rulesSuggestions.style.left = `${left}px`;
  rulesSuggestions.style.top = `${rect.bottom + 5}px`;
  rulesSuggestions.style.width = `${width}px`;
}

function hideRulesSuggestions() {
  rulesSuggestions.hidden = true;
  rulesSuggestions.innerHTML = "";
}

function buildSavedDeckSuggestionButton(deck, input, player) {
  const option = document.createElement("button");
  option.type = "button";
  option.className = "saved-deck-suggestion";

  const title = document.createElement("strong");
  title.textContent = deck.name || "Untitled deck";

  const detail = document.createElement("span");
  detail.textContent = `Saved deck | ${getSavedDeckSubtitle(deck)}`;

  option.append(title, detail);
  option.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    input.value = deck.name || "";
    hideSuggestions();
    loadSavedDeckForPlayer(player, deck.id);
  });

  return option;
}

async function fetchTextWithRelay(url) {
  try {
    const direct = await fetch(url);
    if (direct.ok) {
      return direct.text();
    }
  } catch (error) {
    // Local file pages can hit CORS/network blocks before a response exists.
  }

  const relays = [
    `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];

  for (const relayUrl of relays) {
    try {
      const relayed = await fetch(relayUrl);
      if (relayed.ok) {
        return relayed.text();
      }
    } catch (error) {
      // Try the next public relay.
    }
  }

  throw new Error("Rules document unavailable");
}

function parseRulesDocument(text) {
  const normalized = text.replace(/\uFEFF/g, "").replace(/\r/g, "");
  const pattern = /(?=\b(?:[1-9]\.|[1-9]00\.|[1-9]\d{2}\.\d+[a-z]?\.|Glossary\b|Credits\b))/g;
  return normalized
    .split(pattern)
    .map((entry) => entry.replace(/\s+/g, " ").trim())
    .filter((entry) => entry.length > 8)
    .map((entry) => {
      const number = entry.match(/^([1-9]\.|[1-9]00\.|[1-9]\d{2}\.\d+[a-z]?\.)/)?.[1] || "";
      const type = number.endsWith(".") && /^[1-9]\.$/.test(number) ? "Chapter" : number ? "Rule" : "Section";
      const title = number ? entry.slice(number.length).trim() : entry;
      return {
        number,
        type,
        title: title.slice(0, 90),
        text: entry,
        search: entry.toLowerCase(),
      };
    });
}

async function loadRulesIndex() {
  if (rulesIndex.length) {
    return rulesIndex;
  }

  if (!rulesLoadPromise) {
    rulesLoadPromise = fetchTextWithRelay(officialRulesTextUrl).then((text) => {
      rulesIndex = parseRulesDocument(text);
      return rulesIndex;
    });
  }

  return rulesLoadPromise;
}

function scoreRuleMatch(item, query) {
  const text = item.search;
  if (text.startsWith(query)) return 0;
  if (item.number && item.number.startsWith(query)) return 1;
  if (text.includes(` ${query}`)) return item.type === "Chapter" ? 2 : 3;
  if (text.includes(query)) return item.type === "Chapter" ? 4 : 5;
  return 99;
}

async function updateRulesSuggestions() {
  const query = rulesQueryInput.value.trim().toLowerCase();
  selectedRuleSuggestion = null;
  hideRulesSuggestions();

  if (query.length < 2) {
    return;
  }

  rulesSuggestions.innerHTML = "<p>Loading official rules...</p>";
  positionRulesSuggestions();
  rulesSuggestions.hidden = false;

  try {
    const index = await loadRulesIndex();
    const matches = index
      .map((item) => ({ item, score: scoreRuleMatch(item, query) }))
      .filter((match) => match.score < 99)
      .sort((a, b) => a.score - b.score || a.item.text.length - b.item.text.length)
      .slice(0, 8);

    rulesSuggestions.innerHTML = "";

    if (!matches.length) {
      const empty = document.createElement("p");
      empty.textContent = "No matching rules found.";
      rulesSuggestions.appendChild(empty);
      return;
    }

    matches.forEach(({ item }) => {
      const option = document.createElement("button");
      option.type = "button";
      const title = document.createElement("strong");
      title.textContent = `${item.number || item.type} ${item.title}`.trim();
      const preview = document.createElement("span");
      preview.textContent = `${item.text.slice(0, 220)}${item.text.length > 220 ? "..." : ""}`;
      option.append(title, preview);
      option.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        selectedRuleSuggestion = item;
        rulesQueryInput.value = [item.number, item.title].filter(Boolean).join(" ");
        tableMessage.value = item.text;
        hideRulesSuggestions();
      });
      rulesSuggestions.appendChild(option);
    });

    positionRulesSuggestions();
  } catch (error) {
    rulesSuggestions.innerHTML = "<p>Could not load the official rules text.</p>";
  }
}

async function updateSuggestions(input, player) {
  const query = input.value.trim();

  window.clearTimeout(suggestionTimers.get(input));
  hideSuggestions();

  if (query.length < 2) {
    return;
  }

  const timer = window.setTimeout(async () => {
    globalSuggestions.innerHTML = "";

    const savedDeckMatches = findSavedDeckMatches(query);
    savedDeckMatches.forEach((deck) => {
      globalSuggestions.appendChild(buildSavedDeckSuggestionButton(deck, input, player));
    });

    if (!looksLikeMoxfieldImport(query) && !query.includes("/")) {
      try {
        const response = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
          throw new Error("Card autocomplete failed");
        }

        const data = await response.json();
        const suggestions = (data.data || []).slice(0, 7);

        suggestions.forEach((name) => {
          const option = document.createElement("button");
          option.type = "button";
          option.className = "card-suggestion";
          const title = document.createElement("strong");
          title.textContent = name;
          const detail = document.createElement("span");
          detail.textContent = "Card result";
          option.append(title, detail);
          option.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            input.value = name;
            player.commanderQuery = name;
            player.deckInput = name;
            hideSuggestions();
            setCommanderArt(player, name).then(() => {
              if (player.backgroundUrl) {
                player.showCommanderEditor = false;
                render();
              }
            });
          });
          globalSuggestions.appendChild(option);
        });
      } catch (error) {
        // Saved deck matches can still be useful if card autocomplete is unavailable.
      }
    }

    if (globalSuggestions.childElementCount) {
      positionSuggestions(input);
      globalSuggestions.hidden = false;
    }
  }, 220);

  suggestionTimers.set(input, timer);
}

function extractMoxfieldId(link) {
  const trimmed = link.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/decks\/([^/?#]+)/i);
    return match?.[1] || "";
  } catch (error) {
    return trimmed;
  }
}

function looksLikeMoxfieldImport(input) {
  const trimmed = input.trim();
  return /^https?:\/\/(?:www\.)?moxfield\.com\/decks\//i.test(trimmed) || /^[A-Za-z0-9_-]{12,}$/.test(trimmed);
}

async function fetchJsonWithRelay(url) {
  try {
    const direct = await fetch(url);
    if (direct.ok) {
      return direct.json();
    }
  } catch (error) {
    // Local file pages can hit CORS/network blocks before a response exists.
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
      if (!relayed.ok) {
        continue;
      }

      const text = await relayed.text();
      const jsonText = extractJsonFromRelayText(text);
      const parsed = JSON.parse(jsonText);
      return typeof parsed.contents === "string" ? JSON.parse(parsed.contents) : parsed;
    } catch (error) {
      // Try the next public relay.
    }
  }

  throw new Error("Deck unavailable");
}

function extractJsonFromRelayText(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Relay did not return JSON");
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function getBoardEntries(deck, boardName) {
  const board =
    deck[boardName] ||
    deck.boards?.[boardName]?.cards ||
    deck.boards?.[boardName] ||
    deck[`${boardName}Cards`] ||
    {};

  if (Array.isArray(board)) {
    return board;
  }

  if (Array.isArray(board.cards)) {
    return board.cards;
  }

  return Object.values(board || {});
}

function normalizeMoxfieldCards(deck) {
  const boardNames = ["commanders", "mainboard", "sideboard", "companions", "maybeboard"];
  const cards = [];

  boardNames.forEach((boardName) => {
    const entries = getBoardEntries(deck, boardName);

    entries.forEach((entry) => {
      const card = entry.card || entry.Card || entry;
      if (!card) {
        return;
      }

      const quantity = Number(entry.quantity || entry.qty || 1);
      cards.push({
        quantity,
        board: boardName,
        name: getCardName(card),
        type_line: card.type_line || card.typeLine || card.type || "",
        oracle_text: card.oracle_text || card.oracleText || card.text || "",
        image_uris: card.image_uris || card.imageUris || card.imageUrls || card.card?.image_uris,
        card_faces: card.card_faces || card.cardFaces,
        uniqueCardId: card.uniqueCardId || entry.uniqueCardId,
        id: card.id,
        image_seq: card.image_seq,
        raw: card,
      });
    });
  });

  return cards;
}

function parseDecklistNames(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(commander|mainboard|sideboard|maybeboard|companion|deck)$/i.test(line.replace(/:$/, "")))
    .map((line) => line.replace(/^SB:\s*/i, ""))
    .map((line) => {
      const match = line.match(/^(?:(\d+)x?\s+)?(.+?)\s*(?:\([A-Z0-9]{2,}\).*)?$/i);
      return {
        quantity: Number(match?.[1] || 1),
        name: (match?.[2] || line).replace(/\s+\d+$/, "").trim(),
      };
    })
    .filter((entry) => entry.name.length > 0);
}

async function hydrateDecklistWithScryfall(entries) {
  const cards = [];
  const chunks = [];

  for (let index = 0; index < entries.length; index += 75) {
    chunks.push(entries.slice(index, index + 75));
  }

  for (const chunk of chunks) {
    const response = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifiers: chunk.map((entry) => ({ name: entry.name })),
      }),
    });

    if (!response.ok) {
      throw new Error("Could not read pasted decklist");
    }

    const data = await response.json();
    const found = new Map((data.data || []).map((card) => [card.name.toLowerCase(), card]));

    chunk.forEach((entry) => {
      const card = found.get(entry.name.toLowerCase());
      cards.push({
        quantity: entry.quantity,
        board: "pasted",
        name: card?.name || entry.name,
        type_line: card?.type_line || "",
        oracle_text: card?.oracle_text || "",
        image_uris: card?.image_uris,
        card_faces: card?.card_faces,
        raw: card || entry,
      });
    });
  }

  return cards;
}

function detectSmartCounters(cards) {
  const detected = new Set(counterTypes.filter((counter) => counter.always).map((counter) => counter.key));
  const deckText = cards.map(getCardText).join(" ");

  counterTypes.forEach((counter) => {
    if (counter.matches?.some((match) => deckText.includes(match))) {
      detected.add(counter.key);
    }
  });

  return counterTypes.filter((counter) => detected.has(counter.key)).map((counter) => counter.key);
}

async function fetchScryfallById(id) {
  if (!id) {
    throw new Error("No Scryfall ID");
  }

  const response = await fetch(`https://api.scryfall.com/cards/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error("Scryfall card not found");
  }
  return response.json();
}

async function applyImportedDeck(player, cards, sourceLabel) {
  player.deckCards = cards;
  player.visibleCounterKeys = detectSmartCounters(cards);
  player.showDeckEditor = false;

  const commander = cards.find((card) => card.board === "commanders") || cards[0];
  let commanderImage = commander ? getCardImage(commander) : "";
  const scryfallId = commander?.raw?.scryfall_id || commander?.raw?.scryfallId;
  if (scryfallId) {
    try {
      const scryfallCard = await fetchScryfallById(scryfallId);
      commanderImage = getCardImage(scryfallCard) || commanderImage;
    } catch (error) {
      // Moxfield images still work for the deck browser when Scryfall is unavailable.
    }
  }

  if (commander && commanderImage) {
    setCommanderForPlayer(player, commander.name, commanderImage, { keepDeckInput: true });
  }

  tableMessage.value = `${player.name}: imported ${cards.length} ${sourceLabel} entries and tuned counters.`;
}

async function importSmartDeck(player, input) {
  const value = input.trim();

  if (!value) {
    tableMessage.value = "Paste a Moxfield link, deck ID, or decklist first.";
    return;
  }

  if (loadExactSavedDeckForPlayer(player, value)) {
    return;
  }

  player.deckInput = value;

  if (!looksLikeMoxfieldImport(value)) {
    await importPastedDecklist(player, value);
    return;
  }

  const deckId = extractMoxfieldId(value);
  tableMessage.value = `Importing Moxfield deck for ${player.name}...`;
  render();

  try {
    let deck;
    const endpoints = [
      `https://api2.moxfield.com/v3/decks/all/${encodeURIComponent(deckId)}`,
      `https://api2.moxfield.com/v2/decks/all/${encodeURIComponent(deckId)}`,
    ];

    for (const endpoint of endpoints) {
      try {
        deck = await fetchJsonWithRelay(endpoint);
        break;
      } catch (error) {
        // Try the next known public deck endpoint.
      }
    }

    if (!deck) {
      throw new Error("Moxfield deck unavailable");
    }

    const cards = normalizeMoxfieldCards(deck);

    if (!cards.length) {
      throw new Error("No cards found");
    }

    await applyImportedDeck(player, cards, "Moxfield");
  } catch (error) {
    tableMessage.value = "Moxfield link import is blocked for this deck. Paste the exported decklist into the same box and press Smart counters.";
  }

  render();
}

async function setArtOrDeck(player, input) {
  const value = input.trim();

  if (loadExactSavedDeckForPlayer(player, value)) {
    return;
  }

  if (!value && player.deckInput.trim()) {
    await importSmartDeck(player, player.deckInput);
    return;
  }

  if (looksLikeMoxfieldImport(value) || value.includes("\n")) {
    await importSmartDeck(player, value);
    return;
  }

  await setCommanderArt(player, value);
}

async function importPastedDecklist(player, text) {
  const entries = parseDecklistNames(text);

  if (!entries.length) {
    tableMessage.value = "Paste a decklist first.";
    return;
  }

  player.deckInput = text;
  tableMessage.value = `Reading ${entries.length} pasted deck entries...`;
  render();

  try {
    const cards = await hydrateDecklistWithScryfall(entries);
    await applyImportedDeck(player, cards, "pasted deck");
  } catch (error) {
    tableMessage.value = "Could not read that pasted decklist.";
  }

  render();
}

function buildPlayerDeckExport(cards) {
  return cards.map((card) => `${card.quantity || 1} ${card.name}`).join("\n");
}

function importPlayerDeckToBuilder(player) {
  if (!player.deckCards.length) {
    tableMessage.value = "Import a deck to this player first.";
    return;
  }

  const commander = player.deckCards.find((card) => card.board === "commanders") || player.deckCards[0];
  window.dispatchEvent(new CustomEvent("mtg-table-deck-import", {
    detail: {
      name: `${player.name} deck`,
      format: "commander",
      commanderName: commander?.name || player.name,
      commanderArtUrl: player.backgroundUrl || getCardImage(commander || {}),
      deckText: buildPlayerDeckExport(player.deckCards),
      cards: player.deckCards,
    },
  }));

  cardModal.close();
  setActivePage("deck");
  tableMessage.value = `${player.name}'s deck is open in the deck builder.`;
}

function openDeckBrowser(player) {
  const totalCards = player.deckCards.reduce((sum, card) => sum + Number(card.quantity || 1), 0);
  showModal(`${player.name} deck (${totalCards})`);

  if (!player.deckCards.length) {
    showModalMessage("Import a public Moxfield deck with Smart counters first.");
    return;
  }

  const actions = document.createElement("div");
  actions.className = "deck-browser-actions";
  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.textContent = "Import to deck builder";
  importButton.addEventListener("click", () => importPlayerDeckToBuilder(player));
  actions.appendChild(importButton);
  modalGrid.appendChild(actions);

  const groups = groupDeckCards(player.deckCards);

  groups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "deck-section";

    const heading = document.createElement("h3");
    heading.textContent = `${group.label} (${group.total})`;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "deck-section-grid";
    section.appendChild(grid);

    group.cards.forEach((card) => {
    const imageUrl = getCardImage(card, false);
    const subtitle = `${card.quantity}x ${card.board}`;
    grid.appendChild(buildCardTile({
      title: card.name,
      subtitle,
      imageUrl,
      onClick: () => {
        if (imageUrl) {
          showDeckCardArtPreview(player, card, subtitle);
        }
      },
    }));
  });
    modalGrid.appendChild(section);
  });
}

function getDeckCardGroup(card) {
  const board = String(card.board || "").toLowerCase();
  const type = String(card.type_line || card.raw?.type_line || card.raw?.typeLine || "").toLowerCase();

  if (board === "commanders") return "commander";
  if (type.includes("land")) return "land";
  if (type.includes("creature")) return "creature";
  if (type.includes("enchantment")) return "enchantment";
  if (type.includes("artifact")) return "artifact";
  if (type.includes("planeswalker")) return "planeswalker";
  if (type.includes("instant")) return "instant";
  if (type.includes("sorcery")) return "sorcery";
  return "other";
}

function groupDeckCards(cards) {
  const order = [
    ["commander", "Commander"],
    ["creature", "Creatures"],
    ["artifact", "Artifacts"],
    ["enchantment", "Enchantments"],
    ["planeswalker", "Planeswalkers"],
    ["instant", "Instants"],
    ["sorcery", "Sorceries"],
    ["land", "Lands"],
    ["other", "Other"],
  ];

  return order
    .map(([key, label]) => ({
      key,
      label,
      cards: cards
        .filter((card) => getDeckCardGroup(card) === key)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .map((group) => ({
      ...group,
      total: group.cards.reduce((sum, card) => sum + Number(card.quantity || 1), 0),
    }))
    .filter((group) => group.cards.length > 0);
}

function render() {
  updateBoardLayout();
  updateTurnTrackerUi();
  board.innerHTML = "";

  state.players.forEach((player) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.style.setProperty("--player-color", player.artColor || colors[player.colorIndex]);
    node.classList.toggle("spawning", player.spawnFlash);
    node.classList.toggle("dead", player.isDead);
    node.classList.toggle("death-entering", Boolean(player.deathEntering));
    if (player.deathEntering) {
      player.deathEntering = false;
    }

    const art = node.querySelector(".card-art");
    if (player.backgroundUrl) {
      art.style.backgroundImage = `url("${String(player.backgroundUrl || "").replace(/["'()\\]/g, "")}")`;
      node.classList.add("has-art");
    }

    const nameInput = node.querySelector(".player-name");
    nameInput.value = player.name;
    nameInput.setAttribute("aria-label", `${player.name} name`);
    nameInput.addEventListener("input", () => {
      const value = nameInput.value;
      if (!isDeckImportLikeInput(value)) {
        player.name = value.trim() || "Player";
      }
      player.commanderQuery = value;
      updateTurnTrackerUi();
      updateSuggestions(nameInput, player);
    });
    nameInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      setArtOrDeck(player, nameInput.value).then(() => {
        if (player.backgroundUrl) {
          render();
        }
      });
    });
    nameInput.addEventListener("focus", () => {
      updateSuggestions(nameInput, player);
    });
    nameInput.addEventListener("blur", () => {
      window.setTimeout(hideSuggestions, 160);
    });
    const savedDeckSelect = node.querySelector(".saved-deck-select");
    populateSavedDeckSelect(savedDeckSelect);
    savedDeckSelect.addEventListener("focus", () => {
      populateSavedDeckSelect(savedDeckSelect);
    });
    savedDeckSelect.addEventListener("change", () => {
      if (!savedDeckSelect.value) return;
      loadSavedDeckForPlayer(player, savedDeckSelect.value);
    });

    const deathReason = node.querySelector(".death-reason");
    deathReason.textContent = player.deathReason;

    const deckForm = node.querySelector(".deck-tools");
    const deckInput = node.querySelector(".deck-import");
    const closeDeckImportButton = node.querySelector("[data-action='close-deck-import']");
    const showDeckButton = node.querySelector("[data-action='show-deck-import']");
    deckForm.hidden = !player.showDeckEditor;
    if (showDeckButton) {
      showDeckButton.hidden = player.showDeckEditor;
    }
    deckInput.value = player.deckInput;
    deckInput.setAttribute("aria-label", `${player.name} deck import`);
    deckInput.addEventListener("input", () => {
      player.deckInput = deckInput.value;
      player.commanderQuery = deckInput.value;
      updateSuggestions(deckInput, player);
    });
    deckInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDeckImportEditor(player);
        return;
      }

      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }

      event.preventDefault();
      setArtOrDeck(player, deckInput.value).then(() => {
        player.showDeckEditor = false;
        if (player.backgroundUrl || player.deckCards.length) {
          render();
        } else {
          closeDeckImportEditor(player);
        }
      });
    });
    deckInput.addEventListener("focus", () => {
      updateSuggestions(deckInput, player);
    });
    deckInput.addEventListener("blur", () => {
      window.setTimeout(() => {
        hideSuggestions();
      }, 160);
    });
    deckForm.addEventListener("submit", (event) => {
      event.preventDefault();
      setArtOrDeck(player, deckInput.value).then(() => {
        player.showDeckEditor = false;
        render();
      });
    });
    closeDeckImportButton.addEventListener("click", () => closeDeckImportEditor(player));
    node.querySelector("[data-action='set-art-deck']").addEventListener("click", () => {
      if (!player.showDeckEditor) {
        player.showDeckEditor = true;
        render();
        return;
      }

      setArtOrDeck(player, player.showDeckEditor ? deckInput.value : player.deckInput).then(() => {
        if (player.backgroundUrl || player.deckCards.length) {
          render();
        }
      });
    });
    const hasPlayerContext = playerHasCommanderOrDeckContext(player);
    const disabledReason = "Load a commander or deck first.";
    const allArtsButton = node.querySelector("[data-action='arts']");
    const smartButton = node.querySelector("[data-action='smart']");
    const deckButton = node.querySelector("[data-action='deck']");
    setPlayerActionDisabled(allArtsButton, !hasPlayerContext, disabledReason);
    setPlayerActionDisabled(smartButton, !hasPlayerContext, disabledReason);
    setPlayerActionDisabled(deckButton, !hasPlayerContext, disabledReason);

    allArtsButton.addEventListener("click", () => {
      if (allArtsButton.disabled) return;
      openArtPicker(player, player.showDeckEditor ? deckInput.value : player.commanderQuery || player.deckInput);
    });
    smartButton.addEventListener("click", () => {
      if (smartButton.disabled) return;
      if (player.showDeckEditor) {
        importSmartDeck(player, deckInput.value);
      } else {
        importSmartDeck(player, player.deckInput);
      }
    });
    deckButton.addEventListener("click", () => {
      if (deckButton.disabled) return;
      openDeckBrowser(player);
    });
    showDeckButton?.addEventListener("click", () => {
      player.showDeckEditor = true;
      render();
    });

    const lifeTotal = node.querySelector(".life-total");
    lifeTotal.value = player.life;
    const lifeFlashId = player.lifeFlashId || 0;
    if (player.lifeFlash && player.renderedLifeFlashId !== lifeFlashId) {
      lifeTotal.classList.add(player.lifeFlash === "gain" ? "flash-gain" : "flash-loss");
      player.renderedLifeFlashId = lifeFlashId;
    }

    node.querySelectorAll("[data-life]").forEach((button) => {
      const direction = Number(button.dataset.life) > 0 ? "gain" : "loss";
      const tracker = player.lifeTrackers?.[direction];
      const trackerNode = document.createElement("span");
      trackerNode.className = `life-change-tracker ${direction}`;
      trackerNode.classList.toggle("visible", Boolean(tracker?.visible && tracker.amount));
      const trackerFlashId = tracker?.flashId || 0;
      const shouldFlashTracker = Boolean(tracker?.flash && tracker.renderedFlashId !== trackerFlashId);
      trackerNode.classList.toggle("flash", shouldFlashTracker);
      if (shouldFlashTracker) {
        tracker.renderedFlashId = trackerFlashId;
      }
      trackerNode.textContent = direction === "gain" ? `+${tracker?.amount || 0}` : `-${tracker?.amount || 0}`;
      button.appendChild(trackerNode);
      bindLifeButton(button, player);
    });

    const commanderDamageButton = node.querySelector("[data-action='commander-damage']");
    const highestCommanderDamage = getHighestCommanderDamage(player);
    commanderDamageButton.textContent = highestCommanderDamage
      ? `Commander Damage (${highestCommanderDamage})`
      : "Commander Damage";
    commanderDamageButton.classList.toggle("has-damage", highestCommanderDamage > 0);
    commanderDamageButton.addEventListener("click", () => openCommanderDamagePanel(player));

    const counterGrid = node.querySelector(".counter-grid");
    getVisibleCounters(player).forEach((counter) => {
      counterGrid.appendChild(buildCounter(counter, player));
    });

    const counterOptions = node.querySelector(".counter-options");
    counterOptions.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    counterTypes.forEach((counter) => {
      counterOptions.appendChild(buildCounterOption(counter, player));
    });

    const counterPicker = node.querySelector(".counter-picker");
    counterPicker.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    counterPicker.open = Boolean(player.counterPickerOpen);
    if (counterPicker.open) {
      window.requestAnimationFrame(() => positionCounterMenu(counterPicker));
    }
    counterPicker.addEventListener("toggle", () => {
      player.counterPickerOpen = counterPicker.open;
      if (!counterPicker.open) {
        return;
      }

      document.querySelectorAll(".counter-picker[open]").forEach((openPicker) => {
        if (openPicker !== counterPicker) {
          openPicker.open = false;
        }
      });
      state.players.forEach((otherPlayer) => {
        if (otherPlayer !== player) {
          otherPlayer.counterPickerOpen = false;
        }
      });
      window.requestAnimationFrame(() => positionCounterMenu(counterPicker));
    });

    node.querySelectorAll("[data-counter]").forEach((button) => {
      button.addEventListener("click", () => {
        changeCounter(player, button.dataset.counter, Number(button.dataset.counterDelta));
      });
    });

    node.querySelector("[data-action='color']").addEventListener("click", () => {
      player.colorIndex = (player.colorIndex + 1) % colors.length;
      render();
    });

    board.appendChild(node);
  });

  window.requestAnimationFrame(() => {
    fitPlayerCardsToContent();
    positionOpenCounterMenus();
    window.setTimeout(() => {
      fitPlayerCardsToContent();
      positionOpenCounterMenus();
    }, 60);
  });
}

function flashResultBox(display, output) {
  output.classList.remove("result-flash");
  display.classList.remove("result-flash");
  void output.offsetWidth;
  void display.offsetWidth;
  output.classList.add("result-flash");
  display.classList.add("result-flash");
}

function animateRoll(kind) {
  if (state.rolling) {
    return;
  }

  state.rolling = true;
  const isCoin = kind === "coin";
  const sides = isCoin ? 2 : Number(kind);
  const labels = isCoin ? ["Heads", "Tails"] : null;
  let ticks = 0;

  rollResult.classList.remove("result-flash");
  rollDisplay.classList.remove("rolling", "flipping", "result-flash");
  void rollDisplay.offsetWidth;
  rollDisplay.classList.add(isCoin ? "flipping" : "rolling");

  const interval = window.setInterval(() => {
    ticks += 1;
    const value = Math.floor(Math.random() * sides);
    rollResult.value = isCoin ? labels[value] : value + 1;

    if (ticks >= 14) {
      window.clearInterval(interval);
      const finalValue = Math.floor(Math.random() * sides);
      const result = isCoin ? labels[finalValue] : finalValue + 1;
      rollResult.value = result;
      flashResultBox(rollDisplay, rollResult);
      rollDisplay.classList.remove("rolling", "flipping");
      state.rolling = false;
      tableMessage.value = isCoin ? `Coin flip: ${result}.` : `D${sides} rolled ${result}.`;
      logHistoryEntry({
        type: "roll",
        kind: isCoin ? "coin" : "die",
        sides,
        result,
      });
    }
  }, 70);
}

function animateRandomPlayer() {
  if (state.randomRolling) {
    return;
  }

  const eligiblePlayers = state.players.filter((player) => !player.isDead);
  const playerPool = eligiblePlayers.length ? eligiblePlayers : state.players;
  if (!playerPool.length) {
    randomResult.value = "-";
    tableMessage.value = "No players available to select.";
    return;
  }

  state.randomRolling = true;
  let ticks = 0;

  randomResult.classList.remove("result-flash");
  randomDisplay.classList.remove("rolling", "flipping", "result-flash");
  void randomDisplay.offsetWidth;
  randomDisplay.classList.add("rolling");
  tableMessage.value = "Selecting a random player...";

  const interval = window.setInterval(() => {
    ticks += 1;
    const currentPreviewEligible = state.players.filter((player) => !player.isDead);
    const currentPreviewPool = currentPreviewEligible.length ? currentPreviewEligible : state.players;
    const previewPool = currentPreviewPool.length ? currentPreviewPool : playerPool;
    const previewPlayer = previewPool[Math.floor(Math.random() * previewPool.length)];
    randomResult.value = previewPlayer.name;

    if (ticks >= 14) {
      window.clearInterval(interval);
      const currentEligible = state.players.filter((candidate) => !candidate.isDead);
      const currentPool = currentEligible.length ? currentEligible : state.players;
      if (!currentPool.length) {
        randomResult.value = "-";
        randomDisplay.classList.remove("rolling", "flipping");
        state.randomRolling = false;
        tableMessage.value = "No players available to select.";
        return;
      }

      const player = currentPool[Math.floor(Math.random() * currentPool.length)];
      randomResult.value = player.name;
      flashResultBox(randomDisplay, randomResult);
      randomDisplay.classList.remove("rolling", "flipping");
      state.randomRolling = false;
      tableMessage.value = `Random player: ${player.name}.`;
      logHistoryEntry({
        type: "random",
        playerName: player.name,
        seat: getPlayerSeat(player),
        poolSize: currentPool.length,
      });
    }
  }, 70);
}

document.querySelectorAll("[data-players]").forEach((button) => {
  button.addEventListener("click", () => setPlayerCount(Number(button.dataset.players)));
});

document.querySelectorAll("[data-layout]").forEach((button) => {
  button.addEventListener("click", () => {
    state.layout = button.dataset.layout;
    updateLayoutButtons();
    render();
  });
});

document.querySelectorAll("[data-start-life]").forEach((button) => {
  button.addEventListener("click", () => {
    const next = Math.max(1, Math.min(999, Number(startLifeInput.value || 1) + Number(button.dataset.startLife)));
    startLifeInput.value = next;
    state.startingLife = next;
    updateModeButtons();
  });
});

document.querySelectorAll("[data-mode-life]").forEach((button) => {
  button.addEventListener("click", () => {
    state.startingLife = Number(button.dataset.modeLife);
    startLifeInput.value = state.startingLife;
    updateModeButtons();
    resetGame();
  });
});

document.querySelectorAll("[data-roll]").forEach((button) => {
  button.addEventListener("click", () => animateRoll(button.dataset.roll));
});

turnTrackingEnabledInput?.addEventListener("change", () => {
  state.turnTrackingEnabled = turnTrackingEnabledInput.checked;
  updateTurnTrackerUi();
  tableMessage.value = state.turnTrackingEnabled ? "Turn tracking enabled." : "Turn tracking disabled.";
});

turnDownButton?.addEventListener("click", () => updateTurnCycle(-1));
turnUpButton?.addEventListener("click", () => updateTurnCycle(1));

rulesSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = rulesQueryInput.value.trim();
  if (selectedRuleSuggestion) {
    tableMessage.value = selectedRuleSuggestion.text;
    hideRulesSuggestions();
    return;
  }

  if (!query) {
    window.open(officialRulesTextUrl, "_blank", "noopener");
    return;
  }

  tableMessage.value = `Searching official Comprehensive Rules for "${query}"...`;
  updateRulesSuggestions();
});

rulesQueryInput.addEventListener("input", updateRulesSuggestions);
rulesQueryInput.addEventListener("focus", updateRulesSuggestions);
rulesQueryInput.addEventListener("blur", () => {
  window.setTimeout(hideRulesSuggestions, 160);
});

startLifeInput.addEventListener("input", () => {
  state.startingLife = Math.max(1, Math.min(999, Number(startLifeInput.value || 1)));
  updateModeButtons();
});

document.querySelector("#resetButton").addEventListener("click", resetGame);

historyButton?.addEventListener("click", () => {
  renderHistory();
  historyModal.showModal();
});

closeHistoryModal?.addEventListener("click", () => historyModal.close());
historyModal?.addEventListener("click", (event) => {
  if (event.target === historyModal) {
    historyModal.close();
  }
});

copyHistoryButton?.addEventListener("click", copyHistoryLog);

clearHistoryButton?.addEventListener("click", () => {
  state.history = [];
  state.historySequence = 0;
  updateHistoryCount();
  renderHistory();
  tableMessage.value = "Table log cleared.";
});

undoButton?.addEventListener("click", undoLastBoardAction);

// QA 2026-07-02 G6.41: the dark/light theme toggle is retired — the default
// Midnight Azure theme is permanent. (#themeButton no longer exists in index.html.)

document.querySelector("#randomButton").addEventListener("click", animateRandomPlayer);

pageTabs.forEach((button) => {
  button.addEventListener("click", () => setActivePage(button.dataset.pageTarget));
});

window.addEventListener("scroll", (e) => {
  if (e.target && e.target.closest && e.target.closest("#globalSuggestions")) return;  // scrolling inside the suggestions list shouldn't close it
  hideSuggestions();
  hideRulesSuggestions();
  positionOpenCounterMenus();
}, true);
window.addEventListener("resize", () => {
  hideSuggestions();
  hideRulesSuggestions();
  positionOpenCounterMenus();
  fitPlayerCardsToContent();
});
window.addEventListener("pointerdown", (event) => closeCounterMenusOutside(event.target));
window.addEventListener("pointerup", () => {
  stopLifeHold(true);
  stopCommanderDamageHold(true);
});
window.addEventListener("pointercancel", () => {
  stopLifeHold(false);
  stopCommanderDamageHold(false);
});
window.addEventListener("blur", () => {
  stopLifeHold(false);
  stopCommanderDamageHold(false);
});

closeModalButton.addEventListener("click", () => cardModal.close());
cardModal.addEventListener("close", () => {
  stopCommanderDamageHold(false);
  state.activeCommanderDamagePlayerId = "";
  modalGrid.className = "modal-grid";
});
cardModal.addEventListener("click", (event) => {
  if (event.target === cardModal) {
    cardModal.close();
  }
});

async function importDeckDetailToPlayer(deck, player) {
  if (!deck || !player) {
    return;
  }

  setActivePage("life");
  const cards = Array.isArray(deck.cards) ? deck.cards : [];
  player.deckInput = deck.deckText || cards.map((card) => `${card.quantity || 1} ${card.name}`).join("\n");
  tableMessage.value = `Importing ${deck.name || "deck"} to ${player.name}...`;

  try {
    await applyImportedDeck(player, cards, deck.name || "deck builder");
    if (deck.commanderName && deck.commanderArtUrl) {
      setCommanderForPlayer(player, deck.commanderName, deck.commanderArtUrl, { keepDeckInput: true });
    }
    tableMessage.value = `${deck.name || "Deck"} is ready on ${player.name}.`;
    render();
  } catch (error) {
    tableMessage.value = "Could not import that deck to the table.";
    render();
  }
}

function buildTableImportPlayerTile(deck, player, index) {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "table-import-player";
  tile.style.setProperty("--owner-color", player.artColor || colors[player.colorIndex] || "var(--accent)");
  tile.setAttribute("aria-label", `Import ${deck.name || "deck"} to ${player.name}`);

  const imageWrap = document.createElement("span");
  imageWrap.className = "table-import-player-art";
  const imageUrl = player.backgroundUrl || deck.commanderArtUrl || "";
  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = player.name;
    image.loading = "lazy";
    imageWrap.appendChild(image);
  } else {
    imageWrap.textContent = String(index + 1);
  }

  const copy = document.createElement("span");
  copy.className = "table-import-player-copy";
  const name = document.createElement("strong");
  name.textContent = player.name;
  const detail = document.createElement("small");
  detail.textContent = `Seat ${index + 1} | ${player.life} life`;
  copy.append(name, detail);

  const action = document.createElement("span");
  action.className = "table-import-player-action";
  action.textContent = "Import here";

  tile.append(imageWrap, copy, action);
  tile.addEventListener("click", () => {
    cardModal.close();
    importDeckDetailToPlayer(deck, player);
  });
  return tile;
}

function openTableImportPicker(deck) {
  ensurePlayerIds();
  const cards = Array.isArray(deck.cards) ? deck.cards : [];
  if (!cards.length) {
    tableMessage.value = "Add cards before importing a deck to the table.";
    return;
  }

  setActivePage("life");
  showModal(`Import ${deck.name || "deck"} to table`);
  cardPreview.hidden = true;
  cardPreview.className = "card-preview";
  cardPreview.innerHTML = "";
  modalGrid.innerHTML = "";
  modalGrid.className = "modal-grid table-import-grid";

  const intro = document.createElement("p");
  intro.className = "modal-note table-import-note";
  intro.textContent = "Choose which player card should receive this deck, commander art, and smart counters.";
  modalGrid.appendChild(intro);

  state.players.forEach((player, index) => {
    modalGrid.appendChild(buildTableImportPlayerTile(deck, player, index));
  });
}

window.addEventListener("mtg-deck-import-request", (event) => {
  openTableImportPicker(event.detail || {});
});

window.addEventListener("mtg-deck-import", (event) => {
  openTableImportPicker(event.detail || {});
});

window.addEventListener("mtg-deck-library-updated", refreshSavedDeckSelects);
window.addEventListener("storage", (event) => {
  if (event.key === savedDeckStorageKey) {
    refreshSavedDeckSelects();
  }
});

updateLayoutButtons();
// Route a hash to the right view. The virtual tabletop ("table"/"play") is entered via its own
// button (not a .page-panel); everything else is a normal page. Also closes the full-screen
// tabletop overlay and clears the Play tab's active state when navigating away.
function routeToHash(p) {
  if (p === "table" || p === "play") { document.getElementById("playTabButton")?.click(); return; }
  if (document.body.classList.contains("play-fs")) {
    try { window.MTGPlayShell?.close?.(); } catch (e) {}
    document.body.classList.remove("play-fs");
  }
  const playBtn = document.getElementById("playTabButton");
  if (playBtn) { playBtn.classList.remove("active"); playBtn.removeAttribute("aria-current"); }
  if (VALID_PAGES.includes(p)) setActivePage(p, false);
}
setActivePage(window.location.hash.replace("#", ""), false); // immediate panel activation (no flash)
window.addEventListener("hashchange", () => routeToHash((window.location.hash || "").replace(/^#/, "")));
// After every module script has registered its listeners, re-route the initial hash so a deep-linked
// tabletop (#table) enters Play and a deep-linked service page (ranked/profile/tournaments/watch) renders.
window.addEventListener("load", () => {
  const p = (window.location.hash || "").replace(/^#/, "");
  if (p === "table" || p === "play" || ["ranked", "profile", "tournaments", "watch"].includes(p)) routeToHash(p);
});
resetGame();
window.mtgSync?.init?.().then((result) => {
  if (result?.message) {
    tableMessage.value = result.message;
  }
}).catch(() => {
  tableMessage.value = "Sync unavailable; running local table mode.";
});
