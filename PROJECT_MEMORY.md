# Project Reference

Files: 40 | Entities: 729

## System Structure
```text
├── .claude
│   └── skills
│       └── frontend-design
│           └── scripts
│               ├── analyze-accessibility.ts
│               ├── analyze-styles.ts
│               ├── extract-tokens.ts
│               ├── generate-component.ts
│               ├── generate-palette.ts
│               ├── generate-tokens.ts
│               └── generate-typography.ts
├── .trae
│   └── skills
│       └── frontend-design
│           └── scripts
│               ├── analyze-accessibility.ts
│               ├── analyze-styles.ts
│               ├── extract-tokens.ts
│               ├── generate-component.ts
│               ├── generate-palette.ts
│               ├── generate-tokens.ts
│               └── generate-typography.ts
├── clean_main.js
├── client
│   ├── js
│   │   ├── main.js
│   │   ├── modules
│   │   │   ├── asset_manager.js
│   │   │   ├── auth.js
│   │   │   ├── board_tools.js
│   │   │   ├── bridge-server.js
│   │   │   ├── card_name_resolver.js
│   │   │   ├── index.js
│   │   │   ├── playback_controller.js
│   │   │   ├── script_loader.js
│   │   │   ├── slot_group_manager.js
│   │   │   ├── snapshot_manager.js
│   │   │   ├── step_property_manager.js
│   │   │   ├── timeline_manager.js
│   │   │   ├── timeline_ui.js
│   │   │   ├── transform_indicator.js
│   │   │   └── updater.js
│   │   ├── temp_block.js
│   │   └── utils
│   │       └── event_emitter.js
│   └── tools
│       └── deck-prepper
│           └── prepper.js
├── faq
│   └── script.js
├── fix_poker.js
├── generate_memory.js
├── host
│   └── index.jsx
├── lib
│   └── CSInterface.js
└── patch.js
```

## File Registry

| File | Exports/Entities |
| --- | --- |
| .claude/skills/frontend-design/scripts/analyze-accessibility.ts | `f() hexToRgb`, `f() getLuminance`, `f() getContrastRatio`, `f() getLineNumber`, `f() analyzeContent`, `f() analyzeColorContrast`, `f() generatePassedChecks`, `f() categoryIssues`, `f() hasErrors`, `f() calculateScore`, `f() analyzeAccessibility`, `f() errors`, `f() warnings`, `f() formatSummary`, `f() printHelp`, `f() main`, `f() hasErrors` |
| .claude/skills/frontend-design/scripts/analyze-styles.ts | `f() normalizeColor`, `f() suggestTokenName`, `f() parseCSS`, `f() analyzeColors`, `f() analyzeTypography`, `f() analyzeSpacing`, `f() findInconsistencies`, `f() hexColors`, `f() fontFamilies`, `f() areColorsSimilar`, `f() generateRecommendations`, `f() pixelSpacing`, `f() analyzeStyles`, `f() formatSummary`, `f() printHelp`, `f() main` |
| .claude/skills/frontend-design/scripts/extract-tokens.ts | `f() classifyToken`, `f() inferTokenType`, `f() extractCSSVariables`, `f() extractRepeatedValues`, `f() extractTokens`, `f() isTokenized`, `f() formatAsCSS`, `f() formatAsSCSS`, `f() formatAsTailwind`, `f() formatAsStyleDictionary`, `f() formatAsTokensStudio`, `f() formatOutput`, `f() printHelp`, `f() main` |
| .claude/skills/frontend-design/scripts/generate-component.ts | `f() getButtonTemplate`, `f() getCardTemplate`, `f() getInputTemplate`, `f() generateReact`, `f() generateVue`, `f() generateSvelte`, `f() generateHTML`, `f() getFileExtension`, `f() generateComponent`, `f() printHelp`, `f() main` |
| .claude/skills/frontend-design/scripts/generate-palette.ts | `f() hexToRgb`, `f() rgbToHex`, `f() toHex`, `f() rgbToHsl`, `f() hslToRgb`, `f() hue2rgb`, `f() adjustHsl`, `f() generateShadeScale`, `f() generateThemeColors`, `f() applyStyle`, `f() generateSemanticColors`, `f() generateNeutralScale`, `f() generateSecondaryColor`, `f() generateAccentColor`, `f() generatePalette`, `f() formatAsCSS`, `f() formatColor`, `f() formatAsSCSS`, `f() formatColor`, `f() formatAsTailwind`, `f() formatAsTokens`, `f() formatTokens`, `f() formatOutput`, `f() printHelp`, `f() main` |
| .claude/skills/frontend-design/scripts/generate-tokens.ts | `f() flattenTokens`, `f() generateCSS`, `f() generateSCSS`, `f() generateJSON`, `f() generateJS`, `f() generateTS`, `f() generateTailwind`, `f() generateStyleDictionary`, `f() convertToSD`, `f() getFileExtension`, `f() getFileName`, `f() generateTokens`, `f() printHelp`, `f() main` |
| .claude/skills/frontend-design/scripts/generate-typography.ts | `f() createFontStack`, `f() generateFontSizes`, `f() generateFontWeights`, `f() generateLetterSpacing`, `f() generateResponsiveSizes`, `f() generateTypography`, `f() formatAsCSS`, `f() formatAsSCSS`, `f() formatAsTailwind`, `f() formatAsTokens`, `f() formatOutput`, `f() printHelp`, `f() main` |
| .trae/skills/frontend-design/scripts/analyze-accessibility.ts | `f() hexToRgb`, `f() getLuminance`, `f() getContrastRatio`, `f() getLineNumber`, `f() analyzeContent`, `f() analyzeColorContrast`, `f() generatePassedChecks`, `f() categoryIssues`, `f() hasErrors`, `f() calculateScore`, `f() analyzeAccessibility`, `f() errors`, `f() warnings`, `f() formatSummary`, `f() printHelp`, `f() main`, `f() hasErrors` |
| .trae/skills/frontend-design/scripts/analyze-styles.ts | `f() normalizeColor`, `f() suggestTokenName`, `f() parseCSS`, `f() analyzeColors`, `f() analyzeTypography`, `f() analyzeSpacing`, `f() findInconsistencies`, `f() hexColors`, `f() fontFamilies`, `f() areColorsSimilar`, `f() generateRecommendations`, `f() pixelSpacing`, `f() analyzeStyles`, `f() formatSummary`, `f() printHelp`, `f() main` |
| .trae/skills/frontend-design/scripts/extract-tokens.ts | `f() classifyToken`, `f() inferTokenType`, `f() extractCSSVariables`, `f() extractRepeatedValues`, `f() extractTokens`, `f() isTokenized`, `f() formatAsCSS`, `f() formatAsSCSS`, `f() formatAsTailwind`, `f() formatAsStyleDictionary`, `f() formatAsTokensStudio`, `f() formatOutput`, `f() printHelp`, `f() main` |
| .trae/skills/frontend-design/scripts/generate-component.ts | `f() getButtonTemplate`, `f() getCardTemplate`, `f() getInputTemplate`, `f() generateReact`, `f() generateVue`, `f() generateSvelte`, `f() generateHTML`, `f() getFileExtension`, `f() generateComponent`, `f() printHelp`, `f() main` |
| .trae/skills/frontend-design/scripts/generate-palette.ts | `f() hexToRgb`, `f() rgbToHex`, `f() toHex`, `f() rgbToHsl`, `f() hslToRgb`, `f() hue2rgb`, `f() adjustHsl`, `f() generateShadeScale`, `f() generateThemeColors`, `f() applyStyle`, `f() generateSemanticColors`, `f() generateNeutralScale`, `f() generateSecondaryColor`, `f() generateAccentColor`, `f() generatePalette`, `f() formatAsCSS`, `f() formatColor`, `f() formatAsSCSS`, `f() formatColor`, `f() formatAsTailwind`, `f() formatAsTokens`, `f() formatTokens`, `f() formatOutput`, `f() printHelp`, `f() main` |
| .trae/skills/frontend-design/scripts/generate-tokens.ts | `f() flattenTokens`, `f() generateCSS`, `f() generateSCSS`, `f() generateJSON`, `f() generateJS`, `f() generateTS`, `f() generateTailwind`, `f() generateStyleDictionary`, `f() convertToSD`, `f() getFileExtension`, `f() getFileName`, `f() generateTokens`, `f() printHelp`, `f() main` |
| .trae/skills/frontend-design/scripts/generate-typography.ts | `f() createFontStack`, `f() generateFontSizes`, `f() generateFontWeights`, `f() generateLetterSpacing`, `f() generateResponsiveSizes`, `f() generateTypography`, `f() formatAsCSS`, `f() formatAsSCSS`, `f() formatAsTailwind`, `f() formatAsTokens`, `f() formatOutput`, `f() printHelp`, `f() main` |
| clean_main.js | `f() loadPusoyLayout` |
| client/js/main.js | `f() debugLog`, `f() msg`, `f() debugWarn`, `f() msg`, `f() fallbackCopyText`, `f() authBoot`, `f() bootApp`, `f() init`, `f() initBriefModal`, `f() closeDialog`, `f() getDOMElements`, `f() bindEvents`, `f() g`, `f() setPhase`, `f() updateLayoutInfoDisplay`, `f() updateFlipControlsVisibility`, `f() handleFlipAllCards`, `f() scanAndPopulateDecks`, `f() deckFolders`, `f() handleDeckSelectChange`, `f() handleLoadDeck`, `f() loadDeckFromPath`, `f() imageFiles`, `f() backFile`, `f() cardFiles`, `f() loadDeckFromFiles`, `f() imageFiles`, `f() backFile`, `f() cardFiles`, `f() createPlaceholderDeck`, `f() createCardData`, `f() renderCardTray`, `f() createTrayCardElement`, `f() createPlaceholderCardImage`, `f() getFilteredTrayCards`, `f() filterTrayCards`, `f() handleSuitFilter`, `f() handleTrayCardDragStart`, `f() handleTrayCardDragEnd`, `f() setupZoneDropTargets`, `f() handleZoneDrop`, `f() droppedCard`, `f() place`, `f() existingCards`, `f() showSwapStackPopup`, `f() swapCards`, `f() moveCardToZone`, `f() oldZoneCards`, `f() newZoneCards`, `f() rerenderZoneCards`, `f() zoneCards`, `f() placeCardInZone`, `f() place`, `f() zoneCards`, `f() placeCardOnTable`, `f() moveCardToPosition`, `f() createZoneCardElement`, `f() place`, `f() totalCards`, `f() createTableCardElement`, `f() handleCardClick`, `f() isInGroup`, `f() selectCard`, `f() deselectCard`, `f() flipCard`, `f() handleZoneFlipChange`, `f() updateCardPosDisplay`, `f() makeCardDraggable`, `f() handleOverlapChange`, `f() reRenderZoneCards`, `f() zoneCards`, `f() handleResetTable`, `f() returnCardToTray`, `f() setupTrayDropTarget`, `f() card`, `f() handleAddStep`, `f() handleFinishStep`, `f() saveInitialState`, `f() takeSnapshot`, `f() computeActions`, `f() getAEPosition`, `f() handlePropertyChange`, `f() uiToAEPosition`, `f() aeToUIPosition`, `f() getUIZonePosition`, `f() place`, `f() getAEZonePosition`, `f() saveInitialStateForExport`, `f() place`, `f() place`, `f() handleExportJSON`, `f() handleExportToAE`, `f() escapeForScript`, `f() handleSelectAssetsFolder`, `f() updateAssetsDisplay`, `f() handleSaveProject`, `f() handleLoadProject`, `f() renderTimeline`, `f() updateUI`, `f() setStatus`, `f() hideInstructions`, `f() showInstructions`, `f() handleReplay`, `f() replayNextStep`, `f() animateCardsSequentially`, `f() animateNext`, `f() stopReplay`, `f() restoreToInitialState`, `f() card`, `f() cardsInInitialState`, `f() handleDeleteStep`, `f() handleEditStep`, `f() renumberSteps`, `f() restoreFromSnapshot`, `f() card`, `f() cardsInSnapshot`, `class if`, `f() showWarningModal`, `f() hideWarningModal`, `f() confirmWarning`, `f() showHelpModal`, `f() hideHelpModal`, `f() initHelpVideoLinks`, `f() showAutoStepPopup`, `f() hideAutoStepPopup`, `f() handleAutoStepYes`, `f() handleAutoStepNo`, `class to`, `f() triggerAutoStepCheck`, `f() showCardContextMenu`, `f() tableCardsOnBoard`, `f() hideCardContextMenu`, `f() setupCtxMenuDrag`, `f() unpinMenu`, `f() updateContextMenuState`, `f() toggleCtxFlip`, `f() handleFlipAni`, `f() toggleCtxSlam`, `f() toggleCtxFlipAll`, `f() enabledCount`, `f() toggleCtxSlamAll`, `f() enabledCount`, `f() toggleCtxSpin`, `f() toggleCtxSpinAll`, `f() enabledCount`, `f() ensureZOrder`, `f() handleLoadPreset`, `f() renderGroupPencils`, `f() groupPlaces`, `f() allSelected`, `f() cloneHandToTargetQuadrant`, `f() sourceGroupsToClone`, `f() p1`, `f() places`, `f() places`, `f() generateArrayHand`, `f() slotIds`, `f() loadPokerLayout`, `f() loadPusoyLayout`, `f() generatePusoyHand`, `f() loadPusoyMultiLayout`, `f() setupPusoySliderControls`, `f() togglePusoyControls`, `f() updatePusoyLayout`, `f() loadGridLayout`, `f() toggleGridControlsVisibility`, `f() snapCardPlacesToGrid`, `f() handleGridResetDefault`, `f() setupCardSortingSliderControls`, `f() updateGridFromSliders`, `f() setupDealingCardControls`, `f() updateDealTimeEstimate`, `f() renderDealingSlot`, `f() removeDealingSlot`, `f() updateDealingSlotButton`, `f() handleApplyGrid`, `f() handleAddCardPlace`, `f() handleAddCommunityZone`, `f() czCount`, `f() handleClearBoard`, `f() handleSavePreset`, `f() downloadPresetJSON`, `f() saveLayoutToStorage`, `f() loadSavedLayouts`, `f() deleteSavedLayout`, `f() refreshSavedLayoutsDropdown`, `f() getAutosaveFilePath`, `f() autoSaveBoardLayout`, `f() autoRestoreBoardLayout`, `f() renderCardPlaceMarkers`, `class if`, `f() clearCardPlaceMarkers`, `f() renderCardDropZones`, `f() restoreGridCards`, `f() gridCards`, `f() clearCardDropZones`, `f() clearDropZoneSelection`, `f() getSelectedEmptySlots`, `f() showSlotContextMenu`, `f() hideSlotContextMenu`, `f() fillSlotsAuto`, `f() available`, `f() showManualFillOverlay`, `f() hideManualFillOverlay`, `f() executeManualFill`, `f() codes`, `f() trayAvailable`, `f() showManualFillError`, `f() deleteCardPlace`, `f() selectCardPlace`, `f() deselectCardPlace`, `f() updateClonerBtnState`, `f() initCZSettingsPanel`, `f() hasCard`, `f() place`, `f() place`, `f() startDragMarker`, `f() undoSnapshot`, `f() onMouseMove`, `f() onMouseUp`, `f() startRotateMarker`, `f() undoSnapshot`, `f() onMouseMove`, `f() onMouseUp`, `f() startResizeCommunityZone`, `f() undoSnapshot`, `f() onMouseMove`, `f() onMouseUp`, `f() updateCardPlacesList`, `f() updateGroupPanelVisibility`, `f() renderGroupPanel`, `f() updateCreateGroupBtnState`, `f() highlightGroupMarkers`, `f() updateGroupOrderSectionVisibility`, `f() renderGroupOrderStrip`, `f() initTimelineModulesIntegration`, `f() hookTimelineFunctions`, `f() getStepColor`, `f() handleTimelineStepSelect`, `f() handleTimelineStepEdit`, `f() startEditingStep`, `f() handleTimelineStepMove`, `f() refreshTimelineUI`, `f() syncTimelineModulesWithSteps`, `f() updateTimelinePlayhead`, `f() handleGroupingModeChange`, `class for`, `f() handleAutoRecordChange`, `f() handleAutoRecordDelayChange`, `f() toggleCardGroupSelection`, `f() index`, `f() clearGroupedCards`, `f() updateGroupCount`, `f() startAutoRecordCountdown`, `f() cancelAutoRecordCountdown`, `f() autoSaveGroupedStep`, `f() updateGroupingSectionVisibility`, `f() handleGroupedCardsDrop`, `f() oldZoneCards`, `f() enableAIButton`, `f() toggleAIPanel`, `f() handleRefImageAttach`, `f() handleRefVideoAttach`, `f() extractVideoFrames`, `f() captureFrame`, `f() renderAttachPreview`, `f() getAPIBaseUrl`, `f() handleAIGenerate`, `f() applyAILayout`, `f() findTrayCardByName`, `f() findTableCardByName`, `f() silentPlaceCard`, `f() applyAIScenario`, `f() applyScenarioAction`, `f() showAIStatus`, `f() hideAIStatus`, `f() showAIError`, `f() hideAIError` |
| client/js/modules/asset_manager.js | `f() checkAssetUpdates`, `f() getLocalAssetVersion` |
| client/js/modules/auth.js | `f() loadAuthConfig`, `f() getToken`, `f() getUser`, `f() setAuth`, `f() clearAuth`, `f() decodeJWT`, `f() isTokenValid`, `f() isAuthenticated`, `f() authFetch`, `class AuthError`, `f() login`, `f() logout`, `f() showLoginScreen`, `f() hideLoginScreen`, `f() initLoginUI`, `f() updateUserDisplay` |
| client/js/modules/board_tools.js | `f() arrangeRow`, `f() arrangeColumn`, `f() stackSlots`, `f() handleAddPusoyPack`, `f() startCloner`, `f() editCloner`, `f() generateClonerPositions`, `f() updateClonerPreview`, `f() applyCloner`, `f() oldGroup`, `f() cancelCloner`, `f() deleteClonerGroup`, `f() group`, `f() showClonerPanel`, `f() hideClonerPanel`, `f() getActivePlaces`, `f() pushBoardUndoSnapshot`, `f() initBoardTools`, `f() applyBgImage`, `f() handleAddArrayPack`, `f() existingZoneNames` |
| client/js/modules/bridge-server.js | `f() hasNodeJS`, `f() startBridgeServer`, `f() stopBridgeServer`, `f() handleStatus`, `f() handleGetPresets`, `f() handleLoadPreset`, `f() handleLoadSetup`, `f() handleLoadScenario`, `f() handleExportAE`, `f() parseBody`, `f() sendJSON`, `f() updateBridgeIndicator` |
| client/js/modules/card_name_resolver.js | `f() resolveCardName`, `f() match`, `f() parseCardInput` |
| client/js/modules/index.js | `f() initTimelineModules`, `f() hookAfter`, `f() unhook` |
| client/js/modules/playback_controller.js | `class PlaybackController` |
| client/js/modules/script_loader.js | `f() loadCoreScript`, `f() getLoadedScriptVersion` |
| client/js/modules/slot_group_manager.js | `f() getGroupForPlace`, `f() findPlaceById`, `f() computeFinalZOrder`, `f() computeFinalZOrderAtStep`, `f() computeZOrderForCard`, `f() getGroupColor`, `f() generateGroupId`, `f() createSlotGroup`, `f() deleteSlotGroup`, `f() renameSlotGroup`, `f() reorderSlotGroups`, `f() clearAllGroups`, `f() removeSlotFromAllGroups`, `f() cleanupEmptyGroups`, `f() renormalizeGroupOrder`, `f() pushGroupUndoSnapshot`, `f() undoGroupAction` |
| client/js/modules/snapshot_manager.js | `class SnapshotManager` |
| client/js/modules/step_property_manager.js | `class StepPropertyManager` |
| client/js/modules/timeline_manager.js | `class TimelineManager` |
| client/js/modules/timeline_ui.js | `class TimelineUI`, `class from` |
| client/js/modules/transform_indicator.js | `f() ensureSVGOverlay`, `f() showTransformIndicator`, `f() hideTransformIndicator`, `f() analyzeLayers`, `f() group`, `f() renderSVGIndicator`, `f() mapToDOM`, `f() drawSideLine`, `f() createHandle`, `f() startTransformDrag`, `f() onTransformDragMove`, `f() applyMathToCards`, `f() endTransformDrag`, `f() syncTransformIndicator` |
| client/js/modules/updater.js | `f() checkForUpdates`, `f() compareVersions`, `f() applyUpdate`, `f() mkdirRecursive`, `f() updateStatusUI`, `f() initUpdaterUI`, `f() autoCheckUpdate` |
| client/js/temp_block.js | `f() g` |
| client/js/utils/event_emitter.js | `class EventEmitter` |
| client/tools/deck-prepper/prepper.js | `f() init`, `f() renderBoard`, `f() handleBatchUpload`, `f() imageFiles`, `f() setupDragDrop`, `f() handleSlotDrop`, `f() handleMultiDrop`, `f() imageFiles`, `f() backFile`, `f() fillSlot`, `f() handleExport`, `f() downloadBlob`, `f() resizeImage`, `f() blobToBuffer`, `f() showStatus` |
| faq/script.js | `f() isMobile`, `f() openSidebar`, `f() closeSidebar`, `f() toggleSidebar` |
| fix_poker.js | `f() loadPokerLayout`, `f() generateArrayHand`, `f() loadPokerLayout` |
| generate_memory.js | `f() getFileType`, `f() walkDir`, `f() parseFile`, `f() generateTextTree`, `f() printTree`, `f() run` |
| host/index.jsx | `f() generateSequence`, `f() setupInitialScene`, `f() findStrokeWidthInShape`, `f() findStrokeColorInShape`, `f() createCardPrecomp`, `f() importAndAddLayer`, `f() setAnchorPointToCenter`, `f() applyInitialTransform`, `f() createControlLayer`, `f() applyPusoyPositionExpression`, `f() createZoneNulls`, `f() applyScaleExpression`, `f() addPerCardControls`, `f() applyFlipExpression`, `f() applySelectionExpression`, `f() applyZoneOffsetExpression`, `f() processDealingAnimation`, `f() processScenarioAnimation`, `f() shiftZoneCards`, `f() calculateTargetZ`, `f() processSwapInitiator`, `f() processSwapDisplaced`, `f() processSelectionAction`, `f() processTransformAction`, `f() processFlipEffect`, `f() setHoldInterpolation`, `f() processSlamEffect`, `f() processSpinEffect`, `f() createVisualMouseLayer`, `f() setEaseAtKey`, `f() areKeyValuesEqual`, `f() applyBezierEasing`, `f() applyBounceEasing`, `f() calculateTotalDuration`, `f() getOrCreateFolder`, `f() generateSessionId`, `f() setupProjectFolders`, `f() normalizeAssetPath`, `f() resolveAssetPath`, `f() getDimensionCount`, `f() createPlaceholderLayer`, `f() createSuccessResponse`, `f() createErrorResponse`, `f() importPokerScenario`, `f() importPokerScenarioWithAssets`, `f() testConnection`, `f() importPokerAnimation`, `f() importLegacyCardLayer` |
| lib/CSInterface.js | `f() CSXSWindowType`, `class Version`, `f() Version`, `class VersionBound`, `f() VersionBound`, `class VersionRange`, `f() VersionRange`, `class Runtime`, `f() Runtime`, `class Extension`, `f() Extension`, `class CSEvent`, `class for`, `f() CSEvent`, `class SystemPath`, `f() SystemPath`, `class ColorType`, `f() ColorType`, `class RGBColor`, `f() RGBColor`, `class Direction`, `f() Direction`, `class GradientStop`, `f() GradientStop`, `class GradientColor`, `f() GradientColor`, `class UIColor`, `f() UIColor`, `class AppSkinInfo`, `f() AppSkinInfo`, `class HostEnvironment`, `f() HostEnvironment`, `class HostCapabilities`, `f() HostCapabilities`, `class ApiVersion`, `f() ApiVersion`, `class MenuItemStatus`, `f() MenuItemStatus`, `class ContextMenuItemStatus`, `f() ContextMenuItemStatus`, `class CSInterface`, `f() CSInterface`, `f() OnAppThemeColorChanged` |
| patch.js | `f() togglePusoyControls`, `f() togglePusoyControls`, `f() generateArrayHand`, `f() slotIds`, `f() loadPokerLayout`, `f() handleAddArrayPack` |
