/**
 * Card Name Resolver - Fuzzy matching for card names
 * Handles multiple input formats and resolves to actual card objects
 * 
 * Supported formats:
 *   - Full: "Ace of Spades", "King of Hearts"
 *   - Short: "As", "Ks", "10h", "Qd"
 *   - Symbol: "A♠", "K♥", "10♦", "Q♣"
 *   - Snake: "ace_spades", "king_hearts" (passthrough)
 *   - Compact: "AceSpades", "KingHearts"
 */

// Rank aliases → canonical rank name
const RANK_MAP = {
    'a': 'ace', 'ace': 'ace', '1': 'ace',
    '2': '2', '3': '3', '4': '4', '5': '5',
    '6': '6', '7': '7', '8': '8', '9': '9',
    '10': '10', 't': '10', '0': '10',
    'j': 'jack', 'jack': 'jack',
    'q': 'queen', 'queen': 'queen',
    'k': 'king', 'king': 'king'
};

// Suit aliases → canonical suit name
const SUIT_MAP = {
    's': 'spades', 'spades': 'spades', '♠': 'spades', 'spade': 'spades',
    'h': 'hearts', 'hearts': 'hearts', '♥': 'hearts', 'heart': 'hearts',
    'd': 'diamonds', 'diamonds': 'diamonds', '♦': 'diamonds', 'diamond': 'diamonds',
    'c': 'clubs', 'clubs': 'clubs', '♣': 'clubs', 'club': 'clubs'
};

/**
 * Resolve a card name string to a matching card from the deck
 * @param {string} input - Card name in any supported format
 * @param {Array} deckCards - Array of card objects from appState.cards
 * @returns {Object|null} Matched card object or null
 */
function resolveCardName(input, deckCards) {
    if (!input || !deckCards || deckCards.length === 0) return null;

    const normalized = input.trim().toLowerCase();

    // 1. Direct match by baseName (snake_case) — fastest path
    let match = deckCards.find(c => c.baseName === normalized || c.baseName === input);
    if (match) return match;

    // 2. Try parsing the input into rank + suit
    const parsed = parseCardInput(normalized);
    if (parsed) {
        const targetBaseName = parsed.rank + '_' + parsed.suit;
        match = deckCards.find(c => c.baseName === targetBaseName);
        if (match) return match;
    }

    // 3. Fuzzy: try matching displayName
    match = deckCards.find(c =>
        c.displayName && c.displayName.toLowerCase() === normalized
    );
    if (match) return match;

    // 4. Partial match — contains rank AND suit
    if (parsed) {
        match = deckCards.find(c => {
            const bn = c.baseName || '';
            return bn.includes(parsed.rank) && bn.includes(parsed.suit);
        });
        if (match) return match;
    }

    return null;
}

/**
 * Parse a card input string into {rank, suit}
 */
function parseCardInput(input) {
    // Remove common separators
    let clean = input.replace(/\s+of\s+/gi, '_').replace(/[\s\-]+/g, '_').trim();

    // Try "rank_suit" pattern (e.g. "ace_spades")
    let parts = clean.split('_');
    if (parts.length === 2) {
        const rank = RANK_MAP[parts[0]];
        const suit = SUIT_MAP[parts[1]];
        if (rank && suit) return { rank, suit };
    }

    // Try symbol patterns: "A♠", "10♥", "K♣"
    for (const [symbol, suitName] of Object.entries(SUIT_MAP)) {
        if (symbol.length === 1 && /[♠♥♦♣]/.test(symbol) && clean.includes(symbol)) {
            const rankPart = clean.replace(symbol, '').trim();
            const rank = RANK_MAP[rankPart];
            if (rank) return { rank, suit: suitName };
        }
    }

    // Try short code: "As", "Ks", "10h", "Qd", "2c"
    // Pattern: (rank chars)(suit char)
    const shortMatch = clean.match(/^(\d{1,2}|[ajqkt])([shdc])$/i);
    if (shortMatch) {
        const rank = RANK_MAP[shortMatch[1].toLowerCase()];
        const suit = SUIT_MAP[shortMatch[2].toLowerCase()];
        if (rank && suit) return { rank, suit };
    }

    // Try CamelCase: "AceSpades", "KingHearts"
    const camelMatch = clean.match(/^(ace|king|queen|jack|\d{1,2})(spades?|hearts?|diamonds?|clubs?)$/i);
    if (camelMatch) {
        const rank = RANK_MAP[camelMatch[1].toLowerCase()];
        const suit = SUIT_MAP[camelMatch[2].toLowerCase()];
        if (rank && suit) return { rank, suit };
    }

    return null;
}

// Make available globally (no ES modules in CEP)
window.resolveCardName = resolveCardName;
window.parseCardInput = parseCardInput;
