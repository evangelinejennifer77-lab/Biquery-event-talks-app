// App State
let state = {
    releases: [],
    filteredReleases: [],
    selectedRelease: null,
    currentFilterType: 'all',
    currentSearchText: '',
    currentSortOrder: 'newest',
    activeTemplateStyle: 'feature',
    lastFetched: null
};

// DOM Elements
const elements = {
    btnRefresh: document.getElementById('btn-refresh'),
    spinner: document.getElementById('spinner'),
    statusText: document.getElementById('status-text'),
    statusDot: document.querySelector('.status-dot'),
    
    // Stats
    statTotal: document.getElementById('stat-total'),
    statFeatures: document.getElementById('stat-features'),
    statChanges: document.getElementById('stat-changes'),
    statFixes: document.getElementById('stat-fixes'),
    statCards: document.querySelectorAll('.stat-card'),
    
    // Controls
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    filterTags: document.querySelectorAll('.filter-tag'),
    sortSelect: document.getElementById('sort-select'),
    
    // Content containers
    notesContainer: document.getElementById('notes-container'),
    noResults: document.getElementById('no-results'),
    
    // Modal
    tweetModal: document.getElementById('tweet-modal'),
    modalClose: document.getElementById('modal-close'),
    templateChips: document.querySelectorAll('.template-chips .chip'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCounter: document.getElementById('char-counter'),
    charProgressFill: document.getElementById('char-progress-fill'),
    refNoteTitle: document.getElementById('ref-note-title'),
    refNoteBody: document.getElementById('ref-note-body'),
    btnCopyTweet: document.getElementById('btn-copy-tweet'),
    btnPostTweet: document.getElementById('btn-post-tweet'),
    
    // Toaster
    toastContainer: document.getElementById('toast-container')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchReleases();
});

// Event Listeners
function setupEventListeners() {
    // Refresh Button
    elements.btnRefresh.addEventListener('click', fetchReleases);
    
    // Search Box
    elements.searchInput.addEventListener('input', (e) => {
        state.currentSearchText = e.target.value.trim();
        elements.searchClear.style.display = state.currentSearchText ? 'block' : 'none';
        applyFiltersAndRender();
    });
    
    elements.searchClear.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.currentSearchText = '';
        elements.searchClear.style.display = 'none';
        applyFiltersAndRender();
    });
    
    // Filter tags (All, Features, Changes, Fixes, Deprecations)
    elements.filterTags.forEach(tag => {
        tag.addEventListener('click', () => {
            elements.filterTags.forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            state.currentFilterType = tag.dataset.type;
            applyFiltersAndRender();
        });
    });
    
    // Stats dashboard filters (Quick filter triggers)
    elements.statCards.forEach(card => {
        card.addEventListener('click', () => {
            const targetType = card.dataset.filter;
            // Find and activate the corresponding tag
            elements.filterTags.forEach(tag => {
                if (tag.dataset.type === targetType) {
                    tag.click();
                }
            });
        });
    });
    
    // Sort Select
    elements.sortSelect.addEventListener('change', (e) => {
        state.currentSortOrder = e.target.value;
        applyFiltersAndRender();
    });
    
    // Modal Close
    elements.modalClose.addEventListener('click', closeTweetModal);
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) closeTweetModal();
    });
    
    // Tweet style chips
    elements.templateChips.forEach(chip => {
        chip.addEventListener('click', () => {
            elements.templateChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.activeTemplateStyle = chip.dataset.style;
            updateTweetDraft();
        });
    });
    
    // Character counter live check
    elements.tweetTextarea.addEventListener('input', updateCharCounter);
    
    // Copy Tweet Button
    elements.btnCopyTweet.addEventListener('click', copyTweetToClipboard);
    
    // Post Tweet Button
    elements.btnPostTweet.addEventListener('click', postTweetToTwitter);
}

// Fetch Releases from Flask Backend API
async function fetchReleases() {
    try {
        setLoadingState(true);
        
        const response = await fetch('/api/releases');
        if (!response.ok) {
            throw new Error(`Failed to fetch releases: Server returned status ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Unknown parsing error occured.');
        }
        
        state.releases = data.entries;
        state.lastFetched = data.fetched_at;
        
        updateStats();
        applyFiltersAndRender();
        
        elements.statusText.textContent = `Last synced: ${new Date().toLocaleTimeString()}`;
        showToast('Release notes successfully updated!', 'success');
        
    } catch (error) {
        console.error(error);
        elements.statusText.textContent = 'Sync failed';
        showToast(`Sync failed: ${error.message}`, 'error');
        renderErrorState(error.message);
    } finally {
        setLoadingState(false);
    }
}

// Set Loading UI states
function setLoadingState(isLoading) {
    if (isLoading) {
        elements.spinner.classList.add('active');
        elements.btnRefresh.disabled = true;
        elements.statusDot.className = 'status-dot loading';
        elements.statusText.textContent = 'Fetching feed...';
        
        // Show Skeleton Loaders
        elements.notesContainer.innerHTML = Array(3).fill(0).map(() => `
            <div class="skeleton-card">
                <div class="skeleton-header">
                    <div class="skeleton-pill"></div>
                    <div class="skeleton-date"></div>
                </div>
                <div class="skeleton-title"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line half"></div>
                <div class="skeleton-footer"></div>
            </div>
        `).join('');
        elements.noResults.style.display = 'none';
    } else {
        elements.spinner.classList.remove('active');
        elements.btnRefresh.disabled = false;
        elements.statusDot.className = 'status-dot online';
    }
}

// Render Error Card inside main grid
function renderErrorState(errorMessage) {
    elements.notesContainer.innerHTML = `
        <div class="no-results-card" style="border-color: var(--color-fix);">
            <div class="no-results-icon" style="color: var(--color-fix);">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 style="color: var(--text-primary);">Failed to load updates</h3>
            <p style="margin-bottom: 16px;">${errorMessage}</p>
            <button onclick="fetchReleases()" class="btn btn-secondary" style="margin: 0 auto;">
                <i class="fa-solid fa-rotate"></i> Try Again
            </button>
        </div>
    `;
}

// Calculate and Update Dashboard stats
function updateStats() {
    const total = state.releases.length;
    const features = state.releases.filter(r => r.type === 'feature' || r.type === 'ga').length;
    const changes = state.releases.filter(r => r.type === 'change' || r.type === 'general').length;
    const fixes = state.releases.filter(r => r.type === 'fix').length;
    
    // Animate numbers gently
    animateNumber(elements.statTotal, total);
    animateNumber(elements.statFeatures, features);
    animateNumber(elements.statChanges, changes);
    animateNumber(elements.statFixes, fixes);
}

// Gentle counter animation
function animateNumber(element, target) {
    let current = parseInt(element.textContent) || 0;
    if (current === target) return;
    
    const step = target > current ? 1 : -1;
    const speed = Math.max(10, Math.floor(100 / Math.abs(target - current)));
    
    const timer = setInterval(() => {
        current += step;
        element.textContent = current;
        if (current === target) {
            clearInterval(timer);
        }
    }, speed);
}

// Apply Filters, Searches and Sorting, then Render List
function applyFiltersAndRender() {
    let result = [...state.releases];
    
    // 1. Filter by category type
    if (state.currentFilterType !== 'all') {
        result = result.filter(r => r.type === state.currentFilterType);
    }
    
    // 2. Filter by search keyword
    if (state.currentSearchText) {
        const query = state.currentSearchText.toLowerCase();
        result = result.filter(r => 
            r.title.toLowerCase().includes(query) || 
            r.content.toLowerCase().includes(query)
        );
    }
    
    // 3. Apply sorting (ISO date strings sort naturally as strings)
    result.sort((a, b) => {
        const dateA = a.updated || '';
        const dateB = b.updated || '';
        return state.currentSortOrder === 'newest' 
            ? dateB.localeCompare(dateA) 
            : dateA.localeCompare(dateB);
    });
    
    state.filteredReleases = result;
    renderReleaseCards();
}

// Render filtered releases list
function renderReleaseCards() {
    elements.notesContainer.innerHTML = '';
    
    if (state.filteredReleases.length === 0) {
        elements.noResults.style.display = 'block';
        return;
    }
    
    elements.noResults.style.display = 'none';
    
    state.filteredReleases.forEach(release => {
        const card = document.createElement('article');
        card.className = 'note-card';
        card.id = `release-${release.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
        
        // Prepare display type tag
        let badgeClass = `badge-${release.type}`;
        let badgeLabel = release.type;
        
        if (release.type === 'ga') {
            badgeLabel = 'General Availability';
        } else if (release.type === 'fix') {
            badgeLabel = 'Bug Fix';
        } else if (release.type === 'change') {
            badgeLabel = 'Update';
        }
        
        card.innerHTML = `
            <div class="note-header">
                <span class="badge ${badgeClass}">${badgeLabel}</span>
                <time class="note-date" datetime="${release.updated}">${release.date_formatted}</time>
            </div>
            <h2 class="note-title">${release.title}</h2>
            <div class="note-body">
                ${release.content}
            </div>
            <div class="note-footer">
                <button class="btn btn-secondary btn-tweet-trigger" data-id="${release.id}">
                    <i class="fa-brands fa-x-twitter"></i>
                    <span>Tweet This</span>
                </button>
            </div>
        `;
        
        // Bind Draft Tweet Action
        const btnTweet = card.querySelector('.btn-tweet-trigger');
        btnTweet.addEventListener('click', () => openTweetModal(release));
        
        elements.notesContainer.appendChild(card);
    });
}

// Clean HTML to produce plain text
function stripHtml(html) {
    let doc = new DOMParser().parseFromString(html, 'text/html');
    let text = doc.body.textContent || "";
    // Clean excessive spaces, tabs and newlines
    return text.replace(/\s+/g, ' ').trim();
}

// Generate templates for tweets based on style
function generateTweetText(release, style) {
    const title = release.title;
    const link = release.link || "https://cloud.google.com/bigquery";
    const cleanContent = stripHtml(release.content);
    
    let template = "";
    if (style === 'feature') {
        template = `🚀 New in BigQuery: ${title}\n\n{content}\n\nRead more: ${link} #BigQuery #GoogleCloud`;
    } else if (style === 'summary') {
        template = `BigQuery Update: ${title}\n\nSummary:\n{content}\n\n🔗 ${link} #GCP #BigQuery`;
    } else { // minimal
        template = `BigQuery Update: ${title}\n\n${link} #BigQuery`;
    }
    
    if (style === 'minimal') {
        return template;
    }
    
    // Calculate how much space is left for the description content
    const baseLength = template.replace('{content}', '').length;
    const maxContentLength = 280 - baseLength - 5; // buffer of 5
    
    let excerpt = cleanContent;
    if (excerpt.length > maxContentLength) {
        excerpt = excerpt.substring(0, maxContentLength) + "...";
    }
    
    return template.replace('{content}', excerpt);
}

// Open Tweet Composer Modal
function openTweetModal(release) {
    state.selectedRelease = release;
    
    // Setup modal reference details
    elements.refNoteTitle.textContent = release.title;
    elements.refNoteBody.textContent = stripHtml(release.content);
    
    // Reset style chip active classes
    elements.templateChips.forEach(chip => {
        if (chip.dataset.style === 'feature') {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
    state.activeTemplateStyle = 'feature';
    
    // Generate drafted text
    updateTweetDraft();
    
    // Reveal Modal
    elements.tweetModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // stop page scrolling
}

// Close Modal
function closeTweetModal() {
    elements.tweetModal.style.display = 'none';
    document.body.style.overflow = ''; // restore scrolling
    state.selectedRelease = null;
}

// Re-generate tweet when switching styles
function updateTweetDraft() {
    if (!state.selectedRelease) return;
    
    const tweetText = generateTweetText(state.selectedRelease, state.activeTemplateStyle);
    elements.tweetTextarea.value = tweetText;
    updateCharCounter();
}

// Live update characters limit counter and indicator bar
function updateCharCounter() {
    const len = elements.tweetTextarea.value.length;
    elements.charCounter.textContent = `${len} / 280`;
    
    // Progress width
    const percentage = Math.min(100, (len / 280) * 100);
    elements.charProgressFill.style.width = `${percentage}%`;
    
    // Class triggers based on length limits
    elements.charCounter.className = 'char-count';
    elements.charProgressFill.className = 'char-progress-fill';
    elements.btnPostTweet.disabled = false;
    
    if (len > 280) {
        elements.charCounter.classList.add('danger');
        elements.charProgressFill.classList.add('danger');
        elements.btnPostTweet.disabled = true; // prevent tweeting if over limit
    } else if (len > 250) {
        elements.charCounter.classList.add('warning');
        elements.charProgressFill.classList.add('warning');
    }
}

// Copy Tweet text to Clipboard
function copyTweetToClipboard() {
    const text = elements.tweetTextarea.value;
    if (!text) return;
    
    navigator.clipboard.writeText(text).then(() => {
        showToast('Tweet copied to clipboard!', 'success');
        
        // Dynamic UI button transition
        const btnIcon = elements.btnCopyTweet.querySelector('i');
        const btnText = elements.btnCopyTweet.querySelector('span');
        
        btnIcon.className = 'fa-solid fa-check';
        btnText.textContent = 'Copied!';
        elements.btnCopyTweet.style.background = 'rgba(16, 185, 129, 0.2)';
        elements.btnCopyTweet.style.borderColor = 'var(--color-feature)';
        
        setTimeout(() => {
            btnIcon.className = 'fa-regular fa-clipboard';
            btnText.textContent = 'Copy Text';
            elements.btnCopyTweet.style.background = '';
            elements.btnCopyTweet.style.borderColor = '';
        }, 2000);
    }).catch(err => {
        console.error('Copy failed: ', err);
        showToast('Failed to copy to clipboard', 'error');
    });
}

// Redirect and trigger Tweet Compose Intent on Twitter/X
function postTweetToTwitter() {
    const text = elements.tweetTextarea.value;
    if (!text || text.length > 280) return;
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank');
    showToast('Redirected to X / Twitter!', 'info');
    closeTweetModal();
}

// Custom Toast Alerts System
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-exclamation';
    if (type === 'info') iconClass = 'fa-circle-info';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass} toast-icon"></i>
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Automatically fade out and remove after 4s
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.4s forwards';
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 4000);
}
