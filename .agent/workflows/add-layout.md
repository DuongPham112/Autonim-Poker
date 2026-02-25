---
description: How to add a new board layout to Autonim-Poker
---

# Adding a New Board Layout

When adding a new board layout to Autonim-Poker, follow these rules to ensure correct Z-ordering in After Effects export.

## Z-Order Rule

Every card place in `cardPlaces[]` **MUST** have a `zOrder` property for correct AE Z-positioning.

**Convention**: Higher `zOrder` = closer to camera = visually in **front**.

### Two options:

1. **Let `ensureZOrder()` auto-assign** (recommended for simple grids):
   - Define `row` and `col` on each place
   - Call `ensureZOrder(places)` after creating the array
   - Formula: `(row * maxCols) + col`
   - Upper rows get lower zOrder (behind), lower rows get higher (in front)

2. **Self-manage zOrder** (for complex layouts like Poker):
   - Assign `zOrder` explicitly in your layout function
   - `ensureZOrder()` will detect existing values and skip auto-assignment

## Required Fields per Card Place

```javascript
{
    id: 'place-0',     // Unique ID
    x: 640,            // UI X coordinate (1280x720 space)
    y: 360,            // UI Y coordinate
    col: 0,            // Column index (used for zOrder calc)
    row: 0,            // Row index (used for zOrder calc)
    rotation: 0,       // Rotation in degrees
    zOrder: 0,         // Z-order for AE layer stacking
    label: '1'         // Display label
}
```

## Example

```javascript
function loadMyLayout() {
    const places = [];
    // ... create places with row, col ...
    
    appState.boardLayout = {
        type: 'grid',
        name: 'My Layout',
        boardStyle: 'my-layout',
        gridCols: cols,
        gridRows: rows,
        cardPlaces: places
    };
    
    // Auto-assign zOrder based on row/col
    ensureZOrder(places);
    
    gameContainer.classList.add('grid-mode');
}
```

## Checklist

- [ ] Each place has `row`, `col`, `zOrder`
- [ ] Call `ensureZOrder()` or self-assign `zOrder`
- [ ] Register layout in `handleLoadPreset()` switch
- [ ] Test: Send to AE → upper rows behind, lower rows in front
- [ ] Test: Moving card lifts above all others during animation
