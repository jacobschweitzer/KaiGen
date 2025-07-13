=== KaiGen ===
Contributors:      Jacob Schweitzer
Tags:              block
Tested up to:      6.8
Stable tag:        0.2.1
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Easy way to generate and insert AI images into your posts using OpenAI or Replicate.

== Description ==
Includes a Gutenberg block to insert a prompt that generates an image and inserts an image block into the current post.

== Installation ==
Activate the plugin
Add your OpenAI or Replicate API key in Settings -> KaiGen
Choose your Provider from the dropdown

== How To Gen ==
Edit a post
Insert an image block
Click the "KaiGen" button in the block toolbar
Put a prompt into the input box
Click the Generate Image button
(wait up to 30 seconds - OpenAI API can be slow sometimes)
View/Edit the inserted image block (the alt text contains the prompt)

== External Services ==

This plugin connects to third-party AI image generation services to create images based on your prompts. No data is sent to these services without your explicit action - images are only generated when you click the "Generate Image" button.

= OpenAI API =
* What it is: OpenAI's image generation service (DALL-E)
* What data is sent: Your text prompt and selected image parameters (size, quality, etc.)
* When data is sent: Only when you click "Generate Image" with OpenAI selected as your provider
* API Endpoint: https://api.openai.com/v1/images/generations and https://api.openai.com/v1/images/edits
* Terms of Service: https://openai.com/terms/
* Privacy Policy: https://openai.com/privacy/

= Replicate API =
* What it is: Replicate's machine learning model hosting service for various AI image generation models
* What data is sent: Your text prompt and selected model parameters
* When data is sent: Only when you click "Generate Image" with a Replicate model selected as your provider
* API Endpoint: https://api.replicate.com/v1/models/ and https://api.replicate.com/v1/predictions/
* Terms of Service: https://replicate.com/terms
* Privacy Policy: https://replicate.com/privacy

Important: You must obtain your own API keys from these services and are responsible for complying with their respective terms of service and privacy policies. The plugin does not collect, store, or transmit any of your data to any other parties.

== Source Code ==

All compressed/minified JavaScript files have their human-readable source code available:

**Compressed Files → Source Files:**
* build/index.js → Source files in src/ directory
* build/admin.js → src/admin.js

**Source Code Location:**
The complete human-readable source code is available in the src/ directory of this plugin and on GitHub: https://github.com/jacobschweitzer/KaiGen

**Build Process:**
This plugin uses @wordpress/scripts build system. To build from source:
1. Install Node.js and npm
2. Run: npm install
3. Run: npm run build

For development: npm run start
For more details see the README.md file.

== Screenshots ==
![Screenshot](https://github.com/jacobschweitzer/kaigen/edit/main/assets/image.jpg?raw=true)
