    let confirmPresetClick = false;

    // Mini Preview Window Logic
    const miniPreviewOverlay = document.getElementById('miniPreviewOverlay');
    const miniPreviewTable = document.getElementById('miniPreviewTable');
    const miniPreviewTitle = document.getElementById('miniPreviewTitle');

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            const presetId = btn.getAttribute('data-preset');
            const presetLabel = btn.querySelector('.preset-label')?.textContent || presetId;
            
            if (miniPreviewOverlay && miniPreviewTable) {
                // Backup
                const backupState = JSON.stringify(appState.boardLayout);
                appState.boardLayout.cardPlaces = [];
                appState.boardLayout.slotGroups = [];
                
                // Gen
                if (presetId === 'poker') loadPokerLayout();
                else if (presetId === 'pusoy') loadPusoyMultiLayout(4);
                else if (presetId.startsWith('pusoy-')) loadPusoyMultiLayout(parseInt(presetId.split('-')[1]));
                else if (presetId === 'omaha') loadOmahaLayout();
                else if (presetId === 'array-2') {
                    appState.boardLayout.cardPlaces = [...generateArrayHand('bottom', 0), ...generateArrayHand('top', 1)];
                }
                else if (presetId.startsWith('saved:')) {
                    const savedJSON = localStorage.getItem('autonim_poker_layout_' + presetId.substring(6));
                    if (savedJSON) { try { appState.boardLayout = JSON.parse(savedJSON); } catch(e){} }
                }
                else loadPokerLayout();

                // Render
                miniPreviewTable.innerHTML = '';
                const places = appState.boardLayout.cardPlaces || [];
                const groups = appState.boardLayout.slotGroups || [];
                places.forEach(p => {
                    const el = document.createElement('div');
                    el.className = 'mini-preview-marker';
                    el.style.left = p.x + 'px';
                    el.style.top = p.y + 'px';
                    let w = 124, h = 172;
                    if (p.isCommunityZone) { w = p.czWidth || 300; h = p.czHeight || 120; }
                    el.style.width = w + 'px'; el.style.height = h + 'px';
                    el.style.transform = `translate(-50%, -50%) rotate(${p.rotation || 0}deg)`;
                    const g = groups.find(x => x.slotIds && x.slotIds.includes(p.id));
                    if (g) {
                        el.style.borderColor = g.color;
                        el.style.background = g.color.replace(')', ', 0.15)').replace('rgb', 'rgba');
                    }
                    miniPreviewTable.appendChild(el);
                });
                
                miniPreviewTable.style.transform = `scale(${600 / 1280})`;
                miniPreviewTable.style.transformOrigin = 'top left';
                miniPreviewTable.style.width = '1280px';
                miniPreviewTable.style.height = '720px';

                // Restore instantly
                appState.boardLayout = JSON.parse(backupState);
                
                if (miniPreviewTitle) miniPreviewTitle.textContent = `${presetLabel} Preview`;
                miniPreviewOverlay.classList.remove('hidden');
                miniPreviewOverlay.classList.add('visible');
            }
        });

        btn.addEventListener('mouseleave', () => {
            if (miniPreviewOverlay) {
                miniPreviewOverlay.classList.remove('visible');
                setTimeout(() => miniPreviewOverlay.classList.add('hidden'), 200);
            }
        });

        btn.addEventListener('click', () => {
            btn.classList.add('pop-effect');
            setTimeout(() => btn.classList.remove('pop-effect'), 300);
            if (miniPreviewOverlay) {
                miniPreviewOverlay.classList.remove('visible');
                miniPreviewOverlay.classList.add('hidden');
            }
            const preset = btn.getAttribute('data-preset');
            if (preset && presetSelect) {
                presetSelect.value = preset;
                presetSelect.dispatchEvent(new Event('change'));
                if (loadPresetBtn) loadPresetBtn.click();
            }
        });
    });
