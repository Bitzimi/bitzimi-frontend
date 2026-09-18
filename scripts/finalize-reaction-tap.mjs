import fs from "node:fs";

const target = "src/app/pages/ReactionTapGameRoom.tsx";
const template = "scripts/templates/ReactionTapGameRoom.canonical.tsx";

if (!fs.existsSync(template)) throw new Error("Canonical Reaction Tap template is missing");
fs.copyFileSync(template, target);

console.log("Finalized canonical Reaction Tap implementation.");
