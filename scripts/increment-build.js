#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const infoPlistPath = path.join(__dirname, '..', 'ios', 'Plantus', 'Info.plist');
const pbxprojPath = path.join(__dirname, '..', 'ios', 'Plantus.xcodeproj', 'project.pbxproj');

try {
  // ---- 1. Читаем app.json и считаем новый buildNumber ----
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  const currentBuildNumber = parseInt(appJson.expo.ios?.buildNumber || '1', 10);
  const newBuildNumber = (currentBuildNumber + 1).toString();

  if (!appJson.expo.ios) {
    appJson.expo.ios = {};
  }
  appJson.expo.ios.buildNumber = newBuildNumber;
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

  // ---- 2. Обновляем CFBundleVersion в Info.plist ----
  try {
    const infoPlist = fs.readFileSync(infoPlistPath, 'utf8');
    const updatedInfoPlist = infoPlist.replace(
      /<key>CFBundleVersion<\/key>\s*<string>[^<]*<\/string>/s,
      `<key>CFBundleVersion</key>\n    <string>${newBuildNumber}</string>`
    );
    fs.writeFileSync(infoPlistPath, updatedInfoPlist);
  } catch (e) {
    console.warn('⚠️ Не удалось обновить Info.plist:', e.message);
  }

  // ---- 3. Обновляем CURRENT_PROJECT_VERSION в project.pbxproj ----
  try {
    const pbxproj = fs.readFileSync(pbxprojPath, 'utf8');
    const updatedPbxproj = pbxproj.replace(
      /CURRENT_PROJECT_VERSION = \d+;/g,
      `CURRENT_PROJECT_VERSION = ${newBuildNumber};`
    );
    fs.writeFileSync(pbxprojPath, updatedPbxproj);
  } catch (e) {
    console.warn('⚠️ Не удалось обновить project.pbxproj:', e.message);
  }

  console.log(`✓ Build number увеличен: ${currentBuildNumber} → ${newBuildNumber}`);
  console.log(`   CFBundleVersion и CURRENT_PROJECT_VERSION установлены в ${newBuildNumber}`);

  process.exit(0);
} catch (error) {
  console.error('✗ Ошибка при увеличении build number:', error.message);
  process.exit(1);
}
