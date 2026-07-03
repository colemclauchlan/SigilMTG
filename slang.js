/*
 * slang.js — the "Slang & Archetypes" helper popup. Same self-contained pattern as keywords.js and reuses
 * the .keyword-* styles. Wires #slangButton -> #slangModal with a searchable, color-coded glossary of
 * Magic slang, deck archetypes, Commander/EDH terms, formats, and deckbuilding jargon.
 */
(function () {
  "use strict";

  var CATS = {
    archetype: { label: "Archetype", color: "#c94f4f" },
    slang: { label: "Slang", color: "#4f8cc9" },
    play: { label: "In-game", color: "#2fb8a8" },
    edh: { label: "Commander / EDH", color: "#d5a23a" },
    build: { label: "Deckbuilding", color: "#5aa66a" },
    format: { label: "Format", color: "#9867c5" },
  };

  // name, category, explanation
  var ITEMS = [
    // --- Deck archetypes ---
    ["Aggro", "archetype", "Aggressive decks that win fast with cheap creatures and burn before opponents stabilize."],
    ["Control", "archetype", "Decks that answer everything (removal, counters, wraths) and win late with a few finishers."],
    ["Midrange", "archetype", "A balance of aggro and control — efficient threats plus removal, grinding out card advantage."],
    ["Combo", "archetype", "Decks built to assemble a specific card combination that wins the game on the spot."],
    ["Tempo", "archetype", "Cheap threats backed by bounce/counters to stay ahead on board while denying the opponent."],
    ["Ramp", "archetype", "Accelerates mana (dorks, rocks, lands) to cast huge spells ahead of schedule."],
    ["Aristocrats", "archetype", "Sacrifices its own creatures for value, draining life and triggering death payoffs."],
    ["Voltron", "archetype", "Loads one creature (often the commander) with auras/equipment to win via combat or commander damage."],
    ["Stax", "archetype", "Resource denial — taxes, locks, and prison pieces that slow everyone else to a crawl."],
    ["Tokens / Go-wide", "archetype", "Floods the board with creature tokens, then buffs them with anthems for a big swing."],
    ["Tribal / Typal", "archetype", "Built around one creature type (Elves, Goblins, Dragons…) with payoffs that reward it."],
    ["Reanimator", "archetype", "Dumps big creatures into the graveyard, then cheats them onto the battlefield."],
    ["Storm", "archetype", "Casts many spells in one turn to fuel a game-ending Storm payoff."],
    ["Mill", "archetype", "Wins by emptying opponents' libraries instead of attacking their life total."],
    ["Superfriends", "archetype", "A planeswalker-centric deck that grinds value and ults to take over the game."],
    ["Landfall", "archetype", "Rewards playing extra lands each turn with damage, tokens, or growth."],
    ["Spellslinger", "archetype", "Instants/sorceries matter — prowess, magecraft, and burn fuel the win."],
    ["Blink / Flicker", "archetype", "Repeatedly exiles and returns its own creatures to re-use enter-the-battlefield effects."],
    ["Group Hug", "archetype", "An EDH deck that gives everyone resources, steering the game (and goodwill) its way."],
    ["Pillow Fort", "archetype", "Defensive EDH deck that makes itself hard to attack, then wins slowly and safely."],
    ["Hatebears", "archetype", "Small efficient creatures that each tax or disrupt the opponent's plan."],
    ["Burn", "archetype", "Aims all its damage at the opponent's face with cheap direct-damage spells."],

    // --- General slang ---
    ["Bolt", "slang", "Lightning Bolt; also a unit of measure — “bolt the bird” = deal 3 damage. A “bolt test” = survives 3."],
    ["Wrath / Board wipe", "slang", "A sweeper that destroys all (or most) creatures — named after Wrath of God."],
    ["Mana screw", "slang", "Drawing too few lands to cast your spells."],
    ["Mana flood", "slang", "Drawing too many lands and not enough action."],
    ["Topdeck", "slang", "Drawing exactly the card you needed off the top of your library."],
    ["Bomb", "slang", "A single card powerful enough to win the game on its own, especially in Limited."],
    ["Blowout", "slang", "A play that gains huge value or a 2-for-1+, often via an instant in combat."],
    ["Two-for-one", "slang", "Trading one card to deal with two of the opponent's — card advantage."],
    ["Value", "slang", "Incremental card/board advantage accumulated over time ('grinding value')."],
    ["Brick / Whiff", "slang", "A draw or reveal that does nothing useful (a 'blank')."],
    ["Fizzle", "slang", "A spell that does nothing because all its targets became illegal."],
    ["Durdle", "slang", "To play slowly doing low-impact things instead of advancing a real plan."],
    ["Punt", "slang", "To lose a winning game through a misplay."],
    ["Netdeck", "slang", "To copy a known successful decklist from the internet rather than brewing your own."],
    ["Brew", "slang", "A homemade, non-netdecked list — and the act of building one."],
    ["Goldfish", "slang", "Practicing a deck with no opponent to see how fast it 'goes off'."],
    ["Salt", "slang", "Frustration/bitterness after a bad beat; 'salty' cards are ones people hate to face."],
    ["Scoop", "slang", "To concede — literally scooping up your cards."],

    // --- In-game play ---
    ["Curve / Curving out", "play", "Casting a spell at every mana value on successive turns for a smooth start."],
    ["Tempo (in play)", "play", "Efficiency of mana-vs-board — gaining tempo means doing more per turn than your opponent."],
    ["Chump block", "play", "Blocking with a creature you expect to die, just to absorb damage."],
    ["Alpha strike", "play", "Attacking with your entire board at once, usually for lethal."],
    ["Race", "play", "Both players ignore defense and try to deal lethal first."],
    ["Tap out", "play", "Using all your mana, leaving none for instants on the opponent's turn."],
    ["Cantrip", "play", "A cheap spell that replaces itself by drawing a card ('+1 card')."],
    ["Tutor", "play", "An effect that searches your library for a specific card."],
    ["Removal / Interaction", "play", "Cards that kill, exile, bounce, or counter what the opponent is doing."],
    ["Bounce", "play", "Returning a permanent to its owner's hand."],
    ["ETB / EOT", "play", "“Enters the battlefield” trigger / “end of turn” (a common timing for effects)."],
    ["Mana dork / Mana rock", "play", "A creature (dork) or artifact (rock) that taps for mana to ramp."],
    ["Fatty", "play", "A big, expensive creature."],
    ["Vanilla / French vanilla", "play", "A creature with no abilities (vanilla) or only keyword abilities (French vanilla)."],

    // --- Commander / EDH ---
    ["Commander tax", "edh", "Each time you recast your commander from the command zone it costs {2} more."],
    ["Command zone", "edh", "The special zone your commander (and companions) live in outside the game."],
    ["Color identity", "edh", "All colors in a card's cost AND rules text — every card must fit your commander's identity."],
    ["Commander damage", "edh", "21 combat damage from a single commander eliminates a player, separate from life total."],
    ["Pod", "edh", "A Commander playgroup/table (usually four players)."],
    ["Precon", "edh", "A preconstructed, ready-to-play deck sold by Wizards."],
    ["Rule 0", "edh", "The pre-game talk where a table agrees on power level, house rules, and what's off-limits."],
    ["Power level / Bracket", "edh", "Roughly how strong/fast a deck is — from casual battlecruiser up to cEDH."],
    ["cEDH", "edh", "Competitive EDH — the highest-power, fastest, most optimized Commander metagame."],
    ["Politics", "edh", "Multiplayer deal-making, threats, and persuasion to steer the table."],
    ["Kingmaking", "edh", "When a losing player decides which of the others wins."],
    ["Staples", "edh", "Cards so efficient they show up in most decks of their colors (Sol Ring, Swords, etc.)."],

    // --- Deckbuilding ---
    ["Mana base", "build", "The lands (and fixing) that produce your colors of mana."],
    ["Fixing", "build", "Lands/rocks that produce off-color mana to cast a 'splash'."],
    ["Splash", "build", "Including a small amount of an extra color for a few powerful cards."],
    ["Mana curve", "build", "The distribution of your deck's mana values — you want a smooth, low-ish curve."],
    ["Sideboard", "build", "The 15 cards you swap in between games to adjust to the matchup (not used in EDH)."],
    ["Sleeve / Cut", "build", "Protecting cards in sleeves; cutting = the opponent splitting your shuffled deck."],

    // --- Formats ---
    ["Standard", "format", "Rotating Constructed format using only the most recent sets."],
    ["Modern", "format", "Non-rotating Constructed from 8th Edition / Mirrodin onward."],
    ["Legacy / Vintage", "format", "Eternal formats allowing almost all cards (Vintage restricts the most broken to one copy)."],
    ["Pauper", "format", "Constructed using only cards printed at common rarity."],
    ["Commander / EDH", "format", "100-card singleton multiplayer format led by a legendary commander; 40 life."],
    ["Limited (Draft / Sealed)", "format", "Build a deck on the spot from freshly opened packs."],
    ["Cube", "format", "A curated, reusable pool of cards drafted for high-power Limited."],
  ];

  function build() {
    var btn = document.getElementById("slangButton");
    var modal = document.getElementById("slangModal");
    var list = document.getElementById("slangList");
    var search = document.getElementById("slangSearch");
    var close = document.getElementById("closeSlangModal");
    if (!btn || !modal || !list) return;

    function render(filter) {
      filter = (filter || "").trim().toLowerCase();
      list.innerHTML = "";
      var shown = 0;
      ITEMS.slice().sort(function (a, b) { return a[0].localeCompare(b[0]); }).forEach(function (it) {
        var name = it[0], cat = CATS[it[1]] || CATS.slang, text = it[2];
        if (filter && name.toLowerCase().indexOf(filter) < 0 && text.toLowerCase().indexOf(filter) < 0 && cat.label.toLowerCase().indexOf(filter) < 0) return;
        shown++;
        var row = document.createElement("div");
        row.className = "keyword-row";
        row.style.setProperty("--kw-color", cat.color);
        var head = document.createElement("div"); head.className = "keyword-head";
        var dot = document.createElement("span"); dot.className = "keyword-dot";
        var nm = document.createElement("strong"); nm.className = "keyword-name"; nm.textContent = name;
        var tag = document.createElement("span"); tag.className = "keyword-tag"; tag.textContent = cat.label;
        head.append(dot, nm, tag);
        var desc = document.createElement("p"); desc.className = "keyword-desc"; desc.textContent = text;
        row.append(head, desc);
        list.appendChild(row);
      });
      if (!shown) {
        var none = document.createElement("p"); none.className = "keyword-desc"; none.style.opacity = "0.7";
        none.textContent = "Nothing matches “" + filter + "”.";
        list.appendChild(none);
      }
    }

    btn.addEventListener("click", function () {
      render(search ? search.value : "");
      if (typeof modal.showModal === "function") modal.showModal();
    });
    if (close) close.addEventListener("click", function () { modal.close(); });
    if (search) search.addEventListener("input", function () { render(search.value); });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.close(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
