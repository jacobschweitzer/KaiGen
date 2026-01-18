=== KaiGen ===
Contributors:      Jacob Schweitzer
Tags:              block
Tested up to:      6.9
Stable tag:        0.2.9
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Easy way to generate and insert AI images into your posts using OpenAI or Replicate.

== Description ==
Includes a Gutenberg block to insert a prompt that generates an image and inserts an image block into the current post.

== Installation ==
Activate the plugin
Add your OpenAI and/or Replicate API key in Settings -> KaiGen
Choose your Provider from the dropdown

== How To Gen ==
Edit a post
Insert an image block
Click the "KaiGen" button in the block toolbar
Put a prompt into the input box
Click the Generate Image button
View/Edit the inserted image block (the alt text contains the prompt)
Use "Generate Alt Text" in the block inspector to describe the image

Text to image generation times vary by quality, low quality can be ~1 second, medium quality ~10 seconds, and high quality ~30 seconds or more. 
Image to image generation times can take up to 2 minutes. 

== External Services ==

This plugin connects to third-party AI services to generate images and alt text. No data is sent to these services without your explicit action - images are only generated when you click "Generate Image", and alt text is only generated when you click "Generate Alt Text".

= OpenAI API =
* What it is: OpenAI's image generation service
* What data is sent: Your text prompt, selected image parameters (size, quality, etc.), and image data for alt text generation
* When data is sent: Only when you click "Generate Image" or "Generate Alt Text" with OpenAI selected as your provider
* API Endpoint: https://api.openai.com/v1/images/generations, https://api.openai.com/v1/images/edits, and https://api.openai.com/v1/responses
* Terms of Service: https://openai.com/terms/
* Privacy Policy: https://openai.com/privacy/
* Models supported: GPT Image 1.5

= Replicate API =
* What it is: Replicate's machine learning model hosting service for various AI image generation models
* What data is sent: Your text prompt, selected model parameters, and image data for alt text generation
* When data is sent: Only when you click "Generate Image" or "Generate Alt Text" with Replicate selected as your provider
* API Endpoint: https://api.replicate.com/v1/models/ and https://api.replicate.com/v1/predictions/
* Terms of Service: https://replicate.com/terms
* Privacy Policy: https://replicate.com/privacy
* Models supported: low quality (FLUX.2 klein 4B by Black Forest Labs), medium quality (Seedream 4.5 by ByteDance), and high quality (Nano Banana Pro by Google).

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
The build/ directory is committed and used by WordPress at runtime; do not edit it directly.

For development: npm run start
For more details see the README.md file.
