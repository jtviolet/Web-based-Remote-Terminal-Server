# Description
The Aperture server started as an open-source, generic, web-based terminal server that I built while at General Electric. It is a websocket-based implementation that allows a linux or windows device to share its terminal with a web interface for easy access of the device, remotely. The server implements socket.io on the backend as a to share communication between your frontend and the device you want to connect to.
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

# Prerequisits
You will need to have Redis running on your server for this server to work. If you are on a Unix server, you can download redis [here](https://redis.io/download). If you are on Windows then you can download redis [here](https://github.com/MicrosoftArchive/redis/releases). By default, the application will be looking for redis on port 6379.

# Authentication
Currently authentication is implemented as a bare-bones usage of [socket.io-auth](https://github.com/facundoolano/socketio-auth). Although the feature is implemented, it is up to you to personalize your authentication to your required parameters. The authentication currently allows any user or device to connect.

# Install and Run
This application should be able to run on any Windows or Unix machine. Make sure redis is installed and then follow these steps:
```
git clone https://github.com/jtviolet/aperture-server.git
cd aperture-server
npm start
```

# Configuration
All configuration for the server is stored in `/lib/config.json`. Currently the only config item you could/should change is the port.

# Usage
You will need to have the [aperture-edge-client](https://github.com/jtviolet/aperture-edge-client) running on the devices you want to connect to. This server will also sit and wait for users to connect via a web interface, which I'll be sharing an example in [jtviolet/aperture-client-web](https://github.com/jtviolet/aperture-client-web) soon.

# Upcomming Features / TODO
Please submit pull requests if you'd like to work on any of these features:
  * API Documentation for creating your own front-end
  * Finish Redis implementation for scaling horizontally
  * Ability to group devices and users by namespace in socket.io
  * Ability for users to set pretty names for devices
  * Finish tests preceeded with a period in the test folder

# Contributing
If you feel you can improve this service in any way, I'm happy to accept pull requests for the good of the service. I'm pretty new to Node.js/JavaScript and there is always room for improvement; feel free to submit pull requests.
