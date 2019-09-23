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

let ipAddress;
let ipPort;
let password;
let client;

function recieveLoop(data) {
	if(bStopExecution) {
		return;
	}
	adapter.log.debug('recieveLoop');
	adapter.log.debug('DATA: ' + data);
}

async function mainLoop() {
	if(bStopExecution) {
		return;
	}
	await adapter.log.debug('mainLoop');
	// Write a message to the socket as soon as the client is connected, the server will receive it as message from the client
	client.write('I am Chuck Norris!');

	timer = setTimeout(mainLoop, adapter.config.requestInterval*1000);
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
		// Initialize your adapter here
		ipAddress = this.config.ipAddress;
		// @ts-ignore
		if(this.config.isFarmingMaster) {
			ipPort = 5034;
		} else {
			ipPort = 5033;
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
			const net = require('net');

			client = new net.Socket();
			await client.connect(ipPort, ipAddress, async () => {
				await adapter.log.debug('CONNECTED TO: ' + ipAddress + ':' + ipPort);
			});
			
			// Add a 'data' event handler for the client socket
			// data is what the server sent to this socket
			client.on('data', recieveLoop);
			
			// Add a 'close' event handler for the client socket
			client.on('close', () => {
				adapter.log.debug('Connection closed');
			});

			// start mainLoop
			await mainLoop(); 
			// set connection indicator
			await this.setStateAsync('info.connection', true, true);
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