import AppKit
import Foundation

let root = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : FileManager.default.currentDirectoryPath
let frames = URL(fileURLWithPath: root).appendingPathComponent("demo/frames")
try? FileManager.default.createDirectory(at: frames, withIntermediateDirectories: true)

struct Scene {
  let name: String
  let title: String
  let lines: [String]
  let accent: NSColor
}

let scenes: [Scene] = [
  Scene(name: "splash", title: "Cup Pulse", lines: ["P2P Fan War Room — Tether Developers Cup", "Pears Stack · No central server"], accent: NSColor(calibratedRed: 0.13, green: 0.77, blue: 0.22, alpha: 1)),
  Scene(name: "overview", title: "Pipeline dashboard", lines: ["Open pledges · Weighted confidence", "Critical predictions · Overdue tasks", "USA vs Germany QF — Critical risk", "Spain to Final — Commit · Low risk"], accent: NSColor.white),
  Scene(name: "maya", title: "Organizer: Maya Chen", lines: ["Filter predictions & fan clubs by lead", "Metro Ultras NYC · London Terrace Collective", "2 critical · 1 overdue watch-party task"], accent: NSColor(calibratedRed: 0.13, green: 0.77, blue: 0.22, alpha: 1)),
  Scene(name: "peers", title: "2 peers · synced", lines: ["npm start", "npm run start:peer", "Hyperswarm + Hypercore — no FastAPI"], accent: NSColor(calibratedRed: 0.13, green: 0.77, blue: 0.22, alpha: 1)),
  Scene(name: "prediction", title: "Add prediction", lines: ["Argentina vs France — penalty shootout", "Final · 55% confidence · Best Case", "Synced peer-to-peer in seconds"], accent: NSColor.white),
  Scene(name: "jordan", title: "Organizer: Jordan Lee", lines: ["Bay Area Kickoff Crew", "Spain to reach Final — Commit", "Healthy fan club · active engagement"], accent: NSColor(calibratedRed: 0.13, green: 0.77, blue: 0.22, alpha: 1)),
  Scene(name: "outro", title: "Built on the Pears Stack", lines: ["Pear runtime · Hyperswarm · Hypercore · Corestore", "Bare workers · Electron · cup-pulse-pear"], accent: NSColor(calibratedRed: 0.13, green: 0.77, blue: 0.22, alpha: 1))
]

let size = NSSize(width: 1280, height: 900)

for scene in scenes {
  let image = NSImage(size: size)
  image.lockFocus()

  let bg = NSGradient(colors: [
    NSColor(calibratedRed: 0.04, green: 0.12, blue: 0.07, alpha: 1),
    NSColor(calibratedRed: 0.03, green: 0.08, blue: 0.05, alpha: 1)
  ])!
  bg.draw(in: NSRect(origin: .zero, size: size), angle: 135)

  let eyebrow = "TETHER DEVELOPERS CUP · PEARS STACK"
  let eyebrowAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 18, weight: .semibold),
    .foregroundColor: NSColor(calibratedRed: 0.13, green: 0.77, blue: 0.22, alpha: 1)
  ]
  eyebrow.draw(at: NSPoint(x: 80, y: 760), withAttributes: eyebrowAttrs)

  let titleAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 52, weight: .bold),
    .foregroundColor: scene.accent
  ]
  scene.title.draw(at: NSPoint(x: 80, y: 660), withAttributes: titleAttrs)

  var y = 560.0
  let lineAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 28, weight: .regular),
    .foregroundColor: NSColor(calibratedWhite: 0.88, alpha: 1)
  ]
  for line in scene.lines {
    line.draw(at: NSPoint(x: 80, y: y), withAttributes: lineAttrs)
    y -= 52
  }

  image.unlockFocus()

  guard let tiff = image.tiffRepresentation,
        let rep = NSBitmapImageRep(data: tiff),
        let png = rep.representation(using: .png, properties: [:]) else {
    fputs("Failed to render \(scene.name)\n", stderr)
    exit(1)
  }

  let out = frames.appendingPathComponent("\(scene.name).png")
  try png.write(to: out)
  print("Rendered \(out.path)")
}
