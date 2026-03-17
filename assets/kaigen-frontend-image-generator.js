( function () {
	const config = window.kaigenFrontendData || {};
	const blocks = document.querySelectorAll(
		'.kaigen-frontend-image-generator'
	);

	if ( ! blocks.length ) {
		return;
	}

	const createNode = ( tag, className, text ) => {
		const element = document.createElement( tag );
		if ( className ) {
			element.className = className;
		}
		if ( typeof text === 'string' ) {
			element.textContent = text;
		}
		return element;
	};

	const getErrorMessage = async ( response, fallbackMessage ) => {
		let payload;

		try {
			payload = await response.json();
		} catch ( error ) {
			payload = null;
		}

		if ( payload && typeof payload.message === 'string' ) {
			return payload.message;
		}

		return `${ fallbackMessage } (${ response.status })`;
	};

	const buildUrl = ( baseUrl, params = {} ) => {
		const url = new window.URL( baseUrl, window.location.origin );

		Object.entries( params ).forEach( ( [ key, value ] ) => {
			if ( value === undefined || value === null || value === '' ) {
				return;
			}

			url.searchParams.set( key, String( value ) );
		} );

		return url.toString();
	};

	const fetchUserImages = async ( postId, listElement ) => {
		if ( ! postId || ! config.isLoggedIn ) {
			return;
		}

		const response = await window.fetch(
			buildUrl( config.userImagesUrl, {
				post_id: postId,
				_wpnonce: config.nonce || '',
			} ),
			{
				method: 'GET',
				credentials: 'same-origin',
				headers: {
					'X-WP-Nonce': config.nonce,
				},
			}
		);

		if ( ! response.ok ) {
			throw new Error(
				await getErrorMessage(
					response,
					'Failed to load generated images.'
				)
			);
		}

		const images = await response.json();
		listElement.innerHTML = '';
		if ( ! Array.isArray( images ) || ! images.length ) {
			listElement.appendChild(
				createNode( 'p', '', 'No generated images yet.' )
			);
			return;
		}

		images.forEach( ( image ) => {
			if ( ! image.url ) {
				return;
			}

			const item = createNode(
				'figure',
				'wp-block-image size-large kaigen-frontend-generated-image-item'
			);
			const img = createNode( 'img' );
			img.src = image.url;
			img.alt = image.prompt || '';
			item.appendChild( img );

			if ( image.prompt ) {
				item.appendChild(
					createNode(
						'figcaption',
						'wp-element-caption',
						image.prompt
					)
				);
			}

			listElement.appendChild( item );
		} );
	};

	blocks.forEach( ( block ) => {
		const wrapper = createNode( 'div', 'kaigen-frontend-generator-ui' );

		if ( ! config.isLoggedIn ) {
			wrapper.appendChild(
				createNode(
					'p',
					'kaigen-frontend-login-message',
					config.loginMessage
				)
			);
			block.appendChild( wrapper );
			return;
		}

		const postId = parseInt(
			block.dataset.postId || config.defaultPostId || 0,
			10
		);
		const quality =
			block.dataset.quality || config.defaultQuality || 'medium';
		const promptInstruction =
			block.dataset.promptInstruction ||
			config.promptInstruction ||
			config.placeholder ||
			'Describe the image you want to create...';
		const status = createNode( 'p', 'kaigen-frontend-status' );
		const listTitle = createNode(
			'h4',
			'',
			config.yourImagesTitle || 'Your images for this post'
		);
		const imageList = createNode(
			'figure',
			'wp-block-gallery has-nested-images columns-3 is-cropped kaigen-frontend-generated-images'
		);

		const textarea = createNode( 'textarea', 'kaigen-frontend-prompt' );
		textarea.placeholder = promptInstruction;
		textarea.rows = 4;
		const instructionText = createNode(
			'p',
			'kaigen-frontend-prompt-instruction',
			promptInstruction
		);
		const button = createNode(
			'button',
			'kaigen-frontend-submit',
			config.buttonLabel
		);
		button.type = 'button';

		button.addEventListener( 'click', async () => {
			const prompt = ( textarea.value || '' ).trim();
			if ( ! prompt ) {
				status.textContent = 'Please enter a prompt.';
				return;
			}

			status.textContent = 'Generating image...';
			button.disabled = true;

			try {
				const response = await window.fetch(
					buildUrl( config.generateImageUrl ),
					{
						method: 'POST',
						credentials: 'same-origin',
						headers: {
							'Content-Type': 'application/json',
							'X-WP-Nonce': config.nonce,
						},
						body: JSON.stringify( {
							prompt,
							post_id: postId,
							quality,
						} ),
					}
				);

				const payload = await response.json();
				if ( ! response.ok ) {
					throw new Error( payload.message || config.genericError );
				}

				status.textContent = 'Image generated successfully.';
				textarea.value = '';
				await fetchUserImages( postId, imageList );
			} catch ( error ) {
				status.textContent = error.message || config.genericError;
			} finally {
				button.disabled = false;
			}
		} );

		wrapper.appendChild( instructionText );
		wrapper.appendChild( textarea );
		wrapper.appendChild( button );
		wrapper.appendChild( status );
		wrapper.appendChild( listTitle );
		wrapper.appendChild( imageList );
		block.appendChild( wrapper );

		fetchUserImages( postId, imageList ).catch( ( error ) => {
			imageList.innerHTML = '';
			imageList.appendChild(
				createNode(
					'p',
					'',
					error?.message ||
						'Unable to load previous images. Refresh the page and try again.'
				)
			);
		} );
	} );
} )();
