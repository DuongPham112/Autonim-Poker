const fs = require('fs');

const mainJsPath = 'client/js/main.js';
let mainJs = fs.readFileSync(mainJsPath, 'utf8');

// The marker for where the new loadPokerLayout ends
const newFuncEndMarker = "setStatus('Loaded Array layout (Bottom row)');\n}";
const newFuncEndIndex = mainJs.indexOf(newFuncEndMarker);

if (newFuncEndIndex === -1) {
    console.error("Could not find the end of the new loadPokerLayout.");
    process.exit(1);
}

// The clean slice from beginning to the end of the newly injected function
const cleanPrefix = mainJs.substring(0, newFuncEndIndex + newFuncEndMarker.length + 1);

const pusoyMarker = "function loadPusoyLayout() {";
const lastPusoyIndex = mainJs.lastIndexOf(pusoyMarker);

if (lastPusoyIndex === -1 || lastPusoyIndex < newFuncEndIndex) {
    console.error("Could not find the original loadPusoyLayout to append.");
    process.exit(1);
}

// Rewind backwards to capture its JSDoc comment if possible
let finalAppendIndex = lastPusoyIndex;
const commentMarker = "/**\n * Load Pusoy layout";
const lastCommentIndex = mainJs.lastIndexOf(commentMarker);
if (lastCommentIndex !== -1 && lastCommentIndex < lastPusoyIndex && lastCommentIndex > newFuncEndIndex) {
    finalAppendIndex = lastCommentIndex;
}

// The clean suffix
const cleanSuffix = "\n\n" + mainJs.substring(finalAppendIndex);

const finalMainJs = cleanPrefix + cleanSuffix;

fs.writeFileSync(mainJsPath, finalMainJs);
console.log("Cleaned up main.js successfully. Reduced size from " + mainJs.length + " to " + finalMainJs.length);
