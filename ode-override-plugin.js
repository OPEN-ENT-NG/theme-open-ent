const fs = require("fs");
const path = require("path");

async function mergeOverrideJson(){
    const overrideDir = process.env.OVERRIDE_SRC;
    const outputDir = process.env.OVERRIDE_DIST;
    const templateOverrideDest = path.join(outputDir, "template", "override.json");
    const templateOverrideChild = path.join(overrideDir, "template", "override.json");
    const templateOverrideRoot = path.join("template", "override.json");
    const childExists = await fs.promises.access(templateOverrideChild).then(e => true).catch(e => false)
    if(childExists){
        const parentJson = JSON.parse((await fs.promises.readFile(templateOverrideRoot)).toString());
        const childJson = JSON.parse((await fs.promises.readFile(templateOverrideChild)).toString());
        for (const key in childJson) {
            const parentTab = parentJson[key] || []
            const childTab = childJson[key] || []
            parentJson[key] = [...parentTab,...childTab];
        }
        await fs.promises.writeFile(templateOverrideDest, JSON.stringify(parentJson, null, 2))
    }
}

async function mergeOneFileI18N(base, app, parent) {
    try {
        const overrideDir = process.env.OVERRIDE_SRC;
        const outputDir = process.env.OVERRIDE_DIST;
        const parentFile = path.join(base, parent);
        const childFile = path.join(overrideDir, "i18n", app, parent)
        const destDir = path.join(outputDir, "i18n", app)
        const destFile = path.join(destDir, parent)
        //console.log('Merge Parent file:', parentFile, "child file: ", childFile, "destFile: ", destFile);
        const childExists = await fs.promises.access(childFile).then(e => true).catch(e => false)
        //console.log('Child exists:', childFile, childExists);
        const parentJson = JSON.parse((await fs.promises.readFile(parentFile)).toString());
        const childJson = childExists ? JSON.parse((await fs.promises.readFile(childFile)).toString()) : {};
        for (const key in childJson) {
            parentJson[key] = childJson[key];
        }
        (await fs.promises.mkdir(destDir, { recursive: true }).catch(e => true));
        await fs.promises.writeFile(destFile, JSON.stringify(parentJson, null, 2))
    } catch (e) {
        console.error("Failed to merge file: ", base, app, parent, e)
        throw e;
    }
}

async function mergeOneAppI18N(base, app) {
    try {
        //console.log('Merging app:', base, app);
        const baseApp = path.join(base, app);
        const parentFiles = await fs.promises.readdir(baseApp)
        const promises = []
        for (const parentFile of parentFiles) {
            promises.push(mergeOneFileI18N(baseApp, app, parentFile));
        }
    } catch (e) {
        console.error("Failed to merge app: ", base, app, e)
        throw e;
    }
}

async function mergeAllI18N() {
    try {
        //read assets dir
        const BASE = "assets/i18n/";
        const apps = await fs.promises.readdir(BASE)
        const promises = []
        for (const app of apps) {
            promises.push(mergeOneAppI18N(BASE, app));
        }
        await Promise.all(promises);
        await mergeOverrideJson();
    } catch (e) {
        console.error("Failed to merge i18n: ", e)
        throw e;
    }
}

mergeAllI18N()