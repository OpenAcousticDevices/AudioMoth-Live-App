/****************************************************************************
 * main.js
 * openacousticdevices.info
 * September 2022
 *****************************************************************************/

const {app, BrowserWindow, ipcMain, Menu, shell, MenuItem, screen, systemPreferences} = require('electron');

require('@electron/remote/main').initialize();

require('electron-debug')({
    showDevTools: true,
    devToolsMode: 'undocked'
});

const path = require('path');

var win, aboutWindow;

const MENU_HEIGHT = 20;

let simulationIndex = -1;
let simulationCount = 0;

function shrinkWindowHeight (windowHeight) {

    if (process.platform === 'darwin') {

        windowHeight -= 20;

    } else if (process.platform === 'linux') {

        windowHeight -= 50;

    }

    return windowHeight;

}

function openAboutWindow () {

    if (aboutWindow) {

        return;

    }

    const iconLocation = (process.platform === 'linux') ? '/build/icon.png' : '/build/icon.ico';

    aboutWindow = new BrowserWindow({
        width: 400,
        height: shrinkWindowHeight(320),
        title: 'About AudioMoth Live App',
        resizable: false,
        fullscreenable: false,
        icon: path.join(__dirname, iconLocation),
        parent: win,
        webPreferences: {
            enableRemoteModule: true,
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    aboutWindow.setMenu(null);
    aboutWindow.loadURL(path.join('file://', __dirname, '/about.html'));

    require('@electron/remote/main').enable(aboutWindow.webContents);

    aboutWindow.on('close', () => {

        aboutWindow = null;

    });

    aboutWindow.webContents.on('dom-ready', () => {

        win.webContents.send('poll-night-mode');

    });

    ipcMain.on('night-mode-poll-reply', (e, nightMode) => {

        if (aboutWindow) {

            aboutWindow.webContents.send('night-mode', nightMode);

        }

    });

}

function toggleNightMode () {

    win.webContents.send('night-mode');

    if (aboutWindow) {

        aboutWindow.webContents.send('night-mode');

    }

}

function simulate (index) {

    const menu = Menu.getApplicationMenu();

    for (let i = 0; i < simulationCount; i++) {

        const menuItem = menu.getMenuItemById('simulation_' + i);

        // If the same menu item is selected twice in a row, disable simulations

        menuItem.checked = i === index && index !== simulationIndex;

    }

    simulationIndex = index === simulationIndex ? -1 : index;
    win.webContents.send('simulate', simulationIndex);

}

function uncheckSimulations () {

    const menu = Menu.getApplicationMenu();

    for (let i = 0; i < simulationCount; i++) {

        const menuItem = menu.getMenuItemById('simulation_' + i);

        menuItem.checked = false;

    }

    simulationIndex = -1;

}

const createWindow = () => {

    const iconLocation = (process.platform === 'linux') ? '/build/icon.png' : '/build/icon.ico';

    const screenH = screen.getPrimaryDisplay().bounds.height;
    const smallSize = screenH <= 768;

    const minW = 1024;
    const minH = 320 + MENU_HEIGHT;

    const w = minW;
    const h = shrinkWindowHeight(smallSize ? 640 : 768);

    const menuTemplate = [{
        label: 'File',
        submenu: [{
            label: 'Set File Destination',
            accelerator: 'CommandOrControl+S',
            click: () => {

                win.webContents.send('change-save-destination');

            }
        }, {
            type: 'separator'
        }, {
            type: 'checkbox',
            id: 'highSampleRateDefault',
            label: 'Enable High Sample Rate For Default Input',
            accelerator: 'CommandOrControl+H',
            checked: false,
            click: () => {

                const menuItem = menu.getMenuItemById('highSampleRateDefault');

                win.webContents.send('high-sample-rate-default', menuItem.checked);

            }
        }, {
            type: 'separator'
        }, {
            type: 'checkbox',
            id: 'lowAmpColourScale',
            label: 'Enable Low-Amplitude Colour Scale',
            accelerator: 'CommandOrControl+J',
            checked: false,
            click: () => {

                const menuItem = menu.getMenuItemById('lowAmpColourScale');

                win.webContents.send('low-amp-colour-scale', menuItem.checked);

            }
        }, {
            type: 'separator'
        }, {
            type: 'checkbox',
            id: 'localTime',
            label: 'Local Time',
            accelerator: 'CommandOrControl+T',
            checked: true,
            click: () => {

                win.webContents.send('local-time', menu.getMenuItemById('localTime').checked);

            }
        }, {
            type: 'checkbox',
            id: 'nightmode',
            label: 'Night Mode',
            accelerator: 'CommandOrControl+N',
            checked: false,
            click: toggleNightMode
        }, {
            type: 'separator'
        }, {
            label: 'Quit',
            accelerator: 'CommandOrControl+Q',
            click: function () {

                app.quit();

            }
        }]
    }, {
        label: 'Simulate',
        id: 'simulationMenu',
        submenu: []
    }, {
        label: 'Help',
        submenu: [{
            label: 'About',
            click: () => {

                openAboutWindow();

            }
        }, {
            label: 'Check For Updates',
            click: () => {

                win.webContents.send('update-check');

            }
        }, {
            type: 'separator'
        }, {
            label: 'AudioMoth Filter Playground',
            click: () => {

                shell.openExternal('https://playground.openacousticdevices.info/');

            }
        }, {
            type: 'separator'
        }, {
            label: 'Open Acoustic Devices Website',
            click: () => {

                shell.openExternal('https://openacousticdevices.info');

            }
        }]
    }];

    const menu = Menu.buildFromTemplate(menuTemplate);

    Menu.setApplicationMenu(menu);

    win = new BrowserWindow({
        width: w,
        height: h,
        useContentSize: true,
        minWidth: minW,
        minHeight: minH,
        resizable: true,
        fullscreenable: true,
        icon: path.join(__dirname, iconLocation),
        webPreferences: {
            enableRemoteModule: true,
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false
        }
    });

    win.loadURL(path.join('file://', __dirname, '/index.html'));

    // Show devtools in production
    // win.webContents.openDevTools();

    require('@electron/remote/main').enable(win.webContents);

    win.on('resize', () => {

        win.webContents.send('resize');

    });

    if (smallSize) {

        win.webContents.send('resize');

    }

    ipcMain.on('simulation-info', (e, simInfo) => {

        simulationCount = simInfo.descriptions.length;

        const simulationMenu = menu.items[1].submenu;

        for (let i = 0; i < simInfo.descriptions.length; i++) {

            const item = new MenuItem({
                id: 'simulation_' + i,
                label: simInfo.descriptions[i],
                type: 'checkbox',
                checked: false,
                click: function () {

                    simulate(i);

                }
            });

            simulationMenu.append(item);

        }

        Menu.setApplicationMenu(menu);

    });

    ipcMain.on('simulation-failed', uncheckSimulations);

    ipcMain.on('set-paused', (e, paused) => {

        const menu = Menu.getApplicationMenu();

        for (let i = 0; i < simulationCount; i++) {

            const menuItem = menu.getMenuItemById('simulation_' + i);

            menuItem.enabled = !paused;

        }

        const localTimeMenuItem = menu.getMenuItemById('localTime');
        localTimeMenuItem.enabled = !paused;

        const highSampleRateMenuItem = menu.getMenuItemById('highSampleRateDefault');
        highSampleRateMenuItem.enabled = !paused;

        const lowAmpSpecScaleMenuItem = menu.getMenuItemById('lowAmpColourScale');
        lowAmpSpecScaleMenuItem.enabled = !paused;

    });

    ipcMain.on('app-quit', () => {

        win.close();
        app.quit();

    });

};

app.commandLine.appendSwitch('disable-renderer-backgrounding');

app.whenReady().then(() => {

    if (process.platform === 'darwin') {

        const microphone = systemPreferences.askForMediaAccess('microphone');

    }

    createWindow();

    app.on('activate', () => {

        if (BrowserWindow.getAllWindows().length === 0) {

            createWindow();

        }

    });

});

app.on('window-all-closed', () => {

    app.quit();

});
