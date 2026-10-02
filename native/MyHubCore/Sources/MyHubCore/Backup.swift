import Foundation
import CoreFoundation

public enum BackupError: Error { case unsupported, invalid, legacyRequiresWebMigration }

public struct Backup: Codable, Equatable {
    public var format: String
    public var formatVersion: Int
    public var appVersion: String
    public var exportedAt: String
    public var data: AppData

    public static func decode(_ bytes: Data) throws -> Backup {
        guard let envelope = try JSONSerialization.jsonObject(with: bytes) as? [String: Any],
              envelope["format"] as? String == "myhub-backup",
              let version = envelope["formatVersion"] as? NSNumber,
              CFGetTypeID(version) != CFBooleanGetTypeID() else { throw BackupError.unsupported }
        if version == 1 { throw BackupError.legacyRequiresWebMigration }
        guard version == 2, let data = envelope["data"] else { throw BackupError.unsupported }
        let schemaURL = Bundle.module.url(forResource: "app-data.schema", withExtension: "json")!
        let schema = try JSONSerialization.jsonObject(with: Data(contentsOf: schemaURL)) as! [String: Any]
        guard let definitions = schema["$defs"] as? [String: [String: Any]],
              matches(data, schema, definitions) else { throw BackupError.invalid }
        return try JSONDecoder().decode(Backup.self, from: bytes)
    }

    public func encoded() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let bytes = try encoder.encode(self)
        _ = try Self.decode(bytes)
        return bytes
    }
}

// The exact schema subset generated from TypeScript; rejects unknown fields instead of silently dropping them.
private func matches(_ value: Any, _ shape: [String: Any], _ definitions: [String: [String: Any]]) -> Bool {
    if let ref = shape["$ref"] as? String {
        guard let definition = definitions[String(ref.split(separator: "/").last!)] else { return false }
        return matches(value, definition, definitions)
    }
    if let alternatives = shape["anyOf"] as? [[String: Any]] {
        return alternatives.contains { matches(value, $0, definitions) }
    }
    if let constant = shape["const"] {
        if let number = constant as? NSNumber {
            guard let other = value as? NSNumber,
                  (CFGetTypeID(number) == CFBooleanGetTypeID()) == (CFGetTypeID(other) == CFBooleanGetTypeID()) else { return false }
            return number == other
        }
        return (constant as? String) == (value as? String)
    }
    switch shape["type"] as? String {
    case "null": return value is NSNull
    case "string": return value is String
    case "boolean": return (value as? NSNumber).map { CFGetTypeID($0) == CFBooleanGetTypeID() } ?? false
    case "number": return (value as? NSNumber).map { CFGetTypeID($0) != CFBooleanGetTypeID() && $0.doubleValue.isFinite } ?? false
    case "array":
        guard let items = value as? [Any], let itemShape = shape["items"] as? [String: Any] else { return false }
        return items.allSatisfy { matches($0, itemShape, definitions) }
    case "object":
        guard let record = value as? [String: Any], let properties = shape["properties"] as? [String: [String: Any]],
              let required = shape["required"] as? [String], required.allSatisfy({ record.keys.contains($0) }) else { return false }
        return record.allSatisfy { key, item in properties[key].map { matches(item, $0, definitions) } ?? false }
    default: return false
    }
}

/// A local calendar date is never interpreted as midnight UTC.
public struct LocalDate: Equatable, Comparable {
    public let value: String
    public init(_ value: String) throws {
        let parts = value.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]), year > 0 else { throw BackupError.invalid }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let components = DateComponents(year: year, month: month, day: day)
        guard let date = calendar.date(from: components), calendar.component(.year, from: date) == year, calendar.component(.month, from: date) == month, calendar.component(.day, from: date) == day else { throw BackupError.invalid }
        self.value = value
    }
    public static func < (lhs: Self, rhs: Self) -> Bool { lhs.value < rhs.value }
}

/// A single offline document keeps related records atomic until a reviewed indexed model is needed.
public struct LocalStore {
    public let url: URL
    public init(url: URL) { self.url = url }
    public func load() throws -> Backup { try Backup.decode(Data(contentsOf: url)) }
    public func save(_ backup: Backup) throws {
        let bytes = try backup.encoded()
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        #if os(iOS)
        try bytes.write(to: url, options: [.atomic, .completeFileProtection])
        #else
        try bytes.write(to: url, options: .atomic)
        #endif
    }
}
