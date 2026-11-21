#!/usr/bin/env bash
# Makes the iPhone project (ios/) and puts in the Club Rival icon, splash and permission wording.
# Codemagic runs this on its Mac. Safe to run again.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d ios ] || npx cap add ios
npx cap sync ios
P=ios/App/App/Info.plist
pb() { /usr/libexec/PlistBuddy -c "Delete :$1" "$P" 2>/dev/null || true; /usr/libexec/PlistBuddy -c "Add :$1 $2 $3" "$P"; }
pb NSLocationWhenInUseUsageDescription string "Club Rival uses your location only while you record a walk, run or ride in one of the Rival apps, to draw your route and time your pace."
pb NSLocationAlwaysAndWhenInUseUsageDescription string "Club Rival uses your location only while you record a walk, run or ride in one of the Rival apps, to draw your route and time your pace."
pb NSMotionUsageDescription string "Club Rival uses the motion sensors to count steps in Stride Rival and, if you turn it on, to notice movement in Rest Rival."
pb NSMicrophoneUsageDescription string "Club Rival uses the microphone when you talk to your coach or say a command like Coach, start, and if you turn on Sound in Rest Rival. Nothing is recorded or uploaded."
pb NSSpeechRecognitionUsageDescription string "Club Rival turns what you say to your coach into words so it can answer and press buttons for you."
pb NSCameraUsageDescription string "Club Rival uses the camera only when you choose to add a photo or a video in one of the Rival apps."
pb NSPhotoLibraryUsageDescription string "Club Rival opens your photos only when you choose one to add."
pb ITSAppUsesNonExemptEncryption bool false
pb UIRequiresFullScreen bool true
# CR038 · the coach's ears + Siri: copy in the native files, add them to the project, and point the main screen at them.
cp native/*.swift ios/App/App/
ruby -e "require 'xcodeproj'" 2>/dev/null || gem install xcodeproj --no-document --user-install
ruby native/add-native.rb || { GEM_HOME="$(ruby -e 'print Gem.user_dir')" ruby native/add-native.rb; }
SB=ios/App/App/Base.lproj/Main.storyboard
if grep -q 'customClass="CAPBridgeViewController"' "$SB"; then
  sed -i "" 's/customClass="CAPBridgeViewController" customModule="Capacitor"/customClass="RivalViewController" customModule="App" customModuleProvider="target"/' "$SB"
fi
grep -q 'customClass="RivalViewController"' "$SB" || { echo "CR038: could not point Main.storyboard at RivalViewController"; exit 1; }
# the icon: one 1024 picture, iOS makes every size from it
IC=$(find ios/App/App/Assets.xcassets/AppIcon.appiconset -name "*.png" | head -1)
cp assets/icon-1024.png "$IC"
# the launch screen: plain white, or plain black in dark mode; the Club Rival start screen draws itself in right after.
SP=ios/App/App/Assets.xcassets/Splash.imageset; rm -f "$SP"/*.png; cp assets/splash-light.png "$SP/splash-light.png"; cp assets/splash-dark.png "$SP/splash-dark.png"; cp assets/splash-Contents.json "$SP/Contents.json"
# the build number goes up by one each Codemagic build
if [ -n "${BUILD_NUMBER:-}" ]; then sed -i "" -E "s/CURRENT_PROJECT_VERSION = [0-9]+;/CURRENT_PROJECT_VERSION = ${BUILD_NUMBER};/g" ios/App/App.xcodeproj/project.pbxproj; fi
echo "iPhone project ready: ${PWD}/ios"
