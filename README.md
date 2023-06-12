# Burrito Buzzer

Monitors your favorite fast casual burrito restaurant's Twitter page. Detects promo codes for a free burrito and sends them to an [iOS shortcut](https://www.icloud.com/shortcuts/8bd04ed548074484954f47f7241b27c2).

## Running

Requires node.js to be installed.

First create your `.env` file in the same directory as `package.json` with:

```
MONITOR_PROXY=[insert your proxy in host:port:user:pass format]
SHORTCUT_URL=https://www.icloud.com/shortcuts/8bd04ed548074484954f47f7241b27c2
```

For proxies [packetstream](https://packetstream.io/) is recommended and is cheap at $1 per gigabyte of data. Any rotating proxy should work here (on packetstream, the randomize IP option is recommended).

Then install dependencies:

```
npm install
```

Finally run:

```
npm start
```

The server listens on port 9090, so visit on your iPhone:

```
http://[ip]:9090
```
