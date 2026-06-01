# Duplicate Tabs Closer

Duplicate Tabs Closer detects and closes duplicate tabs automatically or displays them in a panel for manual review.

* Built with the [WebExtensions API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
* Supports Chrome, Firefox, Edge, Opera, Vivaldi, and Brave
* Firefox Multi-Account Containers are supported

## Supported Browsers

| Browser | Store | Notes |
| --- | --- | --- |
| Chrome | [Chrome Web Store](https://chrome.google.com/webstore/detail/duplicate-tabs-closer/gnmdbogfankgjepgglmmfmbnimcmcjle) | Full support |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/duplicate-tabs-closer) | Full support including Multi-Account Containers |
| Microsoft Edge | Chrome Web Store | Full support |
| Opera | Chrome Web Store | Full support |
| Vivaldi | Chrome Web Store | Full support |
| Brave | Chrome Web Store | Full support |

> **Note:** The **Container** scope options are exclusive to Firefox and require the [Multi-Account Containers](https://support.mozilla.org/en-US/kb/containers) feature. They are not available on Chrome, Edge, Opera, Vivaldi, or Brave.

## Accessing Options

The extension offers two configuration interfaces:

* **Popup panel** — click the extension icon in the toolbar. Provides quick access to a configurable subset of options and the list of current duplicate tabs.
* **Options page** — click the gear icon (⚙) at the top-right of the popup, or open your browser's Extensions settings and choose *Options* for Duplicate Tabs Closer. Provides access to all settings.

In the Options page, each option in the **Matching rules** section has an eye icon (👁) that controls whether that option is visible in the popup panel.

## Options

### On Duplicate Tab Detected

Controls what the extension does when a duplicate tab is opened.

| Value | Description |
| --- | --- |
| **Do nothing** *(default)* | Monitors tabs and updates the badge counter — no automatic action is taken. |
| **Close tab automatically** | Immediately closes the duplicate tab when it is detected. |

#### On Remaining Tab

> Only active when **On duplicate tab detected** is set to *Close tab automatically*.

Determines what happens to the kept tab after its duplicate is closed.

| Value | Description |
| --- | --- |
| **Do nothing** | Nothing further happens after the duplicate is closed. |
| **Activate** *(default)* | Switches focus to the kept tab. |
| **Default tab behaviour** | Moves the kept tab to the position of the closed tab and activates it if needed, mimicking the browser's normal tab behaviour. |

#### Whitelisted URLs

> Only active when **On duplicate tab detected** is set to *Close tab automatically*.
> Available in the **Options page** only.

A list of URL patterns, one per line. Tabs whose URLs match any entry are excluded from automatic closing. They are still counted in the badge.

**Pattern syntax:** `*` matches any sequence of characters. All other characters match literally.

```text
https://docs.google.com/*
*://github.com/*/issues
```

#### Intentional Duplicate Protection

> Only active when **On duplicate tab detected** is set to *Close tab automatically*.

Tabs opened on purpose using the browser's built-in **Duplicate Tab** command are never auto-closed.

> **Note:** This protection is only available on Firefox. On Chrome, Edge, Opera, Vivaldi, and Brave, tabs opened via "Duplicate Tab" will still be auto-closed because the required browser API is not available on those browsers.

### Priority

Determines which of two duplicate tabs is kept when one must be closed. Rules are applied in this order:

1. Pinned tab preference (if *Keep pinned tab* is enabled)
2. HTTPS preference (if *Keep tab with HTTPS* is enabled)
3. Age-based preference (*Keep older tab* / *Keep newer tab*)

| Option | Default | Description |
| --- | --- | --- |
| **Keep older tab** | ✓ | Keeps the tab that was opened first. |
| **Keep newer tab** | — | Keeps the most recently opened tab. |
| **Keep and reload older tab** | — | Keeps the older tab but reloads it with the newer tab's URL. Useful when the newer URL contains updated content such as a redirect destination. |
| **Keep tab with HTTPS** | ✓ on | When one tab uses HTTP and the other HTTPS for the same URL, the HTTPS tab is kept. Also normalises `http://` to `https://` during URL comparison so the two are treated as duplicates. |
| **Keep pinned tab** | ✓ on | A pinned tab is always kept; the unpinned duplicate is closed instead. |

> The first three options (Keep older tab / Keep newer tab / Keep and reload older tab) are mutually exclusive — only one is active at a time.

### Matching Rules

Controls how two tabs are compared to determine whether they are duplicates.

| Option | Default | Description |
| --- | --- | --- |
| **Ignore case in URL** | off | Treats uppercase and lowercase as equal (`Example.com` = `example.com`). |
| **Ignore 'www' in URL domain name** | off | Treats `www.example.com` and `example.com` as identical. |
| **Ignore hash part in URL** | off | Ignores everything after `#` (`page.html#intro` = `page.html#setup`). Has no effect when *Ignore path part* is enabled. |
| **Ignore search part in URL** | off | Ignores the query string — everything after `?`. Has no effect when *Ignore path part* is enabled. |
| **Ignore path part in URL** | off | Compares only the origin (scheme + domain), ignoring path, query string, and hash. When this is enabled, *Ignore hash part* and *Ignore search part* are redundant. |
| **Compare with title** | off | Two tabs are also considered duplicates when their page titles match (see *% title similarity* below). Useful for pages that display the same title across different URLs. |
| **% title similarity** | 100 | Minimum similarity percentage (1–100) for two titles to be considered a match. `100` requires an exact match (case-insensitive). Only active when *Compare with title* is enabled. |

#### URL Pattern Rules

A list of URL patterns, one per line. Any two open tabs whose URLs both match the same pattern are treated as duplicates — even if their full URLs differ.

Useful for grouping all tabs from a single service as duplicates of each other regardless of the specific path.

**Pattern syntax:** `*` matches any sequence of characters. All other characters match literally.

```text
*://docs.google.com/*
*://github.com/*/pull/*
```

#### Title Pattern Rules

Works identically to URL Pattern Rules but is applied to the page title instead of the URL. Any two tabs whose titles both match the same pattern are treated as duplicates.

**Pattern syntax:** `*` matches any sequence of characters. All other characters match literally.

```text
* - Gmail
GitHub - *
```

> **Pattern syntax note:** The Whitelist, URL Pattern Rules, and Title Pattern Rules all use the same simple wildcard syntax. The only special character is `*`, which matches any sequence of characters (including none). This is **not** full regular expression syntax — characters such as `.`, `+`, `?`, `(`, `)` etc. are matched literally, not as regex metacharacters.

### Scope

Defines which tabs are included when searching for duplicates.

| Value | Default | Browser | Description |
| --- | --- | --- | --- |
| **Active window** | ✓ | All | Searches for duplicates only within the currently focused browser window. |
| **All windows** | — | All | Searches for duplicates across all open browser windows. |
| **Container in active window** | — | **Firefox only** | Duplicates are detected only among tabs that share the same [container](https://support.mozilla.org/en-US/kb/containers) within the active window. Tabs in different containers are never treated as duplicates of each other. |
| **Container in all windows** | — | **Firefox only** | Same as above but searches across all open windows. |

> The **Container** options require Firefox with the [Multi-Account Containers](https://support.mozilla.org/en-US/kb/containers) feature enabled.

### Customization

Available in the **Options page** only.

| Option | Default | Description |
| --- | --- | --- |
| **Theme** | Sky *(default)* | Visual theme for the extension panel. See [Themes](#themes) below. |
| **Duplicate tabs badge color** | `#f22121` (red) | Color of the extension icon badge when duplicate tabs are detected. |
| **No duplicate tabs badge color** | `#1e90ff` (blue) | Color of the badge when no duplicates exist. Only relevant when *Show badge if no duplicate tabs* is enabled. |
| **Show badge if no duplicate tabs** | on | Always displays the badge. When off, the badge is hidden entirely when there are no duplicates. |
| **Close popup after closing duplicate tabs** | off | Automatically closes the popup panel after the *Close all* button is clicked. |
| **Open popup on duplicate detected** | off | Automatically opens the popup panel whenever a new duplicate tab is detected. The Options section collapses automatically when the popup is opened this way, giving more space to the duplicate tabs list. |

#### Themes

11 themes are available from the **Theme** dropdown in the Options page:

**Light themes:** Sky *(default)*, Sage, Rose, Amber, Slate, Violet

**Dark themes:** Ocean Night, Charcoal, Midnight Purple, Dark Teal, OLED Black

### Popup Panel

* **Shrunk mode** — toggle the compress icon in the popup to hide all unpinned sections, keeping the panel compact. Sections can be pinned with the pin icon (📌) in the popup panel so they stay visible when shrunk mode is active.

* **Popup visibility (eye icon)** — in the Options page, each option in the **Matching Rules** section has an eye icon (👁). Enabling it makes the option visible in the popup panel; disabling it hides it.

| Matching Rules option | Visible in popup by default |
| --- | --- |
| Ignore case in URL | No |
| Ignore 'www' in URL domain name | No |
| Ignore hash part in URL | No |
| Ignore search part in URL | No |
| Ignore path part in URL | Yes |
| Compare with title | Yes |
| URL pattern rules | Yes |
| Title pattern rules | No |

### Hotkeys

No default keyboard shortcuts are set to avoid conflicts with browser built-ins.
You can assign custom shortcuts in your browser settings:

| Command | Description |
| --- | --- |
| Close all duplicate tabs | Closes all currently detected duplicate tabs |
| Toggle auto-close / manual mode | Switches between auto-close and manual mode |

To configure shortcuts:

* **Chrome / Edge / Brave / Vivaldi:** open `chrome://extensions/shortcuts`
* **Opera:** open `opera://extensions/shortcuts`
* **Firefox:** open `about:addons`, click the gear icon, then choose *Manage Extension Shortcuts*

## Building

A build script is included that packages the extension for each browser.

**Requirements:** Windows with PowerShell (built-in on Windows 7 and later).

Run from the repository root:

```bat
build\build.bat
```

Or run the PowerShell script directly:

```powershell
# Build both Chrome and Firefox packages (default)
powershell -ExecutionPolicy Bypass -File build\build.ps1

# Build Chrome only
powershell -ExecutionPolicy Bypass -File build\build.ps1 -Target chrome

# Build Firefox only
powershell -ExecutionPolicy Bypass -File build\build.ps1 -Target firefox
```

**Output files** (created in the repository root):

| File | Browser |
| --- | --- |
| `duplicate-tabs-closer-chrome.zip` | Chrome, Edge, Opera, Vivaldi, Brave |
| `duplicate-tabs-closer-firefox.xpi` | Firefox |
