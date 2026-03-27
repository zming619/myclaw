import ApplicationServices
import AppKit
import Foundation

struct AXNode {
    let role: String
    let subrole: String?
    let title: String?
    let value: String?
    let description: String?
    let identifier: String?
    let position: CGPoint?
    let size: CGSize?
    let children: [AXNode]
}

enum AXDumpError: Error, LocalizedError {
    case usage
    case processMissing(String)
    case appLookupFailed

    var errorDescription: String? {
        switch self {
        case .usage:
            return "Usage: dump_ax_tree <process-name-or-pid> [max-depth]"
        case let .processMissing(name):
            return "未找到进程：\(name)"
        case .appLookupFailed:
            return "无法创建 Accessibility 应用句柄。"
        }
    }
}

func axString(_ element: AXUIElement, _ attribute: CFString) -> String? {
    var value: CFTypeRef?
    let result = AXUIElementCopyAttributeValue(element, attribute, &value)
    guard result == .success, let value else {
        return nil
    }

    if CFGetTypeID(value) == CFStringGetTypeID() {
        return value as? String
    }
    if CFGetTypeID(value) == AXValueGetTypeID() {
        return nil
    }
    return String(describing: value)
}

func axPoint(_ element: AXUIElement, _ attribute: CFString) -> CGPoint? {
    var value: CFTypeRef?
    let result = AXUIElementCopyAttributeValue(element, attribute, &value)
    guard result == .success,
          let value,
          CFGetTypeID(value) == AXValueGetTypeID()
    else {
        return nil
    }

    let axValue = value as! AXValue
    var point = CGPoint.zero
    guard AXValueGetType(axValue) == .cgPoint, AXValueGetValue(axValue, .cgPoint, &point) else {
        return nil
    }
    return point
}

func axSize(_ element: AXUIElement, _ attribute: CFString) -> CGSize? {
    var value: CFTypeRef?
    let result = AXUIElementCopyAttributeValue(element, attribute, &value)
    guard result == .success,
          let value,
          CFGetTypeID(value) == AXValueGetTypeID()
    else {
        return nil
    }

    let axValue = value as! AXValue
    var size = CGSize.zero
    guard AXValueGetType(axValue) == .cgSize, AXValueGetValue(axValue, .cgSize, &size) else {
        return nil
    }
    return size
}

func axChildren(_ element: AXUIElement) -> [AXUIElement] {
    var value: CFTypeRef?
    let result = AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &value)
    guard result == .success, let array = value as? [AXUIElement] else {
        return []
    }
    return array
}

func dumpNode(_ element: AXUIElement, depth: Int, maxDepth: Int) -> AXNode {
    let children: [AXNode]
    if depth >= maxDepth {
        children = []
    } else {
        children = axChildren(element).map { dumpNode($0, depth: depth + 1, maxDepth: maxDepth) }
    }

    return AXNode(
        role: axString(element, kAXRoleAttribute as CFString) ?? "unknown",
        subrole: axString(element, kAXSubroleAttribute as CFString),
        title: axString(element, kAXTitleAttribute as CFString),
        value: axString(element, kAXValueAttribute as CFString),
        description: axString(element, kAXDescriptionAttribute as CFString),
        identifier: axString(element, kAXIdentifierAttribute as CFString),
        position: axPoint(element, kAXPositionAttribute as CFString),
        size: axSize(element, kAXSizeAttribute as CFString),
        children: children
    )
}

func printNode(_ node: AXNode, indent: String = "") {
    var parts = [node.role]
    if let subrole = node.subrole, !subrole.isEmpty {
        parts.append("subrole=\(subrole)")
    }
    if let title = node.title, !title.isEmpty {
        parts.append("title=\(title)")
    }
    if let value = node.value, !value.isEmpty {
        parts.append("value=\(value)")
    }
    if let description = node.description, !description.isEmpty {
        parts.append("desc=\(description)")
    }
    if let identifier = node.identifier, !identifier.isEmpty {
        parts.append("id=\(identifier)")
    }
    if let position = node.position, let size = node.size {
        parts.append("frame=\(Int(position.x)),\(Int(position.y)),\(Int(size.width)),\(Int(size.height))")
    }
    print(indent + parts.joined(separator: " | "))
    for child in node.children {
        printNode(child, indent: indent + "  ")
    }
}

do {
    let args = Array(CommandLine.arguments.dropFirst())
    guard let target = args.first else {
        throw AXDumpError.usage
    }
    let maxDepth = args.count > 1 ? max(Int(args[1]) ?? 4, 1) : 4

    let processID: pid_t
    if let numericPID = Int32(target) {
        processID = numericPID
    } else {
        let runningApps = NSRunningApplication.runningApplications(withBundleIdentifier: "com.tencent.xinWeChat")
        let targetApp = runningApps.first(where: { ($0.localizedName ?? "") == target }) ??
            NSWorkspace.shared.runningApplications.first(where: { ($0.localizedName ?? "") == target })

        guard let app = targetApp else {
            throw AXDumpError.processMissing(target)
        }
        processID = app.processIdentifier
    }

    let appElement = AXUIElementCreateApplication(processID)
    var windowValue: CFTypeRef?
    let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowValue)
    guard result == .success, let windows = windowValue as? [AXUIElement], let window = windows.first else {
        throw AXDumpError.appLookupFailed
    }

    let root = dumpNode(window, depth: 0, maxDepth: maxDepth)
    printNode(root)
} catch {
    let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}
