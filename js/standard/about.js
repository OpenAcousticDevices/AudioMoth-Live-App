/****************************************************************************
 * about.js
 * openacousticdevices.info
 * June 2017
 *****************************************************************************/

'use strict';

/* global document */

const electron = require('electron');
const {app, process} = require('@electron/remote');

const nightMode = require('./js/standard/nightMode.js');

const versionDisplay = document.getElementById('version-display');
const electronVersionDisplay = document.getElementById('electron-version-display');
const websiteLink = document.getElementById('website-link');

versionDisplay.textContent = 'Version ' + app.getVersion();
electronVersionDisplay.textContent = 'Running on Electron version ' + process.versions.electron;

electron.ipcRenderer.on('night-mode', (e, nm) => {

    if (nm !== undefined) {

        nightMode.setNightMode(nm);

    } else {

        nightMode.toggle();

    }

});

websiteLink.addEventListener('click', () => {

    electron.shell.openExternal('https://openacousticdevices.info');

});
