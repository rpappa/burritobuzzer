import http from "http";
import path from "path";
import fs from "fs/promises";

import "./env.js";

const indexHtmlLocation = path.join(process.cwd(), "web", "index.html");

const SHORTCUT_URL = process.env["SHORTCUT_URL"];

const RESPONSE_DELAY = 200;

export function createServer() {
    // create a server that listens to /code and /last
    // /code takes a query param ?last=XXXX and returns code only if it's different from last, otherwise returns empty string
    // /last returns the last code

    let code = "NOCODEYET";

    fs.readFile(indexHtmlLocation, "utf-8").then(templateHtml => {
        if (!SHORTCUT_URL) {
            console.error("SHORTCUT_URL env variable not set");
            process.exit(1);
        }

        const html = templateHtml.replace("{{SHORTCUT_URL}}", SHORTCUT_URL);

        const server = http.createServer((req, res) => {
            if (req.url?.startsWith("/code")) {
                res.writeHead(200, { "Content-Type": "application/json" });
                let last = req.url.split("=")[1];

                if (!last || last.length > 60) {
                    res.end(JSON.stringify({}));
                    return;
                }

                last = Buffer.from(decodeURIComponent(last), "base64").toString("utf-8");

                if (last !== code) {
                    // This is in a timeout, because it's easier to delay the shortcut loop this way
                    // than adding a delay in the shortcut itself
                    setTimeout(() => {
                        res.end(
                            JSON.stringify({
                                code,
                                isNew: true,
                            })
                        );
                    }, RESPONSE_DELAY);
                } else {
                    res.end(JSON.stringify({}));
                }
            } else if (req.url === "/last") {
                res.writeHead(200, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
                res.end(code);
            } else if (req.url === "/") {
                res.writeHead(200, { "Content-Type": "text/html; charset=UTF-8" });
                res.end(html);
            } else {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Not found");
            }
        });

        server.listen(9090, "0.0.0.0", () => {
            console.log("Server listening on port 9090");
        });
    });

    return (newCode: string) => {
        code = newCode;
    };
}
