"use strict";

var SAGE2_IPOPVisualizer = SAGE2_App.extend({
	init: function (data) {
		if (this.isElectron()) {
			this.SAGE2Init("webview", data);
			this.createLayer("rgba(0,0,0,0.85)");
			this.layer.style.overflow = "hidden";
			this.pre = document.createElement('pre');
			this.pre.style.whiteSpace = "pre-wrap";
			this.layer.appendChild(this.pre);
		} else {
			this.SAGE2Init("div", data);
			this.element.innerHTML = "<h1>Webview only supported using Electron as a display client</h1>";
			return;
		}
		// Set the DOM id
		this.element.id = "div_" + data.id;
		//this.element.style.backgroundColor = "white"; 

		// move and resize callbacks
		this.resizeEvents = "continuous";
		this.modifiers = [];
		this.contentType = "web";
		// make HTML fit the screen
		this.element.style.display = "inline-flex";

		// Webview settings
		this.element.autosize = "on";
		this.element.plugins = "on";
		this.element.allowpopups = false;
		this.element.allowfullscreen = false;
		// turn off nodejs intergration for now
		this.element.nodeintegration = 0;
		// add the preload clause
		this.addPreloadFile();

		this.title = "SAGE2_IPOPVisualizer";
		// Set a session per webview, so not zoom sharing per origin
		this.element.partition = data.id;
		this.zoomFactor = 1;
		this.autoRefresh = null;
		this.position_x = 0;
		this.position_y = 0;
		var _this = this;

		/** Set property for each app */
		this.children = new Array();
		this.appName = ``;
		this.appId = ``;
		this.graphProperty = {
			overlayId: ``,
			graphType: ``,
			selectedElementId: ``,
			targetId: ``,
			nodes: {},
			links: {},
		};
		this.toolProperty = {
			multiWindowState: false, /** Default state */
		}
		this.defaultPosition = {
			x: 0,
			y: 0,
		}
		this.cyElement = {};

		this.element.addEventListener('new-window', (event) => {
			if (event.url.startsWith('http:') || event.url.startsWith('https:')) {
				// _this.newWindow(event.url);
				//console.log(JSON.stringify(event));
				this.launchAppWithValues(_this.title, {
					url: event.url,
					defaultPosition: {
						x: 500,
						y: 500,
					}
				}, 500, 500)
			} else {
				console.log('Webview>	Not a HTTP URL, not opening [', event.url, ']', event);
			}
		})

		this.element.addEventListener('console-message', (event) => {
			try {
				let obj = JSON.parse(event.message);
				if (obj.s2) {
					if (obj.s2 === "state") {
						_this.messageUpdateStateValue(obj.nameOfValue, obj.value, obj.propagateChanges)
					} else if (obj.s2 === "functionCall") {
						if (_this[obj.nameOfFunction]) { // only if function exists
							_this[obj.nameOfFunction](obj.value)
						} else {
							console.log("ERROR> WebAppCore> Webpage attempted to call function: " + obj.nameOfFunction + ". But it doesn't exist.");
						}
					}
				}
			} catch (e) {
				console.log('Webview> console-message:' + event.message);
			}
		})

		if (typeof data.customLaunchParams != 'undefined') {
			console.log(`${ui.width},${ui.height}`);
			//this.element.src = data.customLaunchParams.url;
			this.handleCustomLaunchParams(data.customLaunchParams);
		} else {
			console.log(`${ui.width},${ui.height}`);
			this.element.src = 'http://localhost:3000/#/SAGE2_tool/'; /* IP for React client server*/
			//this.element.src = 'http://168.61.43.235:3000/#/SAGE2_tool'; /* IP for React client server*/
			//this.element.src = `${Config.React.ip}:${Config.React.port}/`
			this.appName = 'Tool';
			this.appId = 0;
			this.updateTitle(`${this.title}: ${this.appName}`);
		}
	},
    /**
	 * Determines if electron is the renderer (instead of a browser)
	 *
	 * @method     isElectron
	 * @return     {Boolean}  True if electron, False otherwise.
	 */
	isElectron: function () {
		return (typeof window !== 'undefined' && window.process && window.process.type === "renderer");
	},

    /**
	 * Loads the components to do a file preload on a webpage.
	 * Needs to be within an Electron browser to work.
	 *
	 * @method     addPreloadFile
	 */
	addPreloadFile: function () {
		// if it's not running inside Electron, do not bother
		if (!this.isElectron) {
			return;
		}
		// load the nodejs path module
		var path = require("path");
		// access the remote electron process
		var app = require("electron").remote.app;
		// get the application path
		var appPath = app.getAppPath();
		// split the path at node_modules
		var subPath = appPath.split("node_modules");
		// take the first element which contains the current folder of the application
		var rootPath = subPath[0];
		// add the relative path to the webview folder
		var preloadPath = path.join(rootPath, 'public/uploads/apps/ipop', 'SAGE2_script_supplement.js');
		// finally make it a local URL and pass it to the webview element
		this.element.preload = "file://" + preloadPath;
	},

	event: function (eventType, position, user_id, data, date) {
		if (this.isElectron()) {
			var x = Math.round(position.x);
			var y = Math.round(position.y);
			var _this = this;
			if (eventType === "pointerPress") {
				this.element.sendInputEvent({ // click
					type: "mouseDown",
					x: x, y: y,
					button: data.button,
					modifiers: this.modifiers,
					clickCount: 1
				});
			} else if (eventType === "pointerMove") {
				this.element.sendInputEvent({ // move
					type: "mouseMove",
					modifiers: this.modifiers,
					x: x, y: y
				});
			} else if (eventType === "pointerRelease") {
				this.element.sendInputEvent({ // click release
					type: "mouseUp",
					x: x, y: y,
					button: data.button,
					modifiers: this.modifiers,
					clickCount: 1
				});
			} else if (eventType === "pointerScroll") {
				this.element.sendInputEvent({ // Scroll events: reverse the amount to get correct direction
					type: "mouseWheel",
					deltaX: 0, deltaY: -1 * data.wheelDelta,
					x: x, y: y,
					modifiers: this.modifiers,
					canScroll: true
				});
			} else if (eventType === "widgetEvent") { // widget events
			} else if (eventType === "keyboard") {
				this.element.sendInputEvent({ // type: "keyDown"
					type: "char",
					keyCode: data.character
				});
				setTimeout(function () {
					_this.element.sendInputEvent({
						type: "keyUp",
						keyCode: data.character
					});
				}, 0);
			} else if (eventType === "specialKey") {
				this.modifiers = []; // store the modifiers values
				if (data.status && data.status.SHIFT) {
					this.modifiers.push("shift");
				}
				if (data.status && data.status.CTRL) {
					this.modifiers.push("control");
				}
				if (data.status && data.status.ALT) {
					this.modifiers.push("alt");
				}
				if (data.status && data.status.CMD) {
					this.modifiers.push("meta");
				}
				if (data.status && data.status.CAPS) {
					this.modifiers.push("capsLock");
				}
				if (data.code === 16) { // SHIFT key
					if (data.state === "down") {
						this.element.sendInputEvent({
							type: "keyDown",
							keyCode: "Shift"
						});
					} else {
						this.element.sendInputEvent({
							type: "keyUp",
							keyCode: "Shift"
						});
					}
				}
				if (data.code === 8 || data.code === 46) { // backspace key
					if (data.state === "down") { // Currently only allow on keyup have finer control
					} else {
						this.element.sendInputEvent({
							type: "keyUp",
							keyCode: "Backspace"
						});
					}
				}
				if (data.code === 37 && data.state === "down") { // arrow left
					if (data.status.ALT) {
						this.element.goBack();
					} else {
						this.element.sendInputEvent({
							type: "keyDown",
							keyCode: "Left",
							modifiers: null
						});
					}
					this.refresh(date);
				} else if (data.code === 38 && data.state === "down") { // arrow up
					if (data.status.ALT) {
						this.zoomPage({ dir: "zoomin" });
					} else {
						this.element.sendInputEvent({
							type: "keyDown",
							keyCode: "Up",
							modifiers: null
						});
					}
					this.refresh(date);
				} else if (data.code === 39 && data.state === "down") { // arrow right
					if (data.status.ALT) {
						this.element.goForward();
					} else {
						this.element.sendInputEvent({
							type: "keyDown",
							keyCode: "Right",
							modifiers: null
						});
					}
					this.refresh(date);
				} else if (data.code === 40 && data.state === "down") { // arrow down
					if (data.status.ALT) {
						this.zoomPage({ dir: "zoomout" });
					} else {
						this.element.sendInputEvent({
							type: "keyDown",
							keyCode: "Down",
							modifiers: null
						});
					}
					this.refresh(date);
				} else if (data.code === 82 && data.state === "down") {	// r key
					if (data.status.ALT) {
						this.isLoading = true; // ALT-r reloads
						this.reloadPage({});
					}
					this.refresh(date);
				}
			}
		}
	},
	load: function (date) {
		// OPTIONAL
		// The state will be automatically passed to your webpage through the handler you gave to SAGE2_AppState
		// Use this if you want to alter the state BEFORE it is passed to your webpage. Access with this.state
	},
	draw: function (date) {
		// OPTIONAL
		// Your webpage will be in charge of its view
		// Use this if you want to so something within the SAGE2 Display variables
		// Be sure to set 'this.maxFPS' within init() if this is desired.
		// FPS only works if instructions sets animation true
	},
	resize: function () {
		// OPTIONAL
	},
	getContextEntries: function () {
		// OPTIONAL
		// This can be used to allow UI interaction to your webpage
		// Entires are added after entries of enableUiContextMenuEntries 
		var entries = [];
		// entries.push({
		// 	description: "This text is seen in the UI",
		// 	callback: "makeAFunctionMatchingThisString", // The string will specify which function to activate
		// 	parameters: {},
		// 	// The called function will be passed an Object.
		// 	// Each of the parameter properties will be in that object
		// 	// Some properties are reserved and may be automatically filled in.
		// });
		return entries;
	},

    /**
	* Method called by SAGE2, and calls the application 'quit' method
	*
	* @method terminate
    */
	terminate: function () {
		if (typeof this.quit === 'function') {
			this.quit();
		}
		if (isMaster && this.hasFileBuffer === true) {
			wsio.emit('closeFileBuffer', { id: this.div.id });
		}
		/** Add from original source code */
		this.handleCloseApplication(this.appId);
		this.terminateChildren();

		SAGE2RemoteSitePointer.appQuitHidePointers(this);
		this.serverDataRemoveAllValuesGivenToServer();
	},

	terminateChildren: function () {
		for (var i = 0; i < this.childrenAppIds.length; i++) {
			try {
				applications[this.childrenAppIds[i]]['terminateChildren']();
			}
			catch (error) {
				console.log("terminateChildren: " + error);
			}
		}
		this.close();
	},

	setWindowSizeAndPosition: function (packet) {
		if (packet.hasOwnProperty('sage2w')) {
			var [width, height] = [this.normalizedWidth(packet.sage2w, packet.width), this.normalizedHeight(packet.sage2h, packet.height)]
			console.log('width:' + width)
			this.sendResize(width, height);
		} else {
			this.sendResize(packet.width, packet.height);
		}
	},

	setWindowSize: function (packet) {
		var _this = this;
		if (packet.hasOwnProperty('sage2w')) {
			var [width, height] = [this.normalizedWidth(packet.sage2w, packet.width), this.normalizedHeight(packet.sage2h, packet.height)]
			//this.sendResize(width, height);
			var [x, y] = [this.sage2_x, this.sage2_y];
			if (this.graphProperty.graphType === 'main') {
				x = (ui.width / 2) - (width / 2);
			}
			else if (this.graphProperty.graphType === 'sub' || this.graphProperty.graphType === 'map') {
				[x, y] = [this.sage2_x, this.sage2_y];
			}
			else {
				[x, y] = [0, 400];
			}
			this.defaultPosition = {
				x: x,
				y: y,
			}
			var posAdjust = {};
			posAdjust.appPositionAndSize = {};
			posAdjust.appPositionAndSize.elemId = _this.id;
			posAdjust.appPositionAndSize.elemLeft = x;
			posAdjust.appPositionAndSize.elemTop = y;
			posAdjust.appPositionAndSize.elemHeight = height;
			posAdjust.appPositionAndSize.elemWidth = width;
			wsio.emit("updateApplicationPositionAndSize", posAdjust);
		} else {
			//this.sendResize(packet.width, packet.height);
			var [x, y] = [0, 400];
			if (this.appId === 0) {
				y = 100;
			}
			this.defaultPosition = {
				x: x,
				y: y,
			}
			var posAdjust = {};
			posAdjust.appPositionAndSize = {};
			posAdjust.appPositionAndSize.elemId = _this.id;
			posAdjust.appPositionAndSize.elemLeft = x;
			posAdjust.appPositionAndSize.elemTop = y;
			posAdjust.appPositionAndSize.elemHeight = packet.height;
			posAdjust.appPositionAndSize.elemWidth = packet.width;

			wsio.emit("updateApplicationPositionAndSize", posAdjust);
		}
	},

	normalizedWidth: function (standardSage2w, standardW) {
		return parseInt((ui.width * standardW) / standardSage2w);
	},

	normalizedHeight: function (standardSage2h, standardH) {
		return parseInt((ui.height * standardH) / standardSage2h);
	},

	launchNewApp: function (packet) {
		if (this.graphProperty.graphType === 'main') {
			let [position_x, position_y] = [0, 0];
			switch (packet.graphType) {
				case 'map':
					position_x = this.sage2_x + this.sage2_width + 100;
					position_y = 0;
					break;
				case 'sub':
					/** Old version */
					// if (Array.isArray(this.children) && this.children.length) {
					// 	var childtemp = Array.from(this.children);
					// 	childtemp = childtemp.filter((child) => {
					// 		return child !== 'map';
					// 	})
					// 	console.log(`Mod: ${childtemp.length % 5}`)
					// 	if (Array.isArray(childtemp) && childtemp.length) {
					// 		var prevChild = childtemp.pop();
					// 		for (var i = 0; i < this.childrenAppIds.length; i++) {
					// 			try {
					// 				if (applications[this.childrenAppIds[i]].appId === prevChild) {
					// 					var tempObj = applications[this.childrenAppIds[i]];
					// 					position_x = tempObj.sage2_x + tempObj.sage2_width + 100;
					// 					position_y = this.sage2_y + this.sage2_height + 100;
					// 					break;
					// 				}
					// 			}
					// 			catch (error) {
					// 				console.log(`Error func LaunchNewApp > ${error.message}`);
					// 			}
					// 		}
					// 	}
					// 	else {
					// 		position_x = 0;
					// 		position_y = this.sage2_y + this.sage2_height + 100;
					// 	}
					// }
					// else {
					// 	position_x = 0;
					// 	position_y = this.sage2_y + this.sage2_height + 100;
					// }
					// this.children.push(packet.targetId);

					/** New version */
					try {
						var childtemp = Array.from(this.children);
						childtemp = childtemp.filter((child) => {
							return child !== 'map';
						})
						if (childtemp.includes(null)) {
							childtemp = childtemp.slice(0, childtemp.indexOf(null));
						}
						var indexCase = childtemp.length % 5;
						var prevChild = null;
						const gapBetweenSub = 100;
						const gapStack = 100 * (Math.floor(childtemp.length / 5)); /** Make window stack when collapse. */

						if (indexCase > 0) {
							prevChild = childtemp.pop();
							for (var i = 0; i < this.childrenAppIds.length; i++) {
								try {
									if (applications[this.childrenAppIds[i]].appId === prevChild) {
										console.log(`Child AppId: ${applications[this.childrenAppIds[i]].appId} prevAppId:${prevChild}`);
										var tempObj = applications[this.childrenAppIds[i]];
										prevChild = tempObj;
										break;
									}
								}
								catch (error) {
									console.log(`Error func LaunchNewApp get prevChild > ${error.message}`);
								}
							}
						}

						/** Set position from sub graph from index in array */
						switch (indexCase) {
							case 0: /** left  */
								position_x = 0 + gapStack;
								position_y = 300 + gapStack;
								break;
							case 1: /** bottom left */
								position_x = 0 + gapStack;
								position_y = this.sage2_y + this.sage2_height + gapBetweenSub + gapStack;
								break;
							case 2: /** bottom middle */
								position_x = prevChild.sage2_x + prevChild.sage2_width + gapBetweenSub + gapStack;
								position_y = this.sage2_y + this.sage2_height + gapBetweenSub + gapStack;
								break;
							case 3: /** bottom right */
								position_x = prevChild.sage2_x + prevChild.sage2_width + gapBetweenSub + gapStack;
								position_y = this.sage2_y + this.sage2_height + gapBetweenSub + gapStack;
								break;
							case 4:
								position_x = this.sage2_x + this.sage2_width + gapBetweenSub + gapStack;
								position_y = 300 + gapStack;
								break;
						}
					} catch (e) {
						console.log(`Error func LaunchNewApp > ${e.message}`);
					}
					if (this.children.includes(null)) {
						var index = this.children.indexOf(null);
						this.children[index] = packet.targetId;
					}
					else {
						this.children.push(packet.targetId);
					}
					break;
			}
			packet.defaultPosition = {
				x: position_x,
				y: position_y,
			}
			this.launchAppWithValues(this.title, packet, position_x, position_y);

		} else {
			this.launchAppWithValues(this.title, packet, 0, 0);
		}
	},

	callFunctionInComponent: function (nameOfComponent, nameOfFunction, value) {
		let message = {
			nameOfComponent,
			nameOfFunction,
			value: value,
		}
		this.element.executeJavaScript(`SAGE2_AppState.callFunctionInComponent(${JSON.stringify(message)});`);
	},

	openGraph: function (packet) {
		switch (packet.type) {
			case 'mainGraph':
				let messageMain = {
					appName: `main_${packet.overlayId}`,
					overlayId: packet.overlayId,
					url: packet.url,
					graphType: `main`,
					paramsType: `graph`,
					multiWindowState: this.toolProperty.multiWindowState,
					appId: packet.overlayId,
				}
				if (!this.children.includes(packet.overlayId)) {
					this.children.push(packet.overlayId);
					this.launchNewApp(messageMain);
				}
				break;
			case 'subGraph':
				let messageSub = {
					appName: `${packet.targetLabel}`,
					url: packet.url,
					overlayId: this.graphProperty.overlayId,
					graphType: `sub`,
					paramsType: `graph`,
					nodes: this.graphProperty.nodes,
					links: this.graphProperty.links,
					targetId: packet.targetId,
					appId: packet.targetId,
				}
				if (!this.children.includes(packet.targetId)) {
					this.graphProperty.targetId = packet.targetId;
					this.launchNewApp(messageSub);
				}
				break;
		}
	},

	handleCustomLaunchParams: function (packet) {
		//console.log(`params:${JSON.stringify(packet)}`);
		this.appId = packet.appId;
		if (packet.hasOwnProperty('defaultPosition')) {
			this.defaultPosition = {
				x: packet.defaultPosition.x,
				y: packet.defaultPosition.y,
			}
		}
		if (packet.hasOwnProperty('appName')) {
			this.updateTitle(`${this.title}: ${packet.appName}`);
			this.appName = packet.appName;
		}
		if (packet.hasOwnProperty('paramsType')) {
			this.graphProperty.overlayId = packet.overlayId;
			this.graphProperty.graphType = packet.graphType;
			this.graphProperty.nodes = packet.nodes;
			this.graphProperty.links = packet.links;
			this.graphProperty.targetId = packet.targetId;
			this.toolProperty.multiWindowState = packet.multiWindowState;
		}
		if (packet.hasOwnProperty('url')) {
			this.element.src = packet.url;
		}
		this.cyElement = packet.options;

	},

	requestMainGraph: function (packet) {
		/* Make Tool is parent for main graph */
		this.sendDataToParentApp('openGraph', packet);
		/* Close overlay page */
		this.close()
	},

	requestGraphProperty: function (packet) {
		this.callFunctionInComponent(packet.nameOfComponent, packet.callback, JSON.stringify(this.graphProperty));
	},

	set: function (packet) {
		this[`set${packet.name}`](packet.data);
	},

	setOverlayElements(data) {
		this.graphProperty.nodes = data.nodes;
		this.graphProperty.links = data.links;
	},

	setDataForSearch: function (packet) {
		if (this.graphProperty.graphType === 'main') {
			this.sendDataToParentApp('setDataForSearch', packet);
		}
		if (this.appName === 'Tool') {
			if (this.children.includes('search')) {
				let message = {
					nameOfComponent: `searchComponent`,
					callback: `responeSearchOption`,
					value: packet.element,
				}
				this.sendDataToChildrenApps('sendDataToSearch', message);
			}
			this.cyElement = packet.element;
		}
	},

	setMultiWindowState: function (state) {
		this.toolProperty.multiWindowState = state;
		//console.log(this.toolProperty.multiWindowState);
		if (this.appName === 'Tool') {
			if (Array.isArray(this.children) && this.children.length) {
				var packet = {
					nameOfComponent: `graphComponent`,
					callback: `responseToolProperty`,
					toolProperty: this.toolProperty,
				}
				this.sendDataToChildrenApps(`requestMultiState`, packet);
				//this.callFunctionInComponent(packet.nameOfComponent, packet.callback, JSON.stringify(this.toolProperty));
			}
		}
	},

	setSelectedFromSub: function (packet) {
		if (this.children.includes(packet.oldTargetId)) {
			var promise = new Promise((resolve, reject) => {
				try {
					var index = this.children.indexOf(packet.oldTargetId);
					if (~index) this.children[index] = packet.newTargetId;
					resolve(packet.newTargetId);
				} catch (e) {
					reject(e);
				}
			})

			promise.then((value) => {
				var packet = {
					nameOfComponent: `graphComponent`,
					callback: `handleSelectCyElement`,
					targetId: value,
				}
				this.selectCyElement(packet);
			}).catch((e) => {
				console.log(e.message)
			})
		} else {
			if (this.appId === packet.oldTargetId) {
				this.updateTitle(`${this.title}: ${packet.newTargetLabel}`);
				this.appId = packet.newTargetId;
			}
			this.sendDataToParentApp(`setSelectedFromSub`, packet);
		}
	},

	setSelectedFromMap: function (packet) {
		if (this.children.includes(packet.appId)) {
			try {
				var message = {
					nameOfComponent: `graphComponent`,
					callback: `handleSelectCyElement`,
					targetId: packet.targetId,
				}
				this.selectCyElement(message);
			} catch (e) {
				console.log(`Error setSelectedFromMap > ${e}`)
			}
		}
		else {
			this.sendDataToParentApp(`setSelectedFromMap`, packet)
		}
	},

	request: function (packet) {
		this[`request${packet.func}`](packet.data);
	},

	requestMultiState: function (packet) {
		if (packet.hasOwnProperty('toolProperty')) {
			this.callFunctionInComponent(packet.nameOfComponent, packet.callback, JSON.stringify(packet.toolProperty));
		}
		else {
			this.callFunctionInComponent(packet.nameOfComponent, packet.callback, JSON.stringify(this.toolProperty));
		}
	},

	sendDataToSearch: function (packet) {
		if (this.appName === 'search') {
			this.callFunctionInComponent(packet.nameOfComponent,
				packet.callback,
				typeof packet.value === 'undefined' ? this.cyElement : packet.value);
		}
	},

	open: function (packet) {
		this[`open${packet.name}`](packet.data);
	},

	openSearch: function (packet) {
		if (!this.children.includes('search')) {
			this.children.push(packet.appId);
			var message = {
				appName: packet.appName,
				url: packet.url,
				options: this.cyElement,
				appId: `search`
			}
			this.launchNewApp(message);
		}
		else {
			this.closeSpecificChild(packet.appId);
		}
	},

	openInfo: function (packet) {
		if (!this.children.includes(packet.appId)) {
			var message = {
				appName: packet.appName,
				url: packet.url,
				appId: packet.appId
			}
			this.children.push(packet.appId);
			this.launchNewApp(message);
		}
		else {
			this.closeSpecificChild(packet.appId)
		}
	},

	openMapView: function (packet) {
		if (this.appId === 0) {
			this.sendDataToChildrenApps(`openMapView`, packet);
		}
		else if (this.graphProperty.graphType === 'main') {
			var message = {
				appName: `${packet.appName} ${this.graphProperty.overlayId}`,
				url: packet.url,
				overlayId: this.graphProperty.overlayId,
				graphType: `map`,
				paramsType: `graph`,
				nodes: this.graphProperty.nodes,
				links: this.graphProperty.links,
				appId: packet.appId,
				targetId: this.graphProperty.targetId,
			}
			if (this.children.includes(message.appId)) {
				this.closeSpecificChild(message.appId);
			} else {
				this.children.push(message.appId);
				this.launchNewApp(message);
			}
		}
	},

	sendSelectOption: function (packet) {
		this.sendDataToParentApp(packet.passfunc, packet);
	},

	sendSelectNodeToMap: function (packet) {
		if (this.appId === packet.appId) {
			this.callFunctionInComponent(packet.nameOfComponent, packet.callback, packet.targetId);
		}
		else {
			this.graphProperty.targetId = packet.targetId; /** Set defualt selected element */
			this.sendDataToChildrenApps(`sendSelectNodeToMap`, packet)
		}
	},

	selectOption: function (packet) {
		if (this.graphProperty.graphType === 'main') {
			this.selectCyElement(packet);
		}
		else { /** for Tool application */
			this.sendDataToChildrenApps('selectOption', packet);
		}
	},

	selectCyElement: function (packet) {
		this.callFunctionInComponent(packet.nameOfComponent, packet.callback, packet.targetId);
	},

	closeSpecificChild: function (id) {
		if (this.appId === id) {
			this.close();
		}
		else {
			this.sendDataToChildrenApps(`closeSpecificChild`, id);
		}
	},

	reposition: function () {
		console.log(`Current position x:${this.sage2_x}, y:${this.sage2_y} reset to x:${this.defaultPosition.x}, y:${this.defaultPosition.y}`);
		try {
			var posAdjust = {};
			posAdjust.appPositionAndSize = {};
			posAdjust.appPositionAndSize.elemId = this.id;
			posAdjust.appPositionAndSize.elemLeft = this.defaultPosition.x;
			posAdjust.appPositionAndSize.elemTop = this.defaultPosition.y;
			posAdjust.appPositionAndSize.elemHeight = this.sage2_height;
			posAdjust.appPositionAndSize.elemWidth = this.sage2_width;
			wsio.emit("updateApplicationPositionAndSize", posAdjust);
		} catch (error) {
			console.log(`Error func reposition > ${e}`);
		}
		if (Array.isArray(this.children) && this.children.length) {
			this.sendDataToChildrenApps(`reposition`, {});
		}
	},

	refreshGraph: function () {
		try{
			var packet = {
				nameOfComponent: `graphComponent`,
				callback: `handleRefresh`,
				value: {},
			}
			this.callFunctionInComponent(packet.nameOfComponent, packet.callback, packet.value);
		}catch(error){
			console.log(`Error func refreshGraph > ${error}`);
		}
		if (Array.isArray(this.children) && this.children.length) {
			this.sendDataToChildrenApps(`refreshGraph`, {});
		}
	},

	handleCloseApplication: function (id) {
		try {
			/** Check if this is a parent that user close child app so, handle it. */
			if (this.children.includes(id)) {
				/** Replace array sub graph children with null ex. [null, 1, 2, null, ...] */
				if (this.graphProperty.graphType === 'main' && id !== 'map') {
					var index = this.children.indexOf(id);
					console.log(`INDEX REPLACE NULL ${index}`);
					if (~index) this.children[index] = null;
				}
				/** Remove children from children array. */
				else {
					/** Check if close main graph so clear data for search. */
					if (this.appId === 0 && id !== 'info' && id !== 'search') {
						this.cyElement = {};
						if(this.children.includes('search')){
							var packet = {
								nameOfComponent: `searchComponent`,
								callback: `responeSearchOption`,
								value: this.cyElement,
							}
							this.sendDataToChildrenApps(`sendDataToSearch`, packet);
						}
					}
					var index = this.children.indexOf(id);
					if (~index) this.children.splice(index, 1);
				}
			}
			else {
				this.sendDataToParentApp(`handleCloseApplication`, id);
			}
		} catch (e) {
			console.log(`HandleCloseApplication ERROR > ${e.message}`);
		}
	},

})