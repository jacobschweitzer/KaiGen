const assert = require( 'node:assert/strict' );
const net = require( 'node:net' );
const test = require( 'node:test' );

const { findAvailablePort, resolvePlaygroundPort } = require( './run-e2e.js' );

const listenOnPort = async ( port ) =>
	new Promise( ( resolve, reject ) => {
		const server = net.createServer();
		server.once( 'error', reject );
		server.listen( port, '127.0.0.1', () => resolve( server ) );
	} );

const closeServer = async ( server ) =>
	new Promise( ( resolve, reject ) => {
		server.close( ( error ) => {
			if ( error ) {
				reject( error );
				return;
			}
			resolve();
		} );
	} );

test( 'findAvailablePort skips a busy preferred port', async () => {
	const busyServer = await listenOnPort( 9400 );

	try {
		const port = await findAvailablePort( { preferredPort: 9400 } );

		assert.notEqual( port, 9400 );
		assert.equal( Number.isInteger( port ), true );
		assert.equal( port > 9400, true );
	} finally {
		await closeServer( busyServer );
	}
} );

test( 'resolvePlaygroundPort preserves an explicit PLAYGROUND_PORT', async () => {
	const port = await resolvePlaygroundPort( {
		PLAYGROUND_PORT: '9417',
	} );

	assert.equal( port, '9417' );
} );
