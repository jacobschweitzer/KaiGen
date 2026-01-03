# KaiGen
### Generate and insert AI images into your WordPress posts.

## Description
Includes a WordPress Gutenberg block with a prompt box that generates an image and inserts an image block into the post.

**GitHub Repository:** https://github.com/jacobschweitzer/KaiGen

## Installation
1. [Download KaiGen](https://github.com/jacobschweitzer/KaiGen/releases/latest)
2. Upload and Activate KaiGen
3. Get API keys for the providers you want to use:
- [OpenAI](https://platform.openai.com/settings/profile?tab=api-keys)
- [Replicate](https://replicate.com/account/api-tokens)
4. Add your API keys in Settings -> KaiGen in the WordPress admin.

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
- Configuration files (`package.json`, `playwright.config.ts`)
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

This plugin connects to third-party AI services to generate images and alt text. **No data is sent to these services without your explicit action** - images are only generated when you click "Generate Image", and alt text is only generated when you click "Generate Alt Text".

### OpenAI API
- **What it is:** OpenAI's image generation service (GPT-Image)
- **What data is sent:** Your text prompt, selected image parameters (size, quality, etc.), and image data for alt text generation
- **When data is sent:** Only when you click "Generate Image" or "Generate Alt Text" with OpenAI selected as your provider
- **API Endpoint:** `https://api.openai.com/v1/images/generations`, `https://api.openai.com/v1/images/edits`, and `https://api.openai.com/v1/responses`
- **Terms of Service:** [OpenAI Terms of Use](https://openai.com/terms/)
- **Privacy Policy:** [OpenAI Privacy Policy](https://openai.com/privacy/)

### Replicate API
- **What it is:** Replicate's machine learning model hosting service for various AI image generation models
- **What data is sent:** Your text prompt, selected model parameters, and image data for alt text generation
- **When data is sent:** Only when you click "Generate Image" or "Generate Alt Text" with Replicate selected as your provider
- **API Endpoint:** `https://api.replicate.com/v1/models/` and `https://api.replicate.com/v1/predictions/`
- **Terms of Service:** [Replicate Terms of Service](https://replicate.com/terms)
- **Privacy Policy:** [Replicate Privacy Policy](https://replicate.com/privacy)

**Important:** You must obtain your own API keys from these services and are responsible for complying with their respective terms of service and privacy policies. The plugin does not collect, store, or transmit any of your data to any other parties.

## Screenshots
![KaiGen logo](https://github.com/user-attachments/assets/6a5a20ac-6c69-4622-adb0-84f77a293ac7)
![1930s style movie marquee, "WP AI IMAGE GEN" is written in neon lights, excited crowd of people waiting outside](https://github.com/user-attachments/assets/11757cae-4bc5-4052-9fd3-ce1a4ef43a4c)
!["Imagen" written in a vintage-style Art Deco with a towering, futuristic rocket launching to space adorned with golden accents, sharp geometric shapes, and sleek lines. The sky is deep red with stylized clouds, evoking a sense of grandeur and optimism. The foreground features a reflective waterfront showing a mirror image of the rocket. The color palette is bold and vibrant, with rich reds, yellows, and deep blues. Include large, bold typography.](https://github.com/user-attachments/assets/39aa472d-8395-4252-9ebd-4a396a96a3b1)


## Models Supported
- [HiDream-I1 Fast by PrunaAI (low quality)](https://replicate.com/prunaai/hidream-l1-fast)
- [Seedream 4.5 by ByteDance (medium quality)](https://replicate.com/bytedance/seedream-4.5)
- [Nano Banana Pro by Google (high quality)](https://replicate.com/google/nano-banana-pro)
- [GPT Image 1.5 by OpenAI](https://platform.openai.com/docs/guides/images)

## Source Code

### Human-Readable Source Files

All compressed/minified JavaScript files in the `build/` directory have their human-readable source code available in the `src/` directory:

**Compressed Files → Source Files:**
- `build/index.js` → Source files in `src/` directory
- `build/admin.js` → `src/admin.js`

**Source Code Structure:**
```
src/
├── index.js              # Main entry point
├── admin.js              # Admin panel functionality  
├── api.js                # API communication layer
├── components/
│   ├── AITab.js          # AI generation tab component
│   └── AIImageToolbar.js # Image block toolbar integration
└── filters/
    ├── addBlockEditFilter.js     # Block editor modifications
    ├── addMediaUploadFilter.js   # Media upload integration
    └── registerFormatType.js     # Format type registration
```

### Build Process

This plugin uses the WordPress Scripts build system. To build from source:

**Prerequisites:**
- Node.js (v16 or higher)
- npm

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
npm run build:admin  # Builds src/admin.js
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

### E2E Testing with Mocked APIs

KaiGen includes comprehensive end-to-end tests that run without making actual API calls. The tests use HTTP mocking to intercept external requests and return predictable responses.

To run e2e tests, Playwright starts WordPress Playground automatically:

```bash
npm run test:e2e
```

Optional manual start (useful for debugging in the browser):

```bash
npm run playground:start
npm run test:e2e
```

For more details, see [tests/e2e/README.md](tests/e2e/README.md).
