/* jshint strict:true */
/* jslint node: true */
/* jslint esversion: 9 */
'use strict';

/*
 * Created with @iobroker/create-adapter v1.16.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
//const mcrypt = require('mcrypt');

/** @type {E3dc} */
let adapter;
/** @type {NodeJS.Timeout} */
let timer;
/** @type {boolean} */
let bStopExecution = false;
/** @type {boolean} */
let bConnectionOpen = false;

/** @type {string} */
let ipAddress;
/** @type {number} */
let ipPort;
/** @type {string} */
let password;
let client;

function recieveLoop(data) {
	if(bStopExecution || !bConnectionOpen) {
		adapter.setState('info.connection', false, true);
		return;
	}
	adapter.log.debug('Recieved data: ' + data);
}

let i = 0;
async function mainLoop() {
	if(bStopExecution || !bConnectionOpen) {
		adapter.setState('info.connection', false, true);
		return;
	}
	// Write a message to the socket as soon as the client is connected, the server will receive it as message from the client
	try {
		const message = 'Hello E3DC!';
		await adapter.log.debug('Sending: ' + message + i);
		client.write(message + i++);

		timer = setTimeout(mainLoop, adapter.config.requestInterval*1000);
	} catch(err) {
		adapter.log.debug('error on write: ' + err);
	}
}

class E3dc extends utils.Adapter {

	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'e3dc',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		const net = require('net');
		// Initialize your adapter here
		ipAddress = this.config.ipAddress;
		// @ts-ignore
		if(this.config.isFarmingMaster) {
			ipPort = 5034;
		} else {
			ipPort = 5033;
		}
		// start a dummy server if localhost
		if(ipAddress == '127.0.0.1') {
			ipPort = 8088;
			this.log.debug('starting local server');
			const server = net.createServer(function(socket) {
				//socket.write('Echo server\r\n');
				// returns data sent from client
				socket.pipe(socket);
			});
			server.listen(ipPort, ipAddress);
		}
		// @ts-ignore
		password = this.config.rscpPassword.substr(0,32);	// limit pw to 32 bytes
		adapter = this;
		this.log.debug('ipAddress: ' + ipAddress);
		this.log.debug('ipPort: ' + ipPort);
		this.log.debug('pw-length: ' + password.length);
		// @ts-ignore
		this.log.debug('requestInterval: ' + this.config.requestInterval);

		// Reset the connection indicator during startup
		this.setState('info.connection', false, true, async () => {
			bStopExecution = false;
			// establish socket connection
			client = new net.Socket();
			try {
				client.connect(ipPort, ipAddress, async () => {
					// Add a 'data' event handler for the client socket
					client.on('data', recieveLoop);
					// Add a 'close' event handler for the client socket
					client.on('close', () => {
						bConnectionOpen = false;
						adapter.log.debug('Connection closed');
					});
					bConnectionOpen = true;
					await adapter.log.debug('Connected to: ' + ipAddress + ':' + ipPort);
					// data is what the server sent to this socket
					// start mainLoop
					await mainLoop();
					// set connection indicator
					await this.setStateAsync('info.connection', true, true);
				});
			} catch(err) {
				adapter.log.debug('error on connect: ' + err);
			}
		});
	}
	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			bStopExecution = true;
			if(timer) { clearTimeout(timer); }
			// Close the client socket completely
			adapter.log.debug('Closing connection');
			if(client) { client.destroy(); }
			this.log.info('cleaned everything up...');
			callback();
		} catch (e) {
			callback();
		}
	}
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new E3dc(options);
} else {
	// otherwise start the instance directly
	new E3dc();
}