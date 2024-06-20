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

let mainWindow, aboutWindow, gainWindow;

const iconLocation = (process.platform === 'linux') ? '/build/icon.png' : '/build/icon.ico';
const standardWindowSettings = {
    resizable: false,
    fullscreenable: false,
    minimizable: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, iconLocation),
    useContentSize: true,
    webPreferences: {
        enableRemoteModule: true,
        nodeIntegration: true,
        contextIsolation: false
    }
};

const MENU_HEIGHT = 20;

let simulationIndex = -1;
let simulationCount = 0;
let isSimulating = false;

const COLOUR_MAP_DEFAULT = 0;
const COLOUR_MAP_MONOCHROME = 1;
const COLOUR_MAP_INVERSE_MONOCHROME = 2;
const COLOUR_COUNT = 3;

function shrinkWindowHeight (windowHeight) {

    if (process.platform === 'darwin') {

        windowHeight -= 20;

    } else if (process.platform === 'linux') {

        windowHeight -= 50;

    }

    return windowHeight;

}

/* Generate settings objects for windows and progress bars */

function generateSettings (width, height, title) {

    const uniqueSettings = {
        width,
        height,
        title,
        show: false
    };

    const settings = Object.assign({}, standardWindowSettings, uniqueSettings);

    settings.parent = mainWindow;

    return settings;

}

function openGainWindow () {

    if (gainWindow) {

        gainWindow.webContents.send('get-settings');

        gainWindow.show();

        return;

    }

    let windowWidth = 448;
    const windowHeight = 140;

    if (process.platform === 'linux') {

        windowWidth = 443;

    } else if (process.platform === 'darwin') {

        windowWidth = 443;

    }

    const settings = generateSettings(windowWidth, windowHeight, 'Set Gain');
    gainWindow = new BrowserWindow(settings);

    gainWindow.setMenu(null);
    gainWindow.loadURL(path.join('file://', __dirname, '/gain.html'));

    gainWindow.setFullScreenable(false);

    require('@electron/remote/main').enable(gainWindow.webContents);

    gainWindow.on('close', (e) => {

        e.preventDefault();

        gainWindow.hide();

    });

    gainWindow.webContents.on('dom-ready', () => {

        mainWindow.webContents.send('poll-night-mode');
        gainWindow.webContents.send('is-simulating', isSimulating);

        setTimeout(() => {

            gainWindow.show();

        }, 100);

    });

    ipcMain.on('night-mode-poll-reply', (e, nightMode) => {

        if (gainWindow) {

            gainWindow.webContents.send('night-mode', nightMode);

        }

    });

}

function openAboutWindow () {

    if (aboutWindow) {

        aboutWindow.show();

        return;

    }

    let windowWidth = 400;
    let windowHeight = 310;

    if (process.platform === 'linux') {

        windowWidth = 395;
        windowHeight = 310;

    } else if (process.platform === 'darwin') {

        windowWidth = 395;
        windowHeight = 310;

    }

    const settings = generateSettings(windowWidth, windowHeight, 'About');
    aboutWindow = new BrowserWindow(settings);

    aboutWindow.setMenu(null);
    aboutWindow.loadURL(path.join('file://', __dirname, '/about.html'));

    aboutWindow.setFullScreenable(false);

    require('@electron/remote/main').enable(aboutWindow.webContents);

    aboutWindow.on('close', (e) => {

        e.preventDefault();

        aboutWindow.hide();

    });

    aboutWindow.webContents.on('dom-ready', () => {

        mainWindow.webContents.send('poll-night-mode');
        aboutWindow.show();

    });

    ipcMain.on('night-mode-poll-reply', (e, nightMode) => {

        if (aboutWindow) {

            aboutWindow.webContents.send('night-mode', nightMode);

        }

    });

}

function toggleNightMode () {

    mainWindow.webContents.send('night-mode');

    if (aboutWindow) {

        aboutWindow.webContents.send('night-mode');

    }

    if (gainWindow) {

        gainWindow.webContents.send('night-mode');

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
    mainWindow.webContents.send('simulate', simulationIndex);

}

function uncheckSimulations () {

    const menu = Menu.getApplicationMenu();

    for (let i = 0; i < simulationCount; i++) {

        const menuItem = menu.getMenuItemById('simulation_' + i);

        menuItem.checked = false;

    }

    simulationIndex = -1;

}

function updateColours (colourMapIndex) {

    const menu = Menu.getApplicationMenu();

    for (let i = 0; i < COLOUR_COUNT; i++) {

        const menuItem = menu.getMenuItemById('colour_' + i);

        menuItem.checked = i === colourMapIndex;

    }

    mainWindow.webContents.send('change-colours', colourMapIndex);

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

                mainWindow.webContents.send('change-save-destination');

            }
        }, {
            type: 'separator'
        }, {
            label: 'Show AudioMoth Gain Controls',
            accelerator: 'CommandOrControl+G',
            click: openGainWindow
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

                mainWindow.webContents.send('high-sample-rate-default', menuItem.checked);

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

                mainWindow.webContents.send('local-time', menu.getMenuItemById('localTime').checked);

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
        label: 'Colour',
        submenu: [{
            label: 'Default',
            id: 'colour_0',
            checked: true,
            type: 'checkbox',
            click: () => {

                updateColours(COLOUR_MAP_DEFAULT);

            }
        }, {
            label: 'Monochrome',
            id: 'colour_1',
            checked: false,
            type: 'checkbox',
            click: () => {

                updateColours(COLOUR_MAP_MONOCHROME);

            }
        }, {
            label: 'Inverse monochrome',
            id: 'colour_2',
            checked: false,
            type: 'checkbox',
            click: () => {

                updateColours(COLOUR_MAP_INVERSE_MONOCHROME);

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

                mainWindow.webContents.send('low-amp-colour-scale', menuItem.checked);

            }
        }]
    }, {
        label: 'Help',
        submenu: [{
            label: 'About',
            click: openAboutWindow
        }, {
            label: 'Check For Updates',
            click: () => {

                mainWindow.webContents.send('update-check');

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

    mainWindow = new BrowserWindow({
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

    mainWindow.loadURL(path.join('file://', __dirname, '/index.html'));

    // Show devtools in production
    // win.webContents.openDevTools();

    require('@electron/remote/main').enable(mainWindow.webContents);

    mainWindow.on('resize', () => {

        mainWindow.webContents.send('resize');

    });

    if (smallSize) {

        mainWindow.webContents.send('resize');

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

    ipcMain.on('redraw', () => {

        if (gainWindow) {

            gainWindow.webContents.send('get-settings');

        }

    });

    ipcMain.on('is-simulating', (e, is) => {

        isSimulating = is;

        if (gainWindow) {

            gainWindow.webContents.send('is-simulating', isSimulating);

        }

    });

    ipcMain.on('app-quit', () => {

        mainWindow.close();
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
