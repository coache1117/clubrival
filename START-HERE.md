# Club Rival - the iPhone app · CR038

This folder is the iPhone wrapper for **clubrival.netlify.app**. The app opens the live site inside a real iPhone app.
When you put a new build on the site, the app gets it too. No new upload needed for normal updates.

Club Rival is the front door: your level, your schedule, your Pro Panel, and a card for every Rival app. Stride, Rep, RankUp, Mind and Rest Rival open INSIDE this app, and the Club Rival chip brings you back. Ride Flow BMX and Trail Rival open in Safari.

- App name: **Club Rival**
- Bundle ID: **com.clubrival.app**  (if Apple says it is taken, change it in `capacitor.config.json` AND `codemagic.yaml`)
- Built by: **Codemagic**, with the same Apple key as the RideFlow apps (label: RideFlow App Store key).

## What you do

1. **Make the app ID.** developer.apple.com > Account > Identifiers > + > App IDs > App.
   Description: `Club Rival`. Bundle ID: Explicit, `com.clubrival.app`. Continue, Register.
2. **Make the app in App Store Connect.** appstoreconnect.apple.com > Apps > + > New App.
   Platform iOS, name `Club Rival`, language English, bundle ID `com.clubrival.app`, SKU `club-rival`.
3. **Put this folder on GitHub.** github.com > New repository > name `club-rival-ios`, Private > Create.
   Then "uploading an existing file", drag in everything in this folder, Commit to `main`.
4. **Codemagic.** codemagic.io > Add application > pick `club-rival-ios`. It finds `codemagic.yaml` on its own.
5. **Signing.** Codemagic > Team settings > Code signing identities > iOS provisioning profiles > Fetch profiles >
   pick the App Store profile for `com.clubrival.app`.
   (If none shows: developer.apple.com > Profiles > + > App Store Connect > pick `com.clubrival.app` > your Apple Distribution
   certificate > Generate. Then Fetch again.)
6. **Build.** Codemagic > club-rival-ios > Start new build > workflow `Club Rival - iPhone`. About 15-25 minutes. Green = it went to TestFlight.
7. **On your phone.** App Store Connect > Club Rival > TestFlight > add yourself as an internal tester. Install it from the TestFlight app.

## Test on the phone

1. Sign in with your email code.
2. Tap + ADD TO MY SCHEDULE, add a run for today. It shows on the schedule.
3. Tap the Stride Rival card. Stride opens inside the app. Tap the CLUB RIVAL chip to come back.
4. Close the app all the way and open it again. You are still signed in.

## Good to know

- This gets you onto TestFlight for your own testers. Sending it to Apple for public review also needs screenshots,
  a description, a privacy policy link, a support link and the privacy label.
- The words Apple shows when it asks for a permission are in `scripts/ios-setup.sh`.

## CR023 logo
The new Club Rival logo (CR in the seven-color ring) is the app icon and the opening screen. Rebuild in Codemagic to get it on the phone.

## CR030
Money Rival and Rise Rival now open inside the Club app (they used to jump out to Safari). Rise Rival has its own tile next to Rest Rival.

## CR038 · the coach's ears + Siri (needs a new Codemagic build)
- The coach listens with the iPhone's own speech engine, so hands-free keeps going: no tap after every answer.
- The mic in Rep, RankUp and Mind Rival (when you open them inside this app) keeps listening too: tap it once, then "Coach, start" / "Coach, stop round" / "Coach, 12 reps at 40".
- Siri: "Hey Siri, talk to my coach in Club Rival" · "Open RankUp in Club Rival" · "Lift in Club Rival" · "Walk in Club Rival" · "Start The Moment in Club Rival".
- First time you talk, iPhone asks to allow Speech Recognition and the Microphone. Say Allow to both.
- New files: `native/` (the coach's ears, Siri). The setup script adds them to the project by itself.
- If the Codemagic build stops at "could not point Main.storyboard", send me the log.
