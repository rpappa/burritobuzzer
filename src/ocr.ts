import { createWorker, createScheduler } from "tesseract.js";

let initialized = false;

const createAndInitWorker = async () => {
    const worker = await createWorker({
        logger: () => {},
        errorHandler: () => {},
    });

    await worker.loadLanguage("eng");
    await worker.initialize("eng");

    scheduler.addWorker(worker);

    initialized = true;
};

const createWorkerPromise = createAndInitWorker();

const scheduler = createScheduler();

export async function getTextFromImage(imgUrl: string) {
    if (!initialized) {
        await createWorkerPromise;
    }

    const {
        data: { text },
    } = await scheduler.addJob("recognize", imgUrl);

    return text;
}
