/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/api.js":
/*!********************!*\
  !*** ./src/api.js ***!
  \********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   generateImage: () => (/* binding */ generateImage)
/* harmony export */ });
// This file provides API functions for generating AI images.

/**
 * Generates an AI image based on the given prompt and optional parameters.
 *
 * @param {string} prompt - The text prompt for image generation.
 * @param {function} callback - The callback function to handle the generated image data.
 * @param {Object} [options] - Optional parameters for image generation.
 * @param {string} [options.sourceImageUrl] - URL of the source image for image-to-image generation.
 * @param {string[]} [options.additionalImageUrls] - Array of additional source image URLs (for GPT Image-1 only).
 * @param {string} [options.maskUrl] - URL of mask image for inpainting (for GPT Image-1 only).
 * @param {string} [options.moderation] - Moderation level: 'auto' or 'low' (for GPT Image-1 only).
 * @param {string} [options.style] - Style parameter: 'natural' or 'vivid' (for GPT Image-1 only).
 * @returns {Promise<void>} A promise that resolves when the image generation is complete.
 */
const generateImage = async (prompt, callback, options = {}) => {
  try {
    // Get the provider setting from editor settings
    const provider = wp.data.select('core/editor')?.getEditorSettings()?.kaigen_provider;
    if (!provider) {
      throw new Error('No provider configured. Please check your plugin settings.');
    }
    const data = {
      prompt,
      provider: provider
    };

    // Add source image URL if provided
    if (options.sourceImageUrl) {
      data.source_image_url = options.sourceImageUrl;
    }

    // Add array of additional image URLs if provided
    if (options.additionalImageUrls && Array.isArray(options.additionalImageUrls)) {
      data.additional_image_urls = options.additionalImageUrls;
    }

    // Add mask URL if provided for inpainting
    if (options.maskUrl) {
      data.mask_url = options.maskUrl;
    }

    // Add moderation level if provided
    if (options.moderation && ['auto', 'low'].includes(options.moderation)) {
      data.moderation = options.moderation;
    }

    // Add style if provided
    if (options.style && ['natural', 'vivid'].includes(options.style)) {
      data.style = options.style;
    }
    const response = await wp.apiFetch({
      path: '/kaigen/v1/generate-image',
      method: 'POST',
      data: data
    });

    // Handle WP_Error responses which come back as objects with 'code' and 'message' properties
    if (response.code && response.message) {
      // Special handling for content moderation errors
      if (response.code === 'content_moderation') {
        throw new Error(response.message);
      }
      // Handle other specific error codes as needed
      if (response.code === 'replicate_error') {
        throw new Error('Image generation failed: ' + response.message);
      }
      // Generic error handling for other WP_Error responses
      throw new Error(response.message);
    }

    // Handle successful response with URL
    if (response && response.url) {
      // Check if we have a valid WordPress media ID (a number greater than 0)
      if (response.id && typeof response.id === 'number' && response.id > 0) {
        // This is a WordPress media library attachment with a valid ID
        callback({
          url: response.url,
          alt: prompt,
          id: response.id,
          // Use the actual WordPress media ID
          caption: ''
        });
      } else {
        // This is just a URL with no valid WordPress media ID
        // Create an object without an ID to prevent 404 errors
        callback({
          url: response.url,
          alt: prompt,
          caption: ''
          // Omit the id property completely
        });
      }
    } else {
      // Handle invalid response format
      throw new Error('Invalid response from server: ' + JSON.stringify(response));
    }
  } catch (error) {
    // Log detailed error information
    console.error('Image generation failed:', error);
    if (error.message) console.error('Error message:', error.message);
    if (error.stack) console.error('Error stack:', error.stack);

    // Pass the error back to the callback
    callback({
      error: error.message || 'An unknown error occurred while generating the image'
    });
  }
};

/***/ }),

/***/ "./src/components/AIImageToolbar.js":
/*!******************************************!*\
  !*** ./src/components/AIImageToolbar.js ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/components */ "@wordpress/components");
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__);

// This file contains the AIImageToolbar component used in block toolbars for AI image actions.




/**
 * AIImageToolbar component for adding AI image generation or regeneration buttons.
 *
 * @param {Object} props - Component properties.
 * @param {boolean} props.isGenerating - Indicates if an image is currently being generated.
 * @param {Function} props.onGenerateImage - Callback to handle image generation.
 * @param {boolean} [props.isRegenerating] - Indicates if an image is being regenerated.
 * @param {Function} [props.onRegenerateImage] - Callback to handle image regeneration.
 * @param {boolean} [props.isImageBlock] - Determines if the current block is an image block.
 * @param {boolean} [props.isTextSelected] - Determines if text is selected to trigger generation.
 * @param {boolean} [props.supportsImageToImage] - Indicates if the current provider supports image-to-image generation.
 * @returns {JSX.Element|null} Returns the toolbar with the appropriate button or null if conditions are unmet.
 */
const AIImageToolbar = ({
  isGenerating,
  onGenerateImage,
  isRegenerating,
  onRegenerateImage,
  isImageBlock,
  isTextSelected,
  supportsImageToImage
}) => {
  const [isModalOpen, setIsModalOpen] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const [prompt, setPrompt] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)('');
  const [error, setError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
  const handleRegenerate = () => {
    onRegenerateImage(prompt.trim());
    setIsModalOpen(false);
    setPrompt('');
    setError(null);
  };

  // Render a regenerate button if the current block is an image block.
  if (isImageBlock) {
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.ToolbarGroup, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.ToolbarButton, {
      icon: isRegenerating ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Spinner, null) : "update",
      label: isRegenerating ? "KaiGen is generating..." : "KaiGen",
      onClick: () => setIsModalOpen(true),
      disabled: isRegenerating
    })), isModalOpen && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Modal, {
      title: "KaiGen : Edit Image",
      onRequestClose: () => {
        setIsModalOpen(false);
        setPrompt('');
        setError(null);
      }
    }, error && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
      style: {
        color: 'red'
      }
    }, error), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.TextareaControl, {
      label: "Editing Instructions (optional)",
      value: prompt,
      onChange: setPrompt,
      rows: 4
    }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Button, {
      variant: "primary",
      onClick: handleRegenerate,
      disabled: isRegenerating
    }, isRegenerating ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Spinner, null), "Regenerating...") : 'Regenerate Image')));
  }
  // Render a generate button if text is selected.
  else if (isTextSelected) {
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.ToolbarGroup, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.ToolbarButton, {
      icon: isGenerating ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Spinner, null) : "format-image",
      label: isGenerating ? "KaiGen is generating..." : "KaiGen",
      onClick: onGenerateImage,
      disabled: isGenerating
    }));
  }
  return null;
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AIImageToolbar);

/***/ }),

/***/ "./src/components/AITab.js":
/*!*********************************!*\
  !*** ./src/components/AITab.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/components */ "@wordpress/components");
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../api */ "./src/api.js");

// This file contains the AITab React component used to generate AI images through a modal.

 // Import WordPress hooks.
 // Import necessary UI components.
 // Import API functions.

/**
 * AITab component for generating AI images.
 *
 * @param {Object} props - The properties object.
 * @param {function} props.onSelect - The callback function to handle the selected image.
 * @param {boolean} props.shouldDisplay - Flag indicating whether to render the AITab.
 * @returns {JSX.Element|null} The rendered AITab component or null if not displayed.
 */
const AITab = ({
  onSelect,
  shouldDisplay
}) => {
  // This is the AITab functional component.
  // State for modal visibility, prompt text, loading indicator, and error message.
  const [isModalOpen, setIsModalOpen] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false); // Indicates if the modal is open.
  const [prompt, setPrompt] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(''); // Stores the image prompt.
  const [isLoading, setIsLoading] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false); // Indicates if image generation is in progress.
  const [error, setError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(null); // Holds any error messages.

  /**
   * Handles the image generation process when the Generate button is clicked.
   *
   * @returns {void}
   */
  const handleGenerate = () => {
    // This function handles the generation of an AI image.
    // Check if the prompt is empty or consists solely of whitespace.
    if (!prompt.trim()) {
      setError('Please enter a prompt for image generation.');
      return;
    }
    setIsLoading(true); // Start loading state.
    setError(null); // Clear any previous errors.

    // Call generateImage API function with the prompt
    (0,_api__WEBPACK_IMPORTED_MODULE_3__.generateImage)(prompt.trim(), media => {
      if (media.error) {
        setError(media.error); // Set error if generation fails.
        setIsLoading(false); // End loading state.
      } else {
        onSelect(media); // Pass image media back to the parent.
        setIsLoading(false); // End loading state.
        setIsModalOpen(false); // Close the modal.
      }
    });
  };

  // Do not render the component if shouldDisplay is false.
  if (!shouldDisplay) {
    return null;
  }
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "block-editor-media-placeholder__url-input-container"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Button, {
    variant: "secondary",
    onClick: () => setIsModalOpen(true),
    className: "components-button is-next-40px-default-size is-secondary"
  }, "KaiGen")), isModalOpen && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Modal, {
    title: "KaiGen" // Modal title.
    ,
    onRequestClose: () => setIsModalOpen(false) // Closes the modal.
  }, error && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    style: {
      color: 'red'
    }
  }, error), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.TextareaControl, {
    label: "Prompt",
    value: prompt,
    onChange: setPrompt // Updates the prompt state.
    ,
    rows: 4
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Button, {
    variant: "primary" // Uses primary styling.
    ,
    onClick: handleGenerate // Initiates image generation.
    ,
    disabled: isLoading || !prompt.trim() // Disables button if conditions are not met.
  }, isLoading ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Spinner, null), " ", "KaiGen is generating...") : 'KaiGen')));
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AITab); // Export the AITab component.

/***/ }),

/***/ "./src/core-image-modifications.js":
/*!*****************************************!*\
  !*** ./src/core-image-modifications.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./api */ "./src/api.js");
/* harmony import */ var _components_AITab__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./components/AITab */ "./src/components/AITab.js");
/* harmony import */ var _components_AIImageToolbar__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./components/AIImageToolbar */ "./src/components/AIImageToolbar.js");
/* harmony import */ var _filters_registerFormatType__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./filters/registerFormatType */ "./src/filters/registerFormatType.js");
/* harmony import */ var _filters_addMediaUploadFilter__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./filters/addMediaUploadFilter */ "./src/filters/addMediaUploadFilter.js");
/* harmony import */ var _filters_addBlockEditFilter__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./filters/addBlockEditFilter */ "./src/filters/addBlockEditFilter.js");
// This is the main entry point for the AI image generation modifications.
// It imports the API functions, components, and filters so that they are registered and active.

 // Import API functions.
 // Import the AITab component.
 // Import the toolbar component.
 // Register the rich-text format type.
 // Enhance the MediaUpload component.
 // Enhance the BlockEdit (image regeneration) functionality.

/***/ }),

/***/ "./src/filters/addBlockEditFilter.js":
/*!*******************************************!*\
  !*** ./src/filters/addBlockEditFilter.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/hooks */ "@wordpress/hooks");
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @wordpress/block-editor */ "@wordpress/block-editor");
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _components_AIImageToolbar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../components/AIImageToolbar */ "./src/components/AIImageToolbar.js");
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../api */ "./src/api.js");

// This file modifies the block editor for core/image blocks to include an AI image regeneration button.

 // Import the addFilter function.
 // Import necessary React hooks.
 // Import BlockControls for toolbar.
 // Import the AIImageToolbar component.
 // Import API functions for image generation.

/**
 * Enhances the core/image block with an AI image regeneration button.
 *
 * @param {function} BlockEdit - The original BlockEdit component.
 * @returns {function} A new BlockEdit component with additional regeneration functionality.
 */
(0,_wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__.addFilter)('editor.BlockEdit', 'kaigen/add-regenerate-button', BlockEdit => {
  // Return a new functional component that wraps the original BlockEdit.
  return props => {
    // Only modify core/image blocks.
    if (props.name !== 'core/image') {
      return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(BlockEdit, {
        ...props
      });
    }

    // State to manage regeneration progress and errors.
    const [isRegenerating, setIsRegenerating] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)(false); // Indicates if regeneration is in progress.
    const [error, setError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)(null); // Holds error messages if any.
    const [supportsImageToImage, setSupportsImageToImage] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)(false); // Whether provider supports image-to-image

    // Initialize the provider from settings on component mount.
    (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
      const initializeProvider = async () => {
        try {
          // Get the provider from localized data
          const provider = window.kaiGen?.provider;
          if (!provider) {
            console.error('No provider configured in localized data');
            return;
          }

          // Only OpenAI's gpt-image-1 supports image-to-image
          setSupportsImageToImage(provider === 'openai');
        } catch (err) {
          console.error('Failed to initialize provider:', err);
        }
      };

      // Start initialization immediately
      initializeProvider();
    }, []);

    /**
     * Handles the AI image regeneration process for the current image block.
     *
     * @param {string} prompt - The prompt for image modification.
     * @returns {Promise<void>} A promise that resolves when regeneration is complete.
     */
    const handleRegenerateImage = async prompt => {
      setError(null); // Clear any previous errors.

      // Use alt text as fallback if no prompt is provided
      const finalPrompt = prompt || props.attributes.alt || "no alt text or prompt, please just enhance";

      // Get the provider from localized data
      const provider = window.kaiGen?.provider;
      if (!provider) {
        console.error('No provider configured');
        wp.data.dispatch('core/notices').createErrorNotice('No AI provider configured. Please check your plugin settings.', {
          type: 'snackbar'
        });
        return;
      }
      setIsRegenerating(true); // Indicate that regeneration is starting.

      try {
        // Get the source image URL if available
        const sourceImageUrl = props.attributes.url;

        // Set up options for image generation
        const options = {};
        if (supportsImageToImage && sourceImageUrl) {
          options.sourceImageUrl = sourceImageUrl;
        } else if (supportsImageToImage && !sourceImageUrl) {
          console.warn('Image-to-image requested but no source image URL available');
          wp.data.dispatch('core/notices').createWarningNotice('Image-to-image generation requires a source image. Please ensure the image is properly loaded.', {
            type: 'snackbar'
          });
        }

        // Wrap the generateImage call in a promise.
        const result = await new Promise((resolve, reject) => {
          (0,_api__WEBPACK_IMPORTED_MODULE_5__.generateImage)(finalPrompt, result => {
            if (result.error) {
              reject(new Error(result.error));
            } else {
              resolve(result);
            }
          }, options);
        });

        // Update the block attributes with the new image data.
        if (result.id && typeof result.id === 'number' && result.id > 0) {
          props.setAttributes({
            url: result.url,
            id: result.id
          });
        } else {
          props.setAttributes({
            url: result.url,
            id: undefined
          });
        }
        wp.data.dispatch('core/notices').createSuccessNotice('Image regenerated successfully!', {
          type: 'snackbar'
        });
      } catch (err) {
        console.error('Image regeneration failed:', err);
        let errorMessage = err.message || 'Unknown error';
        let actionGuidance = '';
        if (errorMessage.includes('organization verification')) {
          actionGuidance = ' Please verify your organization in the OpenAI dashboard.';
        } else if (errorMessage.includes('parameter')) {
          errorMessage = 'API configuration error. Please contact the plugin developer.';
        } else if (errorMessage.includes('content policy')) {
          actionGuidance = ' Try a different prompt.';
        }
        wp.data.dispatch('core/notices').createErrorNotice('Failed to regenerate image: ' + errorMessage + actionGuidance, {
          type: 'snackbar'
        });
      } finally {
        setIsRegenerating(false);
      }
    };
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(BlockEdit, {
      ...props
    }), supportsImageToImage && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_3__.BlockControls, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_AIImageToolbar__WEBPACK_IMPORTED_MODULE_4__["default"], {
      isRegenerating: isRegenerating,
      onRegenerateImage: handleRegenerateImage,
      isImageBlock: true,
      supportsImageToImage: supportsImageToImage
    })));
  };
});

/***/ }),

/***/ "./src/filters/addMediaUploadFilter.js":
/*!*********************************************!*\
  !*** ./src/filters/addMediaUploadFilter.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/hooks */ "@wordpress/hooks");
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _components_AITab__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../components/AITab */ "./src/components/AITab.js");

// This file enhances the MediaUpload component by adding the AITab for AI image generation.

 // Import the addFilter function.
 // Import the AITab component.

/**
 * Enhances the MediaUpload component by adding the AITab.
 *
 * @param {Object} props - Properties passed to the MediaUpload component.
 * @returns {JSX.Element} The enhanced MediaUpload component with the AITab.
 */
(0,_wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__.addFilter)('editor.MediaUpload', 'kaigen/add-ai-tab', OriginalMediaUpload => {
  // Return a new component which wraps the original MediaUpload.
  return props => {
    // Check if the MediaUpload is used for a single image block.
    const isSingleImageBlock = props.allowedTypes && props.allowedTypes.includes('image') && !props.multiple;

    // Retrieve the currently selected block from the editor.
    const selectedBlock = wp.data.select('core/block-editor').getSelectedBlock();
    // Determine if the block is an image block.
    const isImageBlock = selectedBlock && selectedBlock.name === 'core/image';

    /**
     * Checks if the current block already has image data.
     *
     * @returns {boolean} True if the block has an image, otherwise false.
     */
    const hasImageData = () => {
      return selectedBlock && selectedBlock.attributes && selectedBlock.attributes.url;
    };

    // Only display AITab if this is a single image block without image data.
    const shouldDisplay = isSingleImageBlock && isImageBlock && !hasImageData();
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(OriginalMediaUpload, {
      ...props,
      render: originalProps => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, props.render(originalProps), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_AITab__WEBPACK_IMPORTED_MODULE_2__["default"], {
        onSelect: props.onSelect,
        shouldDisplay: shouldDisplay
      }))
    });
  };
});

/***/ }),

/***/ "./src/filters/registerFormatType.js":
/*!*******************************************!*\
  !*** ./src/filters/registerFormatType.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/block-editor */ "@wordpress/block-editor");
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @wordpress/data */ "@wordpress/data");
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_wordpress_data__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _wordpress_rich_text__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @wordpress/rich-text */ "@wordpress/rich-text");
/* harmony import */ var _wordpress_rich_text__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_wordpress_rich_text__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _components_AIImageToolbar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../components/AIImageToolbar */ "./src/components/AIImageToolbar.js");
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../api */ "./src/api.js");

// This file registers a new rich-text format which uses BlockControls to trigger AI image generation.

 // Import React hooks.
 // Import BlockControls from the block editor.
 // Import necessary data hooks.
 // Import registerFormatType.
 // Import the AIImageToolbar component.
 // Import API function for image generation.

/**
 * Registers the AI Image Generation format type and integrates BlockControls.
 *
 * @returns {void}
 */
(0,_wordpress_rich_text__WEBPACK_IMPORTED_MODULE_4__.registerFormatType)('kaigen/custom-format', {
  title: 'AI Image Gen',
  tagName: 'span',
  className: 'kaigen-format',
  edit: ({
    isActive,
    value,
    onChange
  }) => {
    // This edit function adds AI image functionality to the block.
    // Create state for generation state.
    const [isGenerating, setIsGenerating] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false); // Indicates if an image is being generated.

    // Retrieve the currently selected block.
    const selectedBlock = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_3__.useSelect)(select => select('core/block-editor').getSelectedBlock(), []);
    // Get the dispatch function to replace blocks.
    const {
      replaceBlocks
    } = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_3__.useDispatch)('core/block-editor');

    /**
     * Handles the AI image generation process based on the selected text.
     *
     * @returns {void}
     */
    const handleGenerateImage = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
      // This function manages image generation.
      if (selectedBlock && selectedBlock.name === 'core/paragraph') {
        // Extract the currently selected text.
        const selectedText = value.text.slice(value.start, value.end).trim();
        if (!selectedText) {
          // Create an error notice if no text is selected.
          wp.data.dispatch('core/notices').createErrorNotice('Please select some text to use as the image generation prompt.', {
            type: 'snackbar'
          });
          return;
        }

        // Get the provider from editor settings
        const provider = wp.data.select('core/editor')?.getEditorSettings()?.kaigen_provider;
        if (!provider) {
          wp.data.dispatch('core/notices').createErrorNotice('No AI provider configured. Please set one in the plugin settings.', {
            type: 'snackbar'
          });
          return;
        }

        // Create a placeholder block to show that image generation is in progress.
        const placeholderBlock = wp.blocks.createBlock('core/heading', {
          content: 'Generating AI image...',
          level: 2,
          style: {
            textAlign: 'center'
          }
        });
        // Replace the selected block with the placeholder.
        replaceBlocks(selectedBlock.clientId, [placeholderBlock, selectedBlock]);
        setIsGenerating(true); // Set generating state.

        // Call the API function to generate the image.
        (0,_api__WEBPACK_IMPORTED_MODULE_6__.generateImage)(selectedText, result => {
          setIsGenerating(false); // Reset generating state.

          if (result.error) {
            console.error('Image generation failed:', result.error);
            wp.data.dispatch('core/notices').createErrorNotice('Failed to generate image: ' + result.error, {
              type: 'snackbar'
            });
            // Remove the placeholder block on error.
            replaceBlocks(placeholderBlock.clientId, []);
          } else {
            // Create a new image block with the image details
            let blockAttributes = {
              url: result.url,
              alt: result.alt,
              caption: ''
            };

            // Only add ID attribute if it's a valid WordPress media ID
            if (result.id && typeof result.id === 'number' && result.id > 0) {
              blockAttributes.id = result.id;
            }
            const imageBlock = wp.blocks.createBlock('core/image', blockAttributes);
            // Replace the placeholder with the new image block.
            replaceBlocks(placeholderBlock.clientId, [imageBlock]);
          }
        });
      }
    }, [selectedBlock, value.text, value.start, value.end, replaceBlocks]);

    // Determine if any text is selected.
    const selectedText = value.text.slice(value.start, value.end).trim();
    const isTextSelected = selectedText !== "";
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_2__.BlockControls, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_AIImageToolbar__WEBPACK_IMPORTED_MODULE_5__["default"], {
      isGenerating: isGenerating,
      onGenerateImage: handleGenerateImage,
      isTextSelected: isTextSelected
    }));
  }
});

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "React" ***!
  \************************/
/***/ ((module) => {

module.exports = window["React"];

/***/ }),

/***/ "@wordpress/block-editor":
/*!*************************************!*\
  !*** external ["wp","blockEditor"] ***!
  \*************************************/
/***/ ((module) => {

module.exports = window["wp"]["blockEditor"];

/***/ }),

/***/ "@wordpress/components":
/*!************************************!*\
  !*** external ["wp","components"] ***!
  \************************************/
/***/ ((module) => {

module.exports = window["wp"]["components"];

/***/ }),

/***/ "@wordpress/data":
/*!******************************!*\
  !*** external ["wp","data"] ***!
  \******************************/
/***/ ((module) => {

module.exports = window["wp"]["data"];

/***/ }),

/***/ "@wordpress/element":
/*!*********************************!*\
  !*** external ["wp","element"] ***!
  \*********************************/
/***/ ((module) => {

module.exports = window["wp"]["element"];

/***/ }),

/***/ "@wordpress/hooks":
/*!*******************************!*\
  !*** external ["wp","hooks"] ***!
  \*******************************/
/***/ ((module) => {

module.exports = window["wp"]["hooks"];

/***/ }),

/***/ "@wordpress/rich-text":
/*!**********************************!*\
  !*** external ["wp","richText"] ***!
  \**********************************/
/***/ ((module) => {

module.exports = window["wp"]["richText"];

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _core_image_modifications__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./core-image-modifications */ "./src/core-image-modifications.js");

})();

/******/ })()
;
//# sourceMappingURL=index.js.map