# AudioMoth-Live-App
An Electron-based application for recording and analysing live audio from high sample rate microphones, including the AudioMoth USB Microphone.

For more details on the device itself, visit [www.openacousticdevices.info](http://www.openacousticdevices.info).

### Usage ###
Once the repository has been cloned, you must either have electron-builder installed globally, or get it for the app specifically by running:
```
npm install
```

From then onwards, start the application with:
```
npm run start 
```

Package the application into an installer for your current platform with:
```
npm run dist [win64/win32/mac/linux]
```

This will place a packaged version of the app and an installer for the platform this command was run on into the `/dist` folder. Note that to sign the binary in macOS you will need to run the command above as 'sudo'. The codesign application will retrieve the appropriate certificate from Keychain Access.

For detailed usage instructions of the app itself and to download prebuilt installers of the latest stable version for all platforms, visit [AudioMoth Labs](https://www.openacousticdevices.info/labs).

## Linux and Raspberry Pi ##

In order to run the app on a Linux machine, you must first set a udev rule which gives the application the required permissions. Navigate to `/lib/udev/rules.d/` and either create a new file or append to an existing file with the name `99-audiomoth.rules` the following:

```
SUBSYSTEM=="usb", ATTRS{idVendor}=="16d0", ATTRS{idProduct}=="06f3", MODE="0666"
```

Furthermore, older Linux releases used PulseAudio to allow applications to connect with audio devices. Increasingly, Linux releases are moving to PipeWire. This includes Raspberry Pi OS Bookworm onwards and Ubunbu 24.04 LTS onwards.

By default, PulseAudio supports all sample rates. However, PipeWire does not. This will show up as recordings with no high frequency components.

You can check the installed audio server with:

```
> pactl info
```

If the `Server Name` response mentions `PipeWire`, even in combination with `PulseAudio`, then PipeWire is being used.

To allow PipeWire to use all the available sample rates, you need to edit the PipeWire configuration:

```
> sudo nano /usr/share/pipewire/pipewire.conf
```

Uncomment and change the following two lines from:

```
#default.clock.rate          = [ 48000 ] 
#default.clock.allowed-rates = [ 48000 ] 
```

to:

```
default.clock.rate          = [ 48000 ] 
default.clock.allowed-rates = [ 8000, 16000, 32000, 48000, 96000, 192000, 250000, 384000 ] 
```

### Related Repositories ###
* [AudioMoth USB Microphone firmware](https://github.com/OpenAcousticDevices/AudioMoth-USB-Microphone)
* [AudioMoth USB Microphone App](https://github.com/OpenAcousticDevices/AudioMoth-USB-Microphone-App)

### License ###

Copyright 2023 [Open Acoustic Devices](http://www.openacousticdevices.info/).

[MIT license](http://www.openacousticdevices.info/license).
