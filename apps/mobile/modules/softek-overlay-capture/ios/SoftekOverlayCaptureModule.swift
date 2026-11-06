import ExpoModulesCore
import UIKit

private struct OverlayCaptureError: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}

// Used by the local fixture and opt-in experimental banking window capture.
// The caller enforces session eligibility; baseline capture stays in capture-file.ts.
public class SoftekOverlayCaptureModule: Module {
  private var keyboardFrames: [CGRect] = []
  private var observers: [NSObjectProtocol] = []
  private var capturing = false
  private var directory: URL {
    FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("softek-overlay-check", isDirectory: true)
  }

  public func definition() -> ModuleDefinition {
    Name("SoftekOverlayCapture")

    OnCreate {
      // Register before the fixture loads. Retain both old/new keyboard bounds
      // during animation; the draw clip excludes these pixels before rendering.
      for name in [UIResponder.keyboardWillChangeFrameNotification,
                   UIResponder.keyboardDidChangeFrameNotification,
                   UIResponder.keyboardDidHideNotification] {
        let observer = NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] event in
          guard let self else { return }
          if event.name == UIResponder.keyboardDidHideNotification {
            self.keyboardFrames = []
          } else if let value = event.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue {
            let frame = value.cgRectValue
            if event.name == UIResponder.keyboardWillChangeFrameNotification {
              self.keyboardFrames = Array((self.keyboardFrames + [frame]).suffix(2))
            } else {
              self.keyboardFrames = [frame]
            }
          }
        }
        self.observers.append(observer)
      }
    }
    OnDestroy {
      for observer in self.observers { NotificationCenter.default.removeObserver(observer) }
      self.observers = []
    }

    AsyncFunction("prepare") { () throws -> Bool in
      do {
        try FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true,
          attributes: [.protectionKey: FileProtectionType.complete])
        for file in try FileManager.default.contentsOfDirectory(at: self.directory, includingPropertiesForKeys: nil) {
          if file.pathExtension == "jpg" { try FileManager.default.removeItem(at: file) }
        }
        return true
      } catch { throw OverlayCaptureError(message: "Local candidate storage unavailable") }
    }.runOnQueue(.main)

    AsyncFunction("capture") { (tag: Int) throws -> [String: Any] in
      guard !self.capturing else { throw OverlayCaptureError(message: "Candidate capture already in progress") }
      self.capturing = true
      defer { self.capturing = false }
      guard UIApplication.shared.applicationState == .active,
            let view = self.appContext?.findView(withTag: tag, ofType: UIView.self),
            let window = view.window,
            let scene = window.windowScene, scene.activationState == .foregroundActive,
            !view.isHidden, view.alpha > 0,
            window.windowLevel == .normal else {
        throw OverlayCaptureError(message: "Candidate view or foreground window unavailable")
      }
      let rect = view.convert(view.bounds, to: window)
      guard rect.width.isFinite, rect.height.isFinite, rect.minX.isFinite, rect.minY.isFinite,
            rect.width >= 40, rect.height >= 40,
            window.bounds.insetBy(dx: -0.5, dy: -0.5).contains(rect) else {
        throw OverlayCaptureError(message: "Candidate crop is outside its owning window")
      }
      // Accept the modal hosting the fixture, or a popover anchored inside it.
      // Unrelated presented controllers fail closed; no private class-name tests.
      var controller = window.rootViewController
      var popover = false
      while let presented = controller?.presentedViewController {
        if view.isDescendant(of: presented.view) {
          controller = presented
          continue
        }
        guard let presentation = presented.popoverPresentationController,
              let source = presentation.sourceView,
              source === view || source.isDescendant(of: view),
              source.convert(presentation.sourceRect, to: window).intersects(rect) else {
          throw OverlayCaptureError(message: "Unrecognized native presentation; candidate skipped")
        }
        popover = true
        controller = presented
      }
      let width = 720
      let height = Int((CGFloat(width) * rect.height / rect.width).rounded())
      guard height > 0, height <= 4096, width * height <= 4_000_000 else {
        throw OverlayCaptureError(message: "Candidate image dimensions exceed limits")
      }
      let scale = CGFloat(width) / rect.width
      let started = CACurrentMediaTime()
      let capturedAt = Date()
      var success = false
      var maskCount = 0
      var visibleBottom = rect.maxY
      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.opaque = true
      let image = UIGraphicsImageRenderer(size: CGSize(width: CGFloat(width), height: CGFloat(height)), format: format).image { context in
        UIColor(red: 245/255, green: 246/255, blue: 241/255, alpha: 1).setFill()
        context.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
        context.cgContext.scaleBy(x: scale, y: scale)
        context.cgContext.translateBy(x: -rect.minX, y: -rect.minY)
        // Intersect with only the area above any keyboard rectangle. This avoids
        // overlapping even-odd masks re-exposing keyboard pixels during animation.
        var bottom = rect.maxY
        for screenFrame in self.keyboardFrames {
          let frame = window.convert(screenFrame, from: window.screen.coordinateSpace)
          let intersection = frame.intersection(rect)
          if !intersection.isNull && !intersection.isEmpty {
            bottom = min(bottom, intersection.minY)
            maskCount += 1
          }
        }
        context.cgContext.clip(to: CGRect(x: rect.minX, y: rect.minY, width: rect.width,
          height: max(0, bottom - rect.minY)))
        visibleBottom = bottom
        success = window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
      }
      guard success, UIApplication.shared.applicationState == .active, view.window === window,
            scene.activationState == .foregroundActive else {
        throw OverlayCaptureError(message: "Candidate drawing unavailable or interrupted")
      }
      guard let data = image.jpegData(compressionQuality: 0.7),
            !data.isEmpty, data.count <= 1_048_576 else {
        throw OverlayCaptureError(message: "Candidate JPEG is empty or exceeds 1 MiB")
      }
      let file = self.directory.appendingPathComponent(UUID().uuidString + ".jpg")
      do { try data.write(to: file, options: [.atomic, .completeFileProtection]) }
      catch { throw OverlayCaptureError(message: "Candidate file could not be saved") }
      let formatter = ISO8601DateFormatter()
      formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      let visibleHeight = maskCount > 0 ? min(height, max(0, Int(floor((visibleBottom - rect.minY) * scale)))) : height
      let excluded: [[String: Int]] = visibleHeight < height
        ? [["x": 0, "y": visibleHeight, "width": width, "height": height - visibleHeight]] : []
      let imageBounds: [String: Any] = ["width": width, "height": height,
        "valid": ["x": 0, "y": 0, "width": width, "height": visibleHeight], "excluded": excluded]
      return ["uri": file.absoluteString, "bytes": data.count, "width": width, "height": height,
              "capturedAt": formatter.string(from: capturedAt),
              "captureMs": Int(((CACurrentMediaTime() - started) * 1000).rounded()),
              "maskedKeyboard": maskCount > 0, "anchoredPopover": popover, "imageBounds": imageBounds]
    }.runOnQueue(.main)
  }
}
