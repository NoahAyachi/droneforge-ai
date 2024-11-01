import GamepadHandler from '../utils/gamepadHandler';

/**
 * @class DroneControls
 * @description Manages the control inputs for the drone, handling both gamepad and keyboard inputs.
 * This class is responsible for translating raw input into normalized control values for the drone's movement.
 */
class DroneControls {
    /**
     * @constructor
     * Initializes the DroneControls with default values and sets up input handlers.
     */
    constructor() {
        /**
         * @property {Object} channels - Stores the current values for each control channel.
         * @property {number} channels.roll - Roll control value (-1 to 1).
         * @property {number} channels.pitch - Pitch control value (-1 to 1).
         * @property {number} channels.yaw - Yaw control value (-1 to 1).
         * @property {number} channels.throttle - Throttle control value (0 to 1).
         */
        this.channels = {
            roll: 0,        // -1 to 1
            pitch: 0,       // -1 to 1
            yaw: 0,         // -1 to 1
            throttle: 0.5,  // 0 to 1 (initialized to mid-point for stability)
        };

        /**
         * @property {Object} motorThrusts - Stores the current thrust values for each motor.
         * @property {number} motorThrusts.motor1 - Thrust for Motor 1 (0 to 1).
         * @property {number} motorThrusts.motor2 - Thrust for Motor 2 (0 to 1).
         * @property {number} motorThrusts.motor3 - Thrust for Motor 3 (0 to 1).
         * @property {number} motorThrusts.motor4 - Thrust for Motor 4 (0 to 1).
         */
        this.motorThrusts = {
            motor1: 0.6125, // Updated for hover stability
            motor2: 0.6125,
            motor3: 0.6125,
            motor4: 0.6125,
        };

        /**
         * @property {Object} keyStates - Tracks the current state of keyboard inputs.
         */
        this.keyStates = {};

        /**
         * @property {number} controlRate - Rate of change for keyboard controls (units per update).
         */
        this.controlRate = 0.4; // Adjusted for normalized thrust (0 to 1)

        /**
         * @property {GamepadHandler} gamepadHandler - Handles gamepad input.
         */
        this.gamepadHandler = new GamepadHandler();

        /**
         * @property {Object} scripts - Stores registered scripts with unique identifiers.
         */
        this.scripts = {};

        /**
         * @property {Object} scriptBindings - Maps keys to script identifiers.
         */
        this.scriptBindings = {};

        /**
         * @property {Array} activeScripts - List of scripts currently being executed.
         */
        this.activeScripts = [];

        this.initControls();
        this.registerDefaultScripts();
    }

    /**
     * @method initControls
     * @private
     * Initializes event listeners for keyboard input.
     */
    initControls() {
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
    }

    /**
     * @method onKeyDown
     * @private
     * @param {KeyboardEvent} event - The keydown event.
     * Handles keydown events, updating the keyStates object or executing scripts.
     */
    onKeyDown(event) {
        const key = event.code;

        // Check if the pressed key is bound to a script
        if (this.scriptBindings[key]) {
            const scriptId = this.scriptBindings[key];
            this.executeScript(scriptId);
            return;
        }

        // Otherwise, update the key state for normal controls
        this.keyStates[key] = true;
    }

    /**
     * @method onKeyUp
     * @private
     * @param {KeyboardEvent} event - The keyup event.
     * Handles keyup events, updating the keyStates object.
     */
    onKeyUp(event) {
        const key = event.code;

        // Only update key states for control keys, not for script execution
        if (!this.scriptBindings[key]) {
            this.keyStates[key] = false;
        }
    }

    /**
     * @method update
     * @public
     * Updates the control channels based on current input states.
     * This method should be called once per frame in the main game loop.
     * @param {number} deltaTime - Time elapsed since the last update (in milliseconds).
     */
    update(deltaTime) {
        this.gamepadHandler.update();
        this.updateControlChannels(deltaTime);
        this.updateActiveScripts(deltaTime);
    }

    /**
     * @method updateControlChannels
     * @private
     * Updates the control channels based on gamepad or keyboard input.
     * @param {number} deltaTime - Time elapsed since the last update (in milliseconds).
     */
    updateControlChannels(deltaTime) {
        const gamepadAxes = this.gamepadHandler.getAxes();

        if (this.gamepadHandler.connected) {
            // Use gamepad input directly
            this.channels.roll = this.clampValue(gamepadAxes[0], -1, 1);
            this.channels.pitch = this.clampValue(gamepadAxes[1], -1, 1);
            this.channels.yaw = this.clampValue(gamepadAxes[2], -1, 1);
            this.channels.throttle = this.clampValue((gamepadAxes[3] + 1) / 2, 0, 1); // Normalize throttle to 0-1
        } else {
            // Use keyboard input
            this.updateKeyboardControls();
        }
    }

    /**
     * @method updateKeyboardControls
     * @private
     * Updates control channels based on keyboard input.
     */
    updateKeyboardControls() {
        // Standard Controls
        if (this.keyStates['KeyA']) this.channels.yaw = this.clampValue(this.channels.yaw - this.controlRate, -1, 1);
        if (this.keyStates['KeyD']) this.channels.yaw = this.clampValue(this.channels.yaw + this.controlRate, -1, 1);
        if (this.keyStates['ArrowRight']) this.channels.pitch = this.clampValue(this.channels.pitch + this.controlRate, -1, 1);
        if (this.keyStates['ArrowLeft']) this.channels.pitch = this.clampValue(this.channels.pitch - this.controlRate, -1, 1);
        if (this.keyStates['ArrowDown']) this.channels.roll = this.clampValue(this.channels.roll - this.controlRate, -1, 1);
        if (this.keyStates['ArrowUp']) this.channels.roll = this.clampValue(this.channels.roll + this.controlRate, -1, 1);
        if (this.keyStates['KeyW']) this.channels.throttle = this.clampValue(this.channels.throttle + this.controlRate, 0, 1);
        if (this.keyStates['KeyX']) this.channels.throttle = this.clampValue(this.channels.throttle - this.controlRate, 0, 1); // Moved throttle down to KeyX

        // === Simplified Individual Motor Controls ===
        // Increase Thrust: Press and hold Motor keys (1, 2, 3, 4)
        // Decrease Thrust: Release Motor keys (thrust decreases gradually)

        // Motor 1
        if (this.keyStates['Digit1']) {
            this.motorThrusts.motor1 = this.clampValue(this.motorThrusts.motor1 + this.controlRate, 0, 1);
        } else {
            this.motorThrusts.motor1 = this.clampValue(this.motorThrusts.motor1 - this.controlRate, 0, 1);
        }

        // Motor 2
        if (this.keyStates['Digit2']) {
            this.motorThrusts.motor2 = this.clampValue(this.motorThrusts.motor2 + this.controlRate, 0, 1);
        } else {
            this.motorThrusts.motor2 = this.clampValue(this.motorThrusts.motor2 - this.controlRate, 0, 1);
        }

        // Motor 3
        if (this.keyStates['Digit3']) {
            this.motorThrusts.motor3 = this.clampValue(this.motorThrusts.motor3 + this.controlRate, 0, 1);
        } else {
            this.motorThrusts.motor3 = this.clampValue(this.motorThrusts.motor3 - this.controlRate, 0, 1);
        }

        // Motor 4
        if (this.keyStates['Digit4']) {
            this.motorThrusts.motor4 = this.clampValue(this.motorThrusts.motor4 + this.controlRate, 0, 1);
        } else {
            this.motorThrusts.motor4 = this.clampValue(this.motorThrusts.motor4 - this.controlRate, 0, 1);
        }

        // Optional: Prevent motor thrusts from decreasing below hover thrust
        // Uncomment the following lines if you want motor thrusts to not fall below hover thrust
        /*
        const hoverThrust = 0.6125; // As per PhysicsEngine settings
        this.motorThrusts.motor1 = Math.max(this.motorThrusts.motor1, hoverThrust);
        this.motorThrusts.motor2 = Math.max(this.motorThrusts.motor2, hoverThrust);
        this.motorThrusts.motor3 = Math.max(this.motorThrusts.motor3, hoverThrust);
        this.motorThrusts.motor4 = Math.max(this.motorThrusts.motor4, hoverThrust);
        */

        // Reset unused controls towards center
        this.centerUnusedControls();
    }

    /**
     * @method centerUnusedControls
     * @private
     * Gradually returns unused controls to their center positions.
     */
    centerUnusedControls() {
        if (!this.keyStates['KeyA'] && !this.keyStates['KeyD']) this.channels.yaw = this.moveTowardsCenter(this.channels.yaw, -1, 1);
        if (!this.keyStates['ArrowRight'] && !this.keyStates['ArrowLeft']) this.channels.pitch = this.moveTowardsCenter(this.channels.pitch, -1, 1);
        if (!this.keyStates['ArrowDown'] && !this.keyStates['ArrowUp']) this.channels.roll = this.moveTowardsCenter(this.channels.roll, -1, 1);
        if (!this.keyStates['KeyW'] && !this.keyStates['KeyX']) this.channels.throttle = this.moveTowardsZero(this.channels.throttle);
    }

    /**
     * @method moveTowardsCenter
     * @private
     * @param {number} value - Current value of the control channel.
     * @param {number} min - The minimum value.
     * @param {number} max - The maximum value.
     * @returns {number} The new value after moving towards the center.
     * Gradually moves a control value towards its center position.
     */
    moveTowardsCenter(value, min = -1, max = 1, rate = 0.005) {
        const center = 0; // Center for normalized channels
        if (value > center) {
            return Math.max(center, value - rate);
        } else {
            return Math.min(center, value + rate);
        }
    }

    /**
     * @method moveTowardsZero
     * @private
     * @param {number} value - Current value of the control channel.
     * @param {number} [rate=0.005] - The rate at which to move towards zero.
     * @returns {number} The new value after moving towards zero.
     * Gradually moves a control value towards zero.
     */
    moveTowardsZero(value, rate = 0.005) {
        return Math.max(0, value - rate);
    }

    /**
     * @method clampValue
     * @private
     * @param {number} value - The value to clamp.
     * @param {number} min - The minimum value.
     * @param {number} max - The maximum value.
     * @returns {number} The clamped value.
     * Clamps a value between a minimum and maximum.
     */
    clampValue(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * @method getControlInputs
     * @public
     * @returns {Object} Normalized control inputs.
     * Provides normalized control inputs:
     * - roll: -1 to 1
     * - pitch: -1 to 1
     * - yaw: -1 to 1
     * - throttle: 0 to 1
     * - motorThrusts: Each motor's thrust (0 to 1)
     */
    getControlInputs() {
        return {
            roll: this.channels.roll,          // -1 to 1
            pitch: this.channels.pitch,        // -1 to 1
            yaw: this.channels.yaw,            // -1 to 1
            throttle: this.channels.throttle,  // 0 to 1
            motorThrusts: {                     // 0 to 1
                motor1: this.motorThrusts.motor1,
                motor2: this.motorThrusts.motor2,
                motor3: this.motorThrusts.motor3,
                motor4: this.motorThrusts.motor4,
            },
        };
    }

    /**
     * @method registerScript
     * @public
     * @param {string} scriptId - Unique identifier for the script.
     * @param {Array<Object>} scriptActions - Array of actions with timestamps.
     * Each action should have a `time` (ms) and an `action` (function).
     * @example
     * registerScript('hover', [
     *   { time: 0, action: (controls) => { controls.channels.throttle = 0.5; } },
     *   { time: 1000, action: (controls) => { controls.channels.roll = 0; } },
     * ]);
     */
    registerScript(scriptId, scriptActions) {
        if (!Array.isArray(scriptActions)) {
            console.error(`Script actions must be an array. Received type: ${typeof scriptActions}`);
            return;
        }
        // Validate each action
        for (const action of scriptActions) {
            if (typeof action.time !== 'number' || typeof action.action !== 'function') {
                console.error(`Each script action must have a numeric 'time' and a function 'action'.`);
                return;
            }
        }
        this.scripts[scriptId] = scriptActions;
        console.log(`Registered script: "${scriptId}"`);
    }

    /**
     * @method executeScript
     * @public
     * @param {string} scriptId - The identifier of the script to execute.
     * Executes the script associated with the provided scriptId.
     */
    executeScript(scriptId) {
        const script = this.scripts[scriptId];
        if (script) {
            const scriptInstance = {
                id: scriptId,
                actions: [...script], // Clone to prevent mutation
                startTime: performance.now(),
                nextActionIndex: 0,
            };
            this.activeScripts.push(scriptInstance);
            console.log(`Started script: "${scriptId}"`);
        } else {
            console.warn(`Script with ID "${scriptId}" not found.`);
        }
    }

    /**
     * @method updateActiveScripts
     * @private
     * @param {number} deltaTime - Time elapsed since the last update (in milliseconds).
     * Updates and executes active scripts based on elapsed time.
     */
    updateActiveScripts(deltaTime) {
        const currentTime = performance.now();

        // Iterate over active scripts
        this.activeScripts = this.activeScripts.filter((scriptInstance) => {
            const elapsedTime = currentTime - scriptInstance.startTime;

            // Execute all actions that are due
            while (
                scriptInstance.nextActionIndex < scriptInstance.actions.length &&
                elapsedTime >= scriptInstance.actions[scriptInstance.nextActionIndex].time
            ) {
                const action = scriptInstance.actions[scriptInstance.nextActionIndex].action;
                try {
                    action(this);
                    console.log(`Executed action ${scriptInstance.nextActionIndex + 1} of script "${scriptInstance.id}" at ${elapsedTime}ms`);
                } catch (error) {
                    console.error(`Error executing action ${scriptInstance.nextActionIndex + 1} of script "${scriptInstance.id}":`, error);
                }
                scriptInstance.nextActionIndex++;
            }

            // Keep the script active if there are remaining actions
            return scriptInstance.nextActionIndex < scriptInstance.actions.length;
        });
    }

    /**
     * @method bindKeyToScript
     * @public
     * @param {string} keyCode - The keyboard key code (e.g., 'KeyS').
     * @param {string} scriptId - The identifier of the script to bind to the key.
     * @example
     * bindKeyToScript('KeyS', 'hover');
     */
    bindKeyToScript(keyCode, scriptId) {
        if (!this.scripts[scriptId]) {
            console.error(`Cannot bind key "${keyCode}" to unknown script "${scriptId}". Please register the script first.`);
            return;
        }
        this.scriptBindings[keyCode] = scriptId;
        console.log(`Bound key "${keyCode}" to script "${scriptId}".`);
    }

    /**
     * @method registerDefaultScripts
     * @private
     * Registers default scripts and binds them to specific keys.
     */
    registerDefaultScripts() {
        // Default Hover Script
        this.registerScript('hover', [
            { time: 0, action: (controls) => { 
                console.log("Hover Script: Setting throttle to mid-point for hovering.");
                controls.channels.throttle = 0.5; // Set throttle to mid-point
            } },
            { time: 1000, action: (controls) => { 
                console.log("Hover Script: Centering roll.");
                controls.channels.roll = 0;     // Center roll
            } },
            { time: 1000, action: (controls) => { 
                console.log("Hover Script: Centering pitch.");
                controls.channels.pitch = 0;    // Center pitch
            } },
            { time: 1000, action: (controls) => { 
                console.log("Hover Script: Centering yaw.");
                controls.channels.yaw = 0;      // Center yaw
            } },
        ]);
        this.bindKeyToScript('KeyS', 'hover');

        // Example Script: Perform a Yaw Spin
        this.registerScript('yawSpin', [
            { time: 0, action: (controls) => { 
                console.log("Yaw Spin Script: Initiating yaw spin");
                controls.channels.yaw = 0.2;   // Initiate yaw spin
            } },
            { time: 5000, action: (controls) => { 
                console.log("Yaw Spin Script: Stopping yaw spin");
                controls.channels.yaw = 0;   // Stop yaw spin
            } },
        ]);
        this.bindKeyToScript('KeyY', 'yawSpin');

        // Add more default scripts as needed
    }
}

export default DroneControls;
