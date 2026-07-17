# KaiGen
### Generate and insert AI images into your WordPress posts.

## Description
Includes a WordPress Gutenberg block with a prompt box that generates an image and inserts an image block into the post.

**GitHub Repository:** https://github.com/jacobschweitzer/KaiGen

## Installation
1. [Download KaiGen](https://github.com/jacobschweitzer/KaiGen/releases/latest)
2. Upload and Activate KaiGen
3. Install and configure the WordPress AI Client and at least one image-capable AI provider plugin.
4. Configure API keys or credentials in the provider plugin's settings.

## Releases and Deployment

### Release Strategy
- **Versioned Releases**: Created when version tags are pushed (e.g., `v0.1.9`, `v0.2.0`)
- **WordPress.org Deployment**: Automatic deployment to WordPress.org plugin repository when version tags are pushed

### GitHub Actions Workflow
The project uses [WordPress Plugin Deploy](https://github.com/marketplace/actions/wordpress-plugin-deploy) action for:
- Automated file exclusion using `.distignore`
- ZIP file generation
- WordPress.org repository deployment
- GitHub release creation

File exclusion is managed by `.distignore` which excludes development files like:
- Source files (`/src`)
- Tests (`/tests`, `/playwright`)
- Node modules (`/node_modules`)
- Configuration files (`package.json`, `tests/e2e/playwright.config.ts`)
- Development documentation (`README.md`, `AGENTS.md`)

### Creating a New Release
To create a new versioned release:

1. Update the version number in all files:
   - `kaigen.php`: `Version:           0.2.0`
   - `readme.txt`: `Stable tag:        0.2.0`  
   - `package.json`: `"version": "0.2.0"`

2. Commit and push to main:
   ```bash
   git add .
   git commit -m "Bump version to 0.2.0"
   git push origin main
   ```

3. The GitHub Actions workflow will automatically:
   - Create a version tag (e.g., `v0.2.0`) if it doesn't exist
   - Deploy to WordPress.org plugin repository (when the tag is created)
   - Create a GitHub release with attached ZIP file

## How To Gen
1. Edit a post
2. Insert an image block
3. Click the "KaiGen" button in the block toolbar
4. Put a prompt into the input box
5. Click the Generate Image button

## External Services

KaiGen generates images through the WordPress AI Client and whichever image-capable provider plugins you have configured. **No generation request is sent without your explicit action** - prompts and selected reference images are sent only when you click the Generate Image button.

The provider plugin selected in KaiGen, or the provider chosen automatically by the WordPress AI Client, may send your prompt, selected image parameters, and selected reference image files to its third-party service. Review the active provider plugin's documentation for its service endpoints, terms, and privacy policy.

**Important:** You must obtain and configure any required API keys in your provider plugins and are responsible for complying with those providers' terms of service and privacy policies. KaiGen does not collect third-party API keys.

## Screenshots
![KaiGen logo](https://github.com/user-attachments/assets/6a5a20ac-6c69-4622-adb0-84f77a293ac7)
![1930s style movie marquee, "WP AI IMAGE GEN" is written in neon lights, excited crowd of people waiting outside](https://github.com/user-attachments/assets/11757cae-4bc5-4052-9fd3-ce1a4ef43a4c)
!["Imagen" written in a vintage-style Art Deco with a towering, futuristic rocket launching to space adorned with golden accents, sharp geometric shapes, and sleek lines. The sky is deep red with stylized clouds, evoking a sense of grandeur and optimism. The foreground features a reflective waterfront showing a mirror image of the rocket. The color palette is bold and vibrant, with rich reds, yellows, and deep blues. Include large, bold typography.](https://github.com/user-attachments/assets/39aa472d-8395-4252-9ebd-4a396a96a3b1)


## Models Supported
KaiGen supports image-generation-capable providers and models registered with the WordPress AI Client. The available provider list is discovered at runtime from your configured provider plugins.

## Source Code

### Human-Readable Source Files

All compressed/minified JavaScript files in the `build/` directory have their human-readable source code available in the `src/` directory:

**Compressed Files → Source Files:**
- `build/index.js` → Source files in `src/` directory

**Source Code Structure:**
```
src/
├── index.js              # Main entry point
├── api.js                # API communication layer
├── components/
│   ├── AITab.js          # AI generation tab component
│   ├── AIImageToolbar.js # Image block toolbar integration
│   └── GenerateImageModal.js
├── filters/
│   ├── addBlockEditFilter.js     # Block editor modifications
│   ├── addMediaPlaceholderFilter.js
│   └── mediaUtils.js
├── hooks/
│   └── useGenerationProgress.js
└── utils/
    └── kaigenSettings.js
```

### Build Process

This plugin uses the WordPress Scripts build system. To build from source:

**Prerequisites:**
- Node.js (v18.12.0 or higher)
- npm (v8.19.2 or higher)

**Build Commands:**
```bash
# Install dependencies
npm install

# Build all files (development)
npm run start

# Build all files (production)
npm run build

# Build specific files
npm run build:main   # Builds src/index.js
```

**Development:**
```bash
# Start development server with hot reload
npm run start

# Lint JavaScript
npm run lint:js

# Fix JavaScript (auto-fixes issues where possible)
npm run lint:js:fix

# Format code
npm run format
```

The build process uses `@wordpress/scripts` which internally uses webpack to bundle and optimize the JavaScript files. Source maps are generated during development builds for debugging.
The `build/` directory is committed and used by WordPress at runtime; do not edit it directly.

## Testing

### E2E Testing

KaiGen includes end-to-end tests that run in WordPress Playground without calling real external AI providers. The Playground blueprint injects test provider settings for the editor UI.

To run e2e tests, Playwright starts WordPress Playground automatically:

```bash
npm ci --prefix tests/e2e
npm run test:e2e
```

Optional manual start (useful for debugging in the browser):

```bash
PLAYGROUND_PORT=9411 npm run playground:start
PLAYGROUND_PORT=9411 PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e
```

For more details, see [tests/e2e/AGENTS.md](tests/e2e/AGENTS.md).
