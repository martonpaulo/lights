// Prints one line per on-screen window: id, owning process id, owner name, title.
// A browser cannot print its own CGWindowID, so scripts/screenshot.mjs establishes
// ownership by the process id it launched and refuses to capture unless exactly
// one window belongs to it. Nothing here reads or captures anything.
import CoreGraphics
import Foundation

let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
for window in windows where (window[kCGWindowLayer as String] as? Int) == 0 {
    let id = window[kCGWindowNumber as String] as? Int ?? -1
    let pid = window[kCGWindowOwnerPID as String] as? Int ?? -1
    let owner = window[kCGWindowOwnerName as String] as? String ?? ""
    let title = window[kCGWindowName as String] as? String ?? ""
    let bounds = window[kCGWindowBounds as String] as? [String: Any] ?? [:]
    let width = Int((bounds["Width"] as? Double) ?? 0)
    let height = Int((bounds["Height"] as? Double) ?? 0)
    print("\(id)\t\(pid)\t\(width)x\(height)\t\(owner)\t\(title)")
}
