/****************************************************************************
 * index.js
 * openacousticdevices.info
 * May 2024
 *****************************************************************************/

'use strict';

/* jslint bitwise: true, nomen: true */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const pckg = require('./package.json');
exports.version = pckg.version;

/* Generate command line instruction */

let executable = 'AudioMoth-USB-Microphone-macOS';

if (process.platform === 'win32') {

    if (process.arch === 'ia32') {

        executable = 'AudioMoth-USB-Microphone-windows32.exe';

    } else {

        executable = 'AudioMoth-USB-Microphone-windows.exe';

    }

}

if (process.platform === 'linux') {

    executable = 'AudioMoth-USB-Microphone-linux';

}

let directory = path.join(__dirname, 'bin');

const unpackedDirectory = directory.replace('app.asar', 'app.asar.unpacked');

if (fs.existsSync(directory)) {

    directory = unpackedDirectory;

}

const command = '"' + path.join(directory, executable) + '" ';

/* Main device functions */

function writeToDevice (cmd, callback) {

    child_process.exec(cmd, (error, stdout) => {

        if (error) {

            callback('[ERROR] - ' + error);

        } else {

            if (stdout.slice(0, 4) === 'NULL') {

                callback(null);

            } else if (stdout.slice(0, 5) === 'ERROR') {

                callback('[ERROR] - ' + stdout.slice(7, stdout.length - 1));

            } else {

                callback(stdout);

            }

        }

    });

}

/* Exported module functions */

exports.list = (callback) => {

    const cmd = command + 'list';

    writeToDevice(cmd, callback);

};

exports.read = (callback) => {

    const cmd = command + 'read';

    writeToDevice(cmd, callback);

};

exports.update = (gain, isLowRange, callback) => {

    console.log('Gain = ' + gain + ', lgr = ' + isLowRange);

    let cmd = command + 'update ';
    cmd += isLowRange ? 'lgr ' : '';
    cmd += 'gain ' + gain;

    writeToDevice(cmd, callback);

};

exports.restore = (callback) => {

    const cmd = command + 'restore';

    writeToDevice(cmd, callback);

};
