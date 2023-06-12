import got from "got";
import tunnel from "tunnel";

import { Timeline, parseTimelineV2 } from "./timeline.js";
import { createServer } from "./server.js";
import { getTextFromImage } from "./ocr.js";
import "./env.js";

// A certain fast casual restaurant serving burritos, bowls, and other delicious things
const MONITOR_USER_ID = "141341662";

const MONITOR_INTERVAL = process.env["MOCK_CODES"] ? 1000 : 10000;

const MONITOR_PROXY_STR = process.env["MONITOR_PROXY"];

if (!MONITOR_PROXY_STR) {
    console.error("MONITOR_PROXY env variable not set");
    process.exit(1);
}

const [host, port, user, pass] = MONITOR_PROXY_STR.split(":");

const proxyAuth = user && pass ? `${user}:${pass}` : undefined;

const proxyArgs: tunnel.ProxyOptions = {
    host: host ?? "localhost",
    port: parseInt(port ?? "8888"),
};

if (proxyAuth) {
    proxyArgs.proxyAuth = proxyAuth;
}

const agent = {
    http: tunnel.httpOverHttp({
        proxy: proxyArgs,
    }),
    https: tunnel.httpsOverHttp({
        proxy: proxyArgs,
    }),
};

const client = got.extend({
    headers: {
        "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
        connection: "keep-alive",
        authorization:
            "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
        "content-type": "application/json",
        "x-guest-token": "",
        "x-twitter-active-user": "yes",
        authority: "api.twitter.com",
        "accept-encoding": "gzip",
        "accept-language": "en-US,en;q=0.9",
        accept: "*/*",
        DNT: "1",
    },
    // @ts-expect-error Something is off with either the got types or the tunnel types
    agent,
});

export async function getToken() {
    const response = await client<{
        guest_token: string;
    }>("https://api.twitter.com/1.1/guest/activate.json", {
        method: "POST",
        responseType: "json",
    });

    return response.body.guest_token;
}

export async function getTweets(token: string) {
    const response = await client<Timeline>("https://twitter.com/i/api/graphql/UGi7tjRPr-d_U3bCPIko5Q/UserTweets", {
        searchParams: {
            variables: `{"userId":"${MONITOR_USER_ID}","count":3,"includePromotedContent":true,"withQuickPromoteEligibilityTweetFields":true,"withVoice":true,"withV2Timeline":true}`,
            features:
                '{"rweb_lists_timeline_redesign_enabled":true,"responsive_web_graphql_exclude_directive_enabled":true,"verified_phone_label_enabled":false,"creator_subscriptions_tweet_preview_api_enabled":true,"responsive_web_graphql_timeline_navigation_enabled":true,"responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,"tweetypie_unmention_optimization_enabled":true,"vibe_api_enabled":true,"responsive_web_edit_tweet_api_enabled":true,"graphql_is_translatable_rweb_tweet_is_translatable_enabled":true,"view_counts_everywhere_api_enabled":true,"longform_notetweets_consumption_enabled":true,"tweet_awards_web_tipping_enabled":false,"freedom_of_speech_not_reach_fetch_enabled":true,"standardized_nudges_misinfo":true,"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled":false,"interactive_text_enabled":true,"responsive_web_text_conversations_enabled":false,"longform_notetweets_rich_text_read_enabled":true,"longform_notetweets_inline_media_enabled":false,"responsive_web_enhance_cards_enabled":false}',
        },
        headers: {
            "x-guest-token": token,
        },
        responseType: "json",
    });

    return response;
}

function snowflakeToTime(tweetId: number) {
    return new Date(tweetId / 2 ** 22 + 1288834974657);
}

// logic

const setCodeServer = createServer();

let lastSentTime = 0;

const send = (codes: string[]) => {
    // In some edge cases this might miss a burrito but it prevents some weird things from
    // happening with OCR especially
    if (Date.now() - lastSentTime < 10_000) {
        return;
    }
    const last = codes[codes.length - 1];
    if (last) {
        setCodeServer(last);
        lastSentTime = Date.now();
    }
};

const seenTweetIds = new Set<string>();

function findBurrito(text: string) {
    const codeRegex = /\s([A-Z0-9\-\_\$\%]{6,})\s/g;

    const phoneRegex = /888\-?222/;

    // it must match both regexes
    const condition = codeRegex.test(text) && phoneRegex.test(text);

    if (!condition) {
        return false;
    }

    // Now extract all matches that match the code regex but not the phone regex
    const matches = text.match(codeRegex)?.filter(match => !phoneRegex.test(match));

    if (!matches) {
        return false;
    }

    // now extract the actual codes from the matches
    const codes = matches.map(match => match.match(/([A-Z0-9\-\_\$\%]{6,})/)?.[1] ?? "");

    return codes;
}

let token = "";
let errors = 0;

const refreshToken = () => {
    return getToken().then(newToken => {
        token = newToken;
        console.log("Refreshed token");
        errors = 0;
        return token;
    });
};

async function monitorLogic() {
    try {
        const tweets = await getTweets(token);

        const now = Date.now();
        const parsed = parseTimelineV2(tweets.body.data.user.result.timeline_v2);

        for (const tweet of parsed) {
            if (seenTweetIds.has(tweet.id)) {
                continue;
            }

            seenTweetIds.add(tweet.id);

            const time = snowflakeToTime(parseInt(tweet.id));
            const lateness = now - time.getTime();
            console.log(tweet, time);
            console.log(`Detected ${now - time.getTime()}ms late`);

            if (lateness < 10_000) {
                const burrito = findBurrito(tweet.text);

                if (burrito) {
                    send(burrito);
                    console.log("BURRITO detected", burrito);
                    console.log(`Code was sent ${Date.now() - time.getTime()}ms late`);
                }

                if (tweet.image) {
                    try {
                        const text = await getTextFromImage(tweet.image);

                        const burrito = findBurrito(text);

                        if (burrito) {
                            send(burrito);
                            console.log("BURRITO detected", burrito);
                            console.log(`Code was sent ${Date.now() - time.getTime()}ms late`);
                        }
                    } catch (e) {
                        console.error("OCR Error", e);
                    }
                }
            }
        }
    } catch (e) {
        errors++;
        console.error(`Monitor error ${errors}`);
        // The lazy way of knowing we need to refresh the token
        if (errors > 5) {
            refreshToken();
        }
    }
}

refreshToken().then(() => {
    setInterval(monitorLogic, MONITOR_INTERVAL);
});

if (process.env["MOCK_CODES"]) {
    let fakeCodeIndex = 0;

    setInterval(() => {
        send([`FAKE${fakeCodeIndex++}`]);
    }, 10_000);
}

// for safety let's shut down the process after 6 hours, so as to not waste proxy data
setTimeout(() => {
    console.log("Shutting down");
    process.exit(0);
}, 1000 * 60 * 60 * 6);
