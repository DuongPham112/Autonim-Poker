/**
 * Card Name Resolver - Fuzzy matching for card names
 * Handles multiple input formats and resolves to actual card objects
 *
 * Supported formats:
 *   - Full: "Ace of Spades", "King of Hearts"
 *   - Short EN: "As", "Ks", "10h", "Qd"
 *   - Short VN: "Ab", "Kb", "10c", "Qr" (r=rô, c=cơ, b=bích, t/n=tép)
 *   - Symbol: "A♠", "K♥", "10♦", "Q♣"
 *   - Snake: "ace_spades", "king_hearts" (passthrough)
 *   - Compact: "AceSpades", "KingHearts"
 *
 * Vietnamese suit shortcuts:
 *   r (rô) = diamonds, c (cơ) = hearts, b (bích) = spades, t/n (tép/nhép) = clubs
 * English suit shortcuts:
 *   d = diamonds, h = hearts, s = spades, cl = clubs
 * Note: 'c' maps to hearts (cơ), not clubs. Use 'cl', 't' or 'n' for clubs.
 * Jokers: Job = Joker Black, Jor = Joker Red
 */

// Rank aliases → canonical rank name
const RANK_MAP = {
    'a': 'ace', 'ace': 'ace', '1': 'ace',
    '2': '2', '3': '3', '4': '4', '5': '5',
    '6': '6', '7': '7', '8': '8', '9': '9',
    '10': '10', '0': '10',
    'j': 'jack', 'jack': 'jack',
    'q': 'queen', 'queen': 'queen',
    'k': 'king', 'king': 'king'
};

// Suit aliases → canonical suit name
// Vietnamese: r=rô(diamonds), c=cơ(hearts), b=bích(spades), t/n=tép/nhép(clubs)
// English: d=diamonds, h=hearts, s=spades
const SUIT_MAP = {
    // English
    's': 'spades', 'spades': 'spades', 'spade': 'spades',
    'h': 'hearts', 'hearts': 'hearts', 'heart': 'hearts',
    'd': 'diamonds', 'diamonds': 'diamonds', 'diamond': 'diamonds',
    'cl': 'clubs', 'clubs': 'clubs', 'club': 'clubs',
    // Vietnamese
    'b': 'spades', 'bích': 'spades', 'bich': 'spades',
    'c': 'hearts', 'cơ': 'hearts', 'co': 'hearts',
    'r': 'diamonds', 'rô': 'diamonds', 'ro': 'diamonds',
    't': 'clubs', 'n': 'clubs', 'tép': 'clubs', 'tep': 'clubs', 'nhép': 'clubs', 'nhep': 'clubs',
    // Symbols
    '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs'
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

    // 0. Joker aliases: job=Joker Black, jor=Joker Red
    const JOKER_MAP = {
        'job': 'joker_black', 'jokerblack': 'joker_black', 'joker_black': 'joker_black', 'blackjoker': 'joker_black',
        'jor': 'joker_red', 'jokerred': 'joker_red', 'joker_red': 'joker_red', 'redjoker': 'joker_red'
    };
    const jokerName = JOKER_MAP[normalized.replace(/[\s\-_]+/g, '')];
    if (jokerName) {
        const match = deckCards.find(c => c.name === jokerName || (c.name && c.name.toLowerCase().replace(/[\s\-_]+/g, '') === jokerName.replace(/_/g, '')));
        if (match) return match;
    }

    // 1. Direct match by baseName (snake_case) — fastest path
    let match = deckCards.find(c => c.name === normalized || c.name === input);
    if (match) return match;

    // 2. Try parsing the input into rank + suit
    const parsed = parseCardInput(normalized);
    if (parsed) {
        const targetBaseName = parsed.rank + '_' + parsed.suit;
        match = deckCards.find(c => c.name === targetBaseName);
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
            const bn = c.name || '';
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

    // Try short code with multi-char suit: "10cl", "Acl" (cl = clubs)
    const multiSuitMatch = clean.match(/^(\d{1,2}|[ajqk])(cl)$/i);
    if (multiSuitMatch) {
        const rank = RANK_MAP[multiSuitMatch[1].toLowerCase()];
        if (rank) return { rank, suit: 'clubs' };
    }

    // Try short code: "As", "Kb", "10c", "Qr", "2t"
    // Suit letters: s,h,d (EN) + r,c,b,t,n (VN)
    const shortMatch = clean.match(/^(\d{1,2}|[ajqk])([shdrcbtn])$/i);
    if (shortMatch) {
        const rank = RANK_MAP[shortMatch[1].toLowerCase()];
        const suit = SUIT_MAP[shortMatch[2].toLowerCase()];
        if (rank && suit) return { rank, suit };
    }

    // Try CamelCase: "AceSpades", "KingHearts", "AceBích", "KingCơ"
    const camelMatch = clean.match(/^(ace|king|queen|jack|\d{1,2})(spades?|hearts?|diamonds?|clubs?|bích|bich|cơ|co|rô|ro|tép|tep|nhép|nhep)$/i);
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
