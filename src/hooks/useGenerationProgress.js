// Shared hook for estimating generation progress based on provider/model settings.

import { useEffect, useRef, useState } from '@wordpress/element';

const DEFAULT_DURATION_MS = 30000;

/**
 * Returns a 0-99 progress value while `isActive` is true.
 * Increments linearly over a fixed 30-second window, capping at 99%.
 *
 * @param {boolean} isActive Whether a generation is in progress.
 * @return {number} Progress percentage (0-99).
 */
const useGenerationProgress = ( isActive ) => {
	const [ progress, setProgress ] = useState( 0 );
	const startTimeRef = useRef( null );
	const lastProgressRef = useRef( 0 );

	useEffect( () => {
		if ( ! isActive ) {
			setProgress( 0 );
			startTimeRef.current = null;
			lastProgressRef.current = 0;
			return undefined;
		}

		if ( ! startTimeRef.current ) {
			startTimeRef.current = Date.now();
			setProgress( 0 );
			lastProgressRef.current = 0;
		}

		const interval = setInterval( () => {
			const elapsed = Date.now() - startTimeRef.current;
			const nextProgress = Math.min(
				Math.floor( ( elapsed / DEFAULT_DURATION_MS ) * 100 ),
				99
			);
			const clampedProgress = Math.max(
				nextProgress,
				lastProgressRef.current
			);
			lastProgressRef.current = clampedProgress;
			setProgress( clampedProgress );
		}, 200 );

		return () => clearInterval( interval );
	}, [ isActive ] );

	return progress;
};

export default useGenerationProgress;
