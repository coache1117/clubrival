// CLUB RIVAL · CR038 · Siri. "Hey Siri, talk to my coach in Club Rival" opens the app with the coach already listening.
// Each one opens the app and leaves a one-word note; the page reads it once (CoachSpeech.takeSiri) and acts.
import AppIntents
import Foundation

@available(iOS 16.0, *)
enum RivalSiriNote {
    static func leave(_ what: String) { UserDefaults.standard.set(what, forKey: "rival_siri_do") }
}

@available(iOS 16.0, *)
struct TalkToCoachIntent: AppIntent {
    static let title: LocalizedStringResource = "Talk to my coach"
    static let openAppWhenRun: Bool = true
    @MainActor func perform() async throws -> some IntentResult { RivalSiriNote.leave("coach"); return .result() }
}

@available(iOS 16.0, *)
struct OpenRankUpIntent: AppIntent {
    static let title: LocalizedStringResource = "Open RankUp"
    static let openAppWhenRun: Bool = true
    @MainActor func perform() async throws -> some IntentResult { RivalSiriNote.leave("app:rankup"); return .result() }
}

@available(iOS 16.0, *)
struct OpenRepIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Rep Rival"
    static let openAppWhenRun: Bool = true
    @MainActor func perform() async throws -> some IntentResult { RivalSiriNote.leave("app:rep"); return .result() }
}

@available(iOS 16.0, *)
struct OpenStrideIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Stride Rival"
    static let openAppWhenRun: Bool = true
    @MainActor func perform() async throws -> some IntentResult { RivalSiriNote.leave("app:stride"); return .result() }
}

@available(iOS 16.0, *)
struct TheMomentIntent: AppIntent {
    static let title: LocalizedStringResource = "Start The Moment"
    static let openAppWhenRun: Bool = true
    @MainActor func perform() async throws -> some IntentResult { RivalSiriNote.leave("app:mindrival:moment"); return .result() }
}

@available(iOS 16.0, *)
struct RivalShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: TalkToCoachIntent(), phrases: [
            "Talk to my coach in \(.applicationName)",
            "Open my coach in \(.applicationName)",
            "Coach me in \(.applicationName)"
        ], shortTitle: "Talk to my coach", systemImageName: "waveform")
        AppShortcut(intent: OpenRankUpIntent(), phrases: [
            "Open RankUp in \(.applicationName)",
            "Box in \(.applicationName)"
        ], shortTitle: "RankUp", systemImageName: "figure.boxing")
        AppShortcut(intent: OpenRepIntent(), phrases: [
            "Open Rep Rival in \(.applicationName)",
            "Lift in \(.applicationName)"
        ], shortTitle: "Rep Rival", systemImageName: "dumbbell")
        AppShortcut(intent: OpenStrideIntent(), phrases: [
            "Open Stride in \(.applicationName)",
            "Walk in \(.applicationName)"
        ], shortTitle: "Stride Rival", systemImageName: "figure.walk")
        AppShortcut(intent: TheMomentIntent(), phrases: [
            "Start The Moment in \(.applicationName)",
            "Lock in with \(.applicationName)"
        ], shortTitle: "The Moment", systemImageName: "brain.head.profile")
    }
}
