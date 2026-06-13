=== KaiGen ===
Contributors:      Jacob Schweitzer
Tags:              block
Tested up to:      7.0
Stable tag:        0.2.11
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Easy way to generate and insert AI images into your posts using the WordPress AI Client.

== Description ==
Includes a Gutenberg block to insert a prompt that generates an image and inserts an image block into the current post.

== Installation ==
Activate the plugin
Install and configure the WordPress AI Client and at least one image-capable AI provider plugin
Configure API keys or credentials in the provider plugin's settings
Choose a provider from the KaiGen dropdown, or leave it on Auto

== How To Gen ==
Edit a post
Insert an image block
Click the "KaiGen" button in the block toolbar
Put a prompt into the input box
Click the Generate Image button
View/Edit the inserted image block (the alt text contains the prompt)

Text to image generation times vary by provider and model.
Image to image generation times can take up to 2 minutes. 

== External Services ==

KaiGen generates images through the WordPress AI Client and whichever image-capable provider plugins you have configured. No generation request is sent without your explicit action - prompts and selected reference images are sent only when you click the Generate Image button.

The provider plugin selected in KaiGen, or the provider chosen automatically by the WordPress AI Client, may send your prompt, selected image parameters, and selected reference image files to its third-party service. Review the active provider plugin's documentation for its service endpoints, terms, and privacy policy.

Important: You must obtain and configure any required API keys in your provider plugins and are responsible for complying with those providers' terms of service and privacy policies. KaiGen does not collect third-party API keys.

== Source Code ==

All compressed/minified JavaScript files have their human-readable source code available:

**Compressed Files → Source Files:**
* build/index.js → Source files in src/ directory

**Source Code Location:**
The complete human-readable source code is available in the src/ directory of this plugin and on GitHub: https://github.com/jacobschweitzer/KaiGen

**Build Process:**
This plugin uses @wordpress/scripts build system. To build from source:
1. Install Node.js 18.12.0 or higher and npm 8.19.2 or higher
2. Run: npm install
3. Run: npm run build
The build/ directory is committed and used by WordPress at runtime; do not edit it directly.

For development: npm run start
For more details see the README.md file.
