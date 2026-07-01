#!/usr/bin/env node
/* eslint-disable no-console */

const { spawn } = require( 'node:child_process' );
const net = require( 'node:net' );

const DEFAULT_HOST = '127.0.0.1';
const MAX_SCAN_ATTEMPTS = 100;

const normalizePort = ( port ) => {
	const normalizedPort = Number( port );

	if (
		! Number.isInteger( normalizedPort ) ||
		normalizedPort < 1 ||
		normalizedPort > 65535
	) {
		throw new Error( `Invalid port: ${ port }` );
	}

	return normalizedPort;
};

const isPortAvailable = async ( port, host = DEFAULT_HOST ) =>
	new Promise( ( resolve, reject ) => {
		const server = net.createServer();

		server.once( 'error', ( error ) => {
			if ( error.code === 'EADDRINUSE' || error.code === 'EACCES' ) {
				resolve( false );
				return;
			}

			reject( error );
		} );

		server.listen( port, host, () => {
			server.close( () => resolve( true ) );
		} );
	} );

const findEphemeralPort = async ( host = DEFAULT_HOST ) =>
	new Promise( ( resolve, reject ) => {
		const server = net.createServer();

		server.once( 'error', reject );
		server.listen( 0, host, () => {
			const address = server.address();
			const port =
				address && typeof address === 'object' ? address.port : null;

			server.close( () => {
				if ( port ) {
					resolve( port );
					return;
				}

				reject( new Error( 'Unable to resolve an available port.' ) );
			} );
		} );
	} );

const findAvailablePort = async ( {
	preferredPort,
	host = DEFAULT_HOST,
	maxAttempts = MAX_SCAN_ATTEMPTS,
} = {} ) => {
	if ( preferredPort === undefined ) {
		return findEphemeralPort( host );
	}

	const startPort = normalizePort( preferredPort );

	for ( let offset = 0; offset < maxAttempts; offset++ ) {
		const port = startPort + offset;

		if ( port > 65535 ) {
			break;
		}

		if ( await isPortAvailable( port, host ) ) {
			return port;
		}
	}

	throw new Error(
		`Unable to find an available port starting at ${ startPort }.`
	);
};

const resolvePlaygroundPort = async ( env = process.env ) => {
	if ( env.PLAYGROUND_PORT ) {
		normalizePort( env.PLAYGROUND_PORT );
		return env.PLAYGROUND_PORT;
	}

	if ( env.PLAYWRIGHT_SKIP_WEBSERVER === '1' ) {
		throw new Error(
			'PLAYGROUND_PORT must be set when PLAYWRIGHT_SKIP_WEBSERVER=1.'
		);
	}

	return String( await findAvailablePort() );
};

const resolvePlaywrightLaunch = (
	args = process.argv.slice( 2 ),
	env = process.env
) => {
	const launchArgs = [];
	const launchEnv = { ...env };

	for ( let index = 0; index < args.length; index++ ) {
		const arg = args[ index ];

		if ( arg.startsWith( '--playground-blueprint=' ) ) {
			launchEnv.PLAYGROUND_BLUEPRINT = arg.slice(
				'--playground-blueprint='.length
			);
			continue;
		}

		if ( arg === '--playground-blueprint' ) {
			const value = args[ index + 1 ];

			if ( ! value ) {
				throw new Error( '--playground-blueprint requires a value.' );
			}

			launchEnv.PLAYGROUND_BLUEPRINT = value;
			index++;
			continue;
		}

		if ( arg.startsWith( '--playground-workers=' ) ) {
			launchEnv.PLAYGROUND_WORKERS = arg.slice(
				'--playground-workers='.length
			);
			continue;
		}

		if ( arg === '--playground-workers' ) {
			const value = args[ index + 1 ];

			if ( ! value ) {
				throw new Error( '--playground-workers requires a value.' );
			}

			launchEnv.PLAYGROUND_WORKERS = value;
			index++;
			continue;
		}

		launchArgs.push( arg );
	}

	return {
		args: launchArgs,
		env: launchEnv,
	};
};

const runPlaywright = async (
	args = process.argv.slice( 2 ),
	env = process.env
) => {
	const launch = resolvePlaywrightLaunch( args, env );
	const playgroundPort = await resolvePlaygroundPort( launch.env );
	const playwrightCli = require.resolve( '@playwright/test/cli' );
	const childEnv = {
		...launch.env,
		PLAYGROUND_PORT: playgroundPort,
	};

	console.log( `Using WordPress Playground port ${ playgroundPort }.` );

	return new Promise( ( resolve, reject ) => {
		const child = spawn(
			process.execPath,
			[ playwrightCli, 'test', ...launch.args ],
			{
				env: childEnv,
				stdio: 'inherit',
			}
		);

		child.once( 'error', reject );
		child.once( 'exit', ( code, signal ) => {
			if ( signal ) {
				reject(
					new Error( `Playwright exited with signal ${ signal }.` )
				);
				return;
			}

			resolve( code || 0 );
		} );
	} );
};

if ( require.main === module ) {
	runPlaywright()
		.then( ( exitCode ) => {
			process.exitCode = exitCode;
		} )
		.catch( ( error ) => {
			console.error( error.message );
			process.exitCode = 1;
		} );
}

module.exports = {
	findAvailablePort,
	resolvePlaygroundPort,
	resolvePlaywrightLaunch,
	runPlaywright,
};
