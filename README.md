# BigQuery Release Explorer & Share

A modern web application built using Python Flask, vanilla HTML5, CSS3, and JavaScript that fetches the official Google Cloud BigQuery Release Notes RSS/Atom feed, parses the contents, and displays them in a gorgeous glassmorphic feed. It allows searching, categorizing, and drafting/sharing updates directly to Twitter/X.

## Features

- **Automated RSS Fetching**: Real-time parsing of the BigQuery release notes Atom feed.
- **Dynamic Classification**: Auto-tags updates as *Features*, *Updates*, *Bug Fixes*, *Deprecations*, or *General Info* by analyzing headers and contents.
- **Dashboard Metrics**: Quick numbers overview of different update categories.
- **Search & Filters**: Instantly find specific changes using the client-side search box or filter buttons.
- **Tweet Composer**:
  - Open a sleek, glassmorphic drafting card for any selected update.
  - Three distinct preset templates: *Announcement*, *Quick Summary*, and *Minimalist*.
  - Smarter auto-truncation that keeps tweets within Twitter's 280-character limit while preserving links, tags, and titles.
  - Interactive character progress bars and limits warnings.
  - Quick clipboard copy with interactive success states.
  - Direct integration via Twitter Web Intents.
- **Design Excellence**: Dark mode layout, animations, glows, and skeleton screens.

## Quick Start

### 1. Install Dependencies
Make sure you have Python installed, then install the required Flask dependency:
```bash
pip install -r requirements.txt
```

### 2. Start the Server
Run the Flask server:
```bash
python app.py
```

### 3. Open the Application
Navigate to the local URL in your web browser:
```
http://127.0.0.1:5000
```
