# KaiGen
### Generate and insert AI images into your WordPress posts.

## Description
Includes a WordPress Gutenberg block with a prompt box that generates an image and inserts an image block into the post.

**GitHub Repository:** https://github.com/jacobschweitzer/KaiGen

## Installation
1. [Download KaiGen](https://github.com/jacobschweitzer/KaiGen/releases/download/latest/kaigen.zip)
2. Upload and Activate KaiGen
3. Get API keys for the providers you want to use:
- [OpenAI](https://platform.openai.com/settings/profile?tab=api-keys)
- [Replicate](https://replicate.com/account/api-tokens)
4. Add your API keys in Settings -> KaiGen in the WordPress admin.

## How To Gen
1. Edit a post
2. Insert an image block
3. Click the "KaiGen" button in the block toolbar
4. Put a prompt into the input box
5. Click the Generate Image button
6. View/Edit the inserted image block (the alt text contains the prompt)

## External Services

This plugin connects to third-party AI image generation services to create images based on your prompts. **No data is sent to these services without your explicit action** - images are only generated when you click the "Generate Image" button.

### OpenAI API
- **What it is:** OpenAI's image generation service (DALL-E)
- **What data is sent:** Your text prompt and selected image parameters (size, quality, etc.)
- **When data is sent:** Only when you click "Generate Image" with OpenAI selected as your provider
- **API Endpoint:** `https://api.openai.com/v1/images/generations` and `https://api.openai.com/v1/images/edits`
- **Terms of Service:** [OpenAI Terms of Use](https://openai.com/terms/)
- **Privacy Policy:** [OpenAI Privacy Policy](https://openai.com/privacy/)

### Replicate API
- **What it is:** Replicate's machine learning model hosting service for various AI image generation models
- **What data is sent:** Your text prompt and selected model parameters
- **When data is sent:** Only when you click "Generate Image" with a Replicate model selected as your provider
- **API Endpoint:** `https://api.replicate.com/v1/models/` and `https://api.replicate.com/v1/predictions/`
- **Terms of Service:** [Replicate Terms of Service](https://replicate.com/terms)
- **Privacy Policy:** [Replicate Privacy Policy](https://replicate.com/privacy)

**Important:** You must obtain your own API keys from these services and are responsible for complying with their respective terms of service and privacy policies. The plugin does not collect, store, or transmit any of your data to any other parties.

## Screenshots
![KaiGen logo](https://github.com/user-attachments/assets/6a5a20ac-6c69-4622-adb0-84f77a293ac7)
![1930s style movie marquee, "WP AI IMAGE GEN" is written in neon lights, excited crowd of people waiting outside](https://github.com/user-attachments/assets/11757cae-4bc5-4052-9fd3-ce1a4ef43a4c)
!["Imagen" written in a vintage-style Art Deco with a towering, futuristic rocket launching to space adorned with golden accents, sharp geometric shapes, and sleek lines. The sky is deep red with stylized clouds, evoking a sense of grandeur and optimism. The foreground features a reflective waterfront showing a mirror image of the rocket. The color palette is bold and vibrant, with rich reds, yellows, and deep blues. Include large, bold typography.](https://github.com/user-attachments/assets/39aa472d-8395-4252-9ebd-4a396a96a3b1)


## Models Supported
- [Flux Schnell by Black Forest Labs](https://replicate.com/black-forest-labs/flux-schnell)
- [Recraft V3 by Recraft AI](https://replicate.com/recraft-ai/recraft-v3)
- [Imagen 4 by Google](https://replicate.com/google/imagen-4)
- [GPT Image 1 by OpenAI](https://openai.com/index/image-generation-api)
- [Flux Kontext Pro by Black Forest Labs](https://replicate.com/black-forest-labs/flux-kontext-pro)

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

# Format code
npm run format
```

The build process uses `@wordpress/scripts` which internally uses webpack to bundle and optimize the JavaScript files. Source maps are generated during development builds for debugging.

## Testing

### E2E Testing with Mocked APIs

KaiGen includes comprehensive end-to-end tests that run without making actual API calls. The tests use HTTP mocking to intercept external requests and return predictable responses.

To run e2e tests:

```bash
# Start WordPress Playground with e2e test configuration
npm run playground:start

# In another terminal, run the tests
npm run test:e2e
```

For more details, see [tests/e2e/README.md](tests/e2e/README.md).
