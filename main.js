/* jshint strict:true */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/*
 * Created with @iobroker/create-adapter v1.16.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
const mcrypt = require('mcrypt');

/** @type {Moma} */
let adapter;
/** @type {NodeJS.Timeout} */
let timer;
/** @type {boolean} */
let bStopExecution = false;

let ipAddress;
let ipPort;
let password;

function recieveLoop() {
	if(bStopExecution) {
		return;
	}
	adapter.log.silly('recieveLoop');

}

function mainLoop() {
	if(bStopExecution) {
		return;
	}
	adapter.log.silly('mainLoop');

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

			// start mainLoop
			mainLoop(); 
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
			if(timer) { clearTimeout(timer);}
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