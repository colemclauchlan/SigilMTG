/*
 * keywords.js — the "Keywords" helper popup on the life tracker. Self-contained: defines the keyword
 * reference data and wires the #keywordsButton -> #keywordModal. Kept separate from app.js so it can never
 * break the life counter. Keywords are grouped/color-coded by category, each with a plain explanation.
 */
(function () {
  "use strict";

  // category -> accent color (used for the colored dot + left border)
  var CATS = {
    evergreen: { label: "Evergreen", color: "#5aa66a" },
    evasion: { label: "Evasion", color: "#4f8cc9" },
    combat: { label: "Combat", color: "#c94f4f" },
    cost: { label: "Cost / casting", color: "#9867c5" },
    action: { label: "Keyword action", color: "#2fb8a8" },
    counter: { label: "Counters", color: "#d5ae5d" },
    zone: { label: "Graveyard / zones", color: "#d178b0" },
    game: { label: "Game / designation", color: "#d5a23a" },
  };

  // name, category, explanation
  var KEYWORDS = [
    // --- Evergreen ---
    ["Deathtouch", "evergreen", "Any amount of damage this deals to a creature is enough to destroy it."],
    ["Defender", "evergreen", "This creature can't attack."],
    ["Double strike", "combat", "Deals combat damage twice — once in a first-strike step, once in the regular step."],
    ["Enchant", "evergreen", "An Aura with “enchant [X]” can only be attached to something matching [X]."],
    ["Equip", "evergreen", "Pay the equip cost (sorcery speed) to attach this Equipment to a creature you control."],
    ["First strike", "combat", "Deals its combat damage before creatures without first strike."],
    ["Flash", "cost", "You may cast this any time you could cast an instant."],
    ["Flying", "evasion", "Can only be blocked by creatures with flying or reach."],
    ["Haste", "evergreen", "Can attack and use tap abilities the turn it comes under your control (no summoning sickness)."],
    ["Hexproof", "evergreen", "Can't be the target of spells or abilities your opponents control."],
    ["Indestructible", "evergreen", "Can't be destroyed by lethal damage or by “destroy” effects."],
    ["Lifelink", "evergreen", "Damage this deals also causes its controller to gain that much life."],
    ["Menace", "evasion", "Can't be blocked except by two or more creatures."],
    ["Protection", "evergreen", "Can't be Damaged, Enchanted/Equipped, Blocked, or Targeted by the named quality (“DEBT”)."],
    ["Reach", "evergreen", "Can block creatures with flying."],
    ["Trample", "evergreen", "Excess combat damage over a blocker's toughness is dealt to the defending player or planeswalker."],
    ["Vigilance", "evergreen", "Attacking doesn't cause this creature to tap."],
    ["Ward", "evergreen", "When this becomes the target of an opponent's spell/ability, counter it unless they pay the ward cost."],
    ["Shroud", "evergreen", "Can't be the target of any spells or abilities (not even yours)."],
    ["Crew", "game", "Tap any number of creatures with total power N or more to turn this Vehicle into an artifact creature."],
    ["Reconfigure", "cost", "Attach this Equipment creature to a creature you control, or unattach it; it's a creature while unattached."],

    // --- Evasion (extra) ---
    ["Fear", "evasion", "Can't be blocked except by artifact and/or black creatures."],
    ["Intimidate", "evasion", "Can't be blocked except by artifact creatures and creatures that share a color with it."],
    ["Skulk", "evasion", "Can't be blocked by creatures with greater power."],
    ["Shadow", "evasion", "Can only block or be blocked by other creatures with shadow."],
    ["Horsemanship", "evasion", "Can only be blocked by creatures with horsemanship."],

    // --- Combat ---
    ["Banding", "combat", "Lets creatures attack/block as a group; the band's controller assigns combat damage."],
    ["Flanking", "combat", "Blocking creatures without flanking get -1/-1 until end of turn."],
    ["Rampage N", "combat", "Gets +N/+N for each blocker beyond the first."],
    ["Annihilator N", "combat", "When this attacks, the defending player sacrifices N permanents."],
    ["Exalted", "combat", "Whenever a creature attacks alone, it gets +1/+1 until end of turn for each exalted instance."],
    ["Battle cry", "combat", "When this attacks, each other attacking creature gets +1/+0 until end of turn."],
    ["Mentor", "combat", "When this attacks, put a +1/+1 counter on a target attacking creature with lesser power."],
    ["Afflict N", "combat", "Whenever this becomes blocked, the defending player loses N life."],
    ["Melee", "combat", "Gets +1/+1 for each opponent you attacked this combat."],

    // --- Damage variants ---
    ["Infect", "combat", "Deals damage to creatures as -1/-1 counters and to players as poison counters."],
    ["Wither", "combat", "Deals damage to creatures as -1/-1 counters."],

    // --- Keyword actions ---
    ["Scry N", "action", "Look at the top N cards of your library; put any number on the bottom, the rest back on top in any order."],
    ["Surveil N", "action", "Look at the top N cards; put any number into your graveyard, the rest back on top in any order."],
    ["Fight", "action", "Two creatures each deal damage equal to their power to the other."],
    ["Explore", "action", "Reveal the top card; if it's a land put it in hand, else put a +1/+1 counter on this and keep or bin the card."],
    ["Proliferate", "counter", "Choose any number of permanents/players with a counter and give each another of each kind they already have."],
    ["Populate", "action", "Create a token copy of a creature token you control."],
    ["Investigate", "action", "Create a Clue token (“{2}, Sacrifice this: Draw a card”)."],
    ["Amass N", "counter", "Put N +1/+1 counters on an Army you control, creating a 0/0 Zombie Army first if you have none."],
    ["Connive N", "zone", "Draw N, then discard N; put a +1/+1 counter on this for each nonland card discarded this way."],
    ["Goad", "game", "The goaded creature must attack each combat if able, and must attack a player other than you."],
    ["Mill N", "zone", "Put the top N cards of a library into its owner's graveyard."],
    ["Manifest", "zone", "Put the top card face down as a 2/2; you may turn it face up any time if it's a creature card by paying its cost."],
    ["Bolster N", "counter", "Put N +1/+1 counters on the creature you control with the least toughness."],
    ["Venture into the dungeon", "game", "Enter the next room of a dungeon (or the first if you're not in one), getting its effect."],

    // --- Cost / casting ---
    ["Flashback", "cost", "Cast this from your graveyard for its flashback cost, then exile it."],
    ["Kicker", "cost", "An optional additional cost; if paid, the spell gets a bonus effect."],
    ["Multikicker", "cost", "Kicker you may pay any number of times, scaling the bonus."],
    ["Buyback", "cost", "Pay the extra buyback cost to return this spell to your hand instead of the graveyard as it resolves."],
    ["Convoke", "cost", "Tap creatures while casting this; each pays {1} or one mana of that creature's color."],
    ["Improvise", "cost", "Tap artifacts while casting this; each pays {1}."],
    ["Delve", "cost", "Exile cards from your graveyard while casting this; each pays {1}."],
    ["Escape", "cost", "Cast this from your graveyard by paying its escape cost and exiling other cards from your graveyard."],
    ["Foretell", "cost", "On your turn, pay {2} to exile this face down; cast it later for its foretell cost."],
    ["Suspend N", "cost", "Exile with N time counters; remove one each upkeep, then cast it free with haste when the last is gone."],
    ["Cycling", "cost", "Pay the cycling cost and discard this card to draw a card."],
    ["Madness", "cost", "If you discard this, you may cast it for its madness cost instead of putting it in the graveyard."],
    ["Overload", "cost", "Pay the overload cost to have the spell affect all legal targets instead of one."],
    ["Bestow", "cost", "Cast this as an Aura for its bestow cost; it becomes a creature again if its host leaves."],
    ["Dash", "cost", "Cast for the dash cost to give it haste; return it to hand at the next end step."],
    ["Evoke", "cost", "Cast for the evoke cost, then sacrifice it when it enters (still getting its enter trigger)."],
    ["Disturb", "cost", "Cast the back face from your graveyard for its disturb cost."],
    ["Prowl", "cost", "Pay the cheaper prowl cost if you dealt combat damage with the right creature type this turn."],

    // --- Triggered / spell mechanics ---
    ["Prowess", "combat", "Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn."],
    ["Cascade", "cost", "When you cast this, exile from the top of your library until a cheaper nonland; you may cast it free."],
    ["Storm", "cost", "When you cast this, copy it for each spell cast before it this turn."],
    ["Extort", "cost", "Whenever you cast a spell, you may pay {W/B} to drain each opponent 1 life."],
    ["Riot", "counter", "This enters with your choice of a +1/+1 counter or haste."],
    ["Undying", "counter", "When this dies, if it had no +1/+1 counters, return it with one."],
    ["Persist", "counter", "When this dies, if it had no -1/-1 counters, return it with one."],
    ["Modular N", "counter", "Enters with N +1/+1 counters; when it dies, move them to a target artifact creature."],
    ["Outlast", "counter", "{Cost}, {T}: put a +1/+1 counter on this. Sorcery speed only."],

    // --- Mechanics / structures ---
    ["Mutate", "game", "Cast for the mutate cost to merge with a non-Human creature; the top card's stats, all abilities."],
    ["Transform", "game", "Turn a double-faced permanent to its other face (e.g. werewolves at night)."],
    ["Meld", "game", "Specific card pairs combine into one oversized permanent."],
    ["Level up", "counter", "{Cost}: put a level counter on this; its stats/abilities improve at level thresholds."],
    ["Saga", "game", "An enchantment that gains a lore counter each turn and triggers its chapters in order."],
    ["Monarch", "game", "The monarch draws at their end step; deal combat damage to the monarch to become it."],
    ["The Ring tempts you", "game", "Choose a Ring-bearer and advance the Ring's temptation, granting it the next ability (up to 4)."],
    ["Companion", "game", "If your deck meets its condition, you may pay {3} once to put it from outside the game into your hand."],
    ["Partner", "game", "You may have two commanders if both have partner."],
    ["Day / Night", "game", "A global state; it becomes night if the active player cast no spells, day if they cast two or more."],
  ];

  function build() {
    var btn = document.getElementById("keywordsButton");
    var modal = document.getElementById("keywordModal");
    var list = document.getElementById("keywordList");
    var search = document.getElementById("keywordSearch");
    var close = document.getElementById("closeKeywordModal");
    if (!btn || !modal || !list) return;

    function render(filter) {
      filter = (filter || "").trim().toLowerCase();
      list.innerHTML = "";
      var shown = 0;
      KEYWORDS.slice().sort(function (a, b) { return a[0].localeCompare(b[0]); }).forEach(function (kw) {
        var name = kw[0], cat = CATS[kw[1]] || CATS.game, text = kw[2];
        if (filter && name.toLowerCase().indexOf(filter) < 0 && text.toLowerCase().indexOf(filter) < 0 && cat.label.toLowerCase().indexOf(filter) < 0) return;
        shown++;
        var row = document.createElement("div");
        row.className = "keyword-row";
        row.style.setProperty("--kw-color", cat.color);
        var head = document.createElement("div");
        head.className = "keyword-head";
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
        none.textContent = "No keywords match “" + filter + "”.";
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
