/* Autonim-Poker Manual — Scripts */

document.addEventListener('DOMContentLoaded', () => {

    // ---- Elements ----
    const sidebar         = document.getElementById('sidebar');
    const sidebarToggle   = document.getElementById('sidebarToggle');
    const sidebarOverlay  = document.getElementById('sidebarOverlay');
    const contentWrapper  = document.getElementById('contentWrapper');
    const navToggle       = document.getElementById('navToggle');
    const headerNav       = document.getElementById('headerNav');

    const isMobile = () => window.innerWidth <= 1024;

    // ---- Sidebar State ----
    let sidebarOpen = !isMobile(); // open by default on desktop

    function openSidebar() {
        sidebarOpen = true;
        if (isMobile()) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('mobile-open');
            sidebarOverlay.classList.add('active');
            contentWrapper.classList.remove('sidebar-collapsed');
        } else {
            sidebar.classList.remove('collapsed');
            contentWrapper.classList.remove('sidebar-collapsed');
        }
    }

    function closeSidebar() {
        sidebarOpen = false;
        if (isMobile()) {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
        } else {
            sidebar.classList.add('collapsed');
            contentWrapper.classList.add('sidebar-collapsed');
        }
    }

    function toggleSidebar() {
        if (sidebarOpen) closeSidebar();
        else openSidebar();
    }

    // Init state on load
    if (isMobile()) {
        sidebar.classList.add('collapsed');
        contentWrapper.classList.remove('sidebar-collapsed');
        sidebarOpen = false;
    }

    sidebarToggle?.addEventListener('click', toggleSidebar);
    sidebarOverlay?.addEventListener('click', closeSidebar);

    // Handle resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (!isMobile()) {
                // Desktop: remove mobile-specific classes
                sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
                if (sidebarOpen) {
                    sidebar.classList.remove('collapsed');
                    contentWrapper.classList.remove('sidebar-collapsed');
                }
            } else {
                // Mobile: always close by default on resize
                sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
                contentWrapper.classList.remove('sidebar-collapsed');
                sidebarOpen = false;
            }
        }, 100);
    });

    // ---- Mobile header nav toggle ----
    if (navToggle && headerNav) {
        navToggle.addEventListener('click', () => {
            headerNav.classList.toggle('active');
            navToggle.classList.toggle('active');
        });

        headerNav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                headerNav.classList.remove('active');
                navToggle.classList.remove('active');
            });
        });
    }

    // ---- Scroll spy: TOC links + header nav ----
    const allSections    = document.querySelectorAll('.section[id]');
    const allSubsections = document.querySelectorAll('.subsection[id]');
    const tocLinks       = document.querySelectorAll('.toc-link');
    const tocGroupTitles = document.querySelectorAll('.toc-group__title');
    const navLinks       = document.querySelectorAll('.nav-link');

    // Build lookup: id → toc link
    const tocMap = {};
    tocLinks.forEach(link => {
        const id = link.getAttribute('href')?.replace('#', '');
        if (id) tocMap[id] = link;
    });

    // Build lookup: subsection id → parent section id
    const parentMap = {};
    allSections.forEach(section => {
        section.querySelectorAll('.subsection[id]').forEach(sub => {
            parentMap[sub.id] = section.id;
        });
    });

    let activeSubId = null;

    const subObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                if (id === activeSubId) return;
                activeSubId = id;

                // Update toc-link active states
                tocLinks.forEach(l => l.classList.remove('active'));
                const activeLink = tocMap[id];
                if (activeLink) {
                    activeLink.classList.add('active');
                    // Scroll TOC to keep active link visible
                    activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }

                // Update toc group title active state
                const parentId = parentMap[id];
                tocGroupTitles.forEach(t => t.classList.remove('active'));
                if (parentId) {
                    const parentTitle = document.querySelector(`.toc-group__title[href="#${parentId}"]`);
                    parentTitle?.classList.add('active');
                }
            }
        });
    }, {
        root: null,
        rootMargin: '-72px 0px -60% 0px',
        threshold: 0
    });

    allSubsections.forEach(sub => subObserver.observe(sub));

    // Section-level observer for header nav
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                navLinks.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });
                // Also activate toc group title when section in view (no subsection active yet)
                if (!activeSubId) {
                    tocGroupTitles.forEach(t => t.classList.remove('active'));
                    const title = document.querySelector(`.toc-group__title[href="#${id}"]`);
                    title?.classList.add('active');
                }
            }
        });
    }, {
        root: null,
        rootMargin: '-72px 0px -70% 0px',
        threshold: 0
    });

    allSections.forEach(s => sectionObserver.observe(s));

    // ---- Reveal animation for cards ----
    const revealTargets = document.querySelectorAll('.info-card, .faq-item, .shortcut, .subsection, .glossary-item');

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        root: null,
        rootMargin: '0px 0px -30px 0px',
        threshold: 0.04
    });

    revealTargets.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(12px)';
        el.style.transition = 'opacity 0.45s ease, transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
        revealObserver.observe(el);
    });

    // Inject reveal + active nav styles
    const style = document.createElement('style');
    style.textContent = `
        .revealed { opacity: 1 !important; transform: translateY(0) !important; }
        .nav-link.active { color: var(--accent-amber); background: var(--accent-amber-glow); }
    `;
    document.head.appendChild(style);

    // ---- Close mobile sidebar on TOC link click ----
    tocLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (isMobile() && sidebarOpen) closeSidebar();
        });
    });

    tocGroupTitles.forEach(title => {
        title.addEventListener('click', () => {
            if (isMobile() && sidebarOpen) closeSidebar();
        });
    });

});
