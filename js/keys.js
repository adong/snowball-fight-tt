/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "SnowbaTTle",
  cols: ["Player 1", "Player 2"],
  keys: [
    ["move", "W A S D", "↑ ← ↓ →"],
    ["throw (tap) · lob (hold)", "F", "J"],
    ["scoop snow (hold)", "G", "K"],
    ["special ⭐", "H", "L"],
    ["call your brother", "T", "Enter"],
    ["pause · sound", "P or Esc · M", ""],
  ],
  note: "In 1 player both sets of keys work.",
  touch: "The stick, ❄️ THROW, 🤲 SCOOP and ⭐ SPECIAL. Tap your brother's big face to call him.",
});
