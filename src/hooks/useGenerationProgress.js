// Shared hook for estimating generation progress based on provider/model settings.

import { useEffect, useRef, useState } from '@wordpress/element';

const DEFAULT_DURATION_MS = 30000;

const useGenerationProgress = ( isActive, expectedDurationMs ) => {
	const [ progress, setProgress ] = useState( 0 );
	const durationRef = useRef( DEFAULT_DURATION_MS );
	const startTimeRef = useRef( null );

	useEffect( () => {
		durationRef.current =
			typeof expectedDurationMs === 'number' && expectedDurationMs > 0
				? expectedDurationMs
				: DEFAULT_DURATION_MS;
	}, [ expectedDurationMs ] );

	useEffect( () => {
		if ( ! isActive ) {
			setProgress( 0 );
			startTimeRef.current = null;
			return undefined;
		}

		if ( ! startTimeRef.current ) {
			startTimeRef.current = Date.now();
			setProgress( 0 );
		}

		const interval = setInterval( () => {
			const elapsed = Date.now() - startTimeRef.current;
			const nextProgress = Math.min(
				Math.round(
					( elapsed / durationRef.current ) * 100
				),
				100
			);
			setProgress( nextProgress );

			if ( nextProgress >= 100 ) {
				clearInterval( interval );
			}
		}, 200 );

		return () => clearInterval( interval );
	}, [ isActive ] );

	return progress;
};

export default useGenerationProgress;
