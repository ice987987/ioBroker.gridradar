'use strict';

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
const axios = require('axios');

// variables
const isValidApplicationKey = /[a-zA-Z0-9]{50}/; // format: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

class Gridradar extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'gridradar',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here
		this.log.info('starting adapter "gridmonitor"...');

		// Reset the connection indicator during startup
		this.setState('info.connection', false, true);

		// The adapters config (in the instance object everything under the attribute "native") is accessible via this.config:
		this.log.debug(`config.applicationKey: ${this.config.applicationKey}`);
		this.log.debug(`config.requestInterval: ${this.config.requestInterval}`);
		this.log.debug(`config.metricKey: ${this.config.metricKey}`);

		// check applicationKey
		if (!isValidApplicationKey.test(this.config.applicationKey)) {
			this.log.error('"Application Key" is not valid (allowed format: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx) (ERR_#001)');
			return;
		}
		// check requestInterval
		if (!this.numberInRange(10, 3600, this.config.requestInterval)) {
			this.log.error(
				'"Time interval to retrieve values" is not valid (10s <= t <= 3600s) (ERR_#002)',
			);
			return;
		}
		// check metricKeys
		if (this.config.metricKey !== 'frequency-ucte-median-1s' && this.config.metricKey !== 'net-time') {
			this.log.error('"Metric Key" is not valid (allowed (ERR_#001)');
			return;
		}

		this.log.debug('The configuration has been checked successfully. Trying to connect "Gridradar API"...');

		await this.createObjects();
		await this.getData();

		this.log.info(`Starting polltimer with a ${this.config.requestInterval}s interval.`);
		this.requestInterval = setInterval(async () => {
			this.getData();
		}, this.config.requestInterval * 1000); // 1s = 1000ms
	}

	async createObjects() {
		await this.setObjectNotExistsAsync(`raw`, {
			type: 'state',
			common: {
				name: 'Raw Data',
				desc: 'Raw Data',
				type: 'array',
				role: 'state',
				read: true,
				write: false,
			},
			native: {},
		});
	}

	async getData() {
		axios({
			method: 'GET',
			url: 'https://api.gridradar.net/query',
			params: {
				'metric': this.config.metricKey
			},
			headers: {
				'Authorization': `Bearer ${this.config.applicationKey}`
			},

		})
			.then((response) => {
				this.log.debug(`[getData]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);

				this.setState(`raw`, { val: JSON.stringify(response.data), ack: true });

				this.setState('info.connection', true, true);
			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[getData]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[getData]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[getData]: error message: ${error.message}`);
				}
				this.log.debug(`[getData]: error.config: ${JSON.stringify(error.config)}`);
				this.setState('info.connection', false, true);
			});
	}

	numberInRange(min, max, val) {
		if (min === null) {
			return val <= max;
		} else if (max === null) {
			return min <= val;
		} else {
			return min <= val && val <= max;
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			this.requestInterval && clearInterval(this.requestInterval);

			callback();
		} catch {
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Gridradar(options);
} else {
	// otherwise start the instance directly
	new Gridradar();
}
