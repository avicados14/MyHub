import XCTest
@testable import MyHubCore

final class ContractTests: XCTestCase {
    func fixture() throws -> Data {
        try Data(contentsOf: Bundle.module.url(forResource: "backup", withExtension: "json")!)
    }
    func testWebNativeWebRoundTrip() throws {
        let bytes = try fixture()
        let backup = try Backup.decode(bytes)
        let encoded = try backup.encoded()
        XCTAssertEqual(try JSONSerialization.jsonObject(with: bytes) as? NSDictionary,
                       try JSONSerialization.jsonObject(with: encoded) as? NSDictionary)
        XCTAssertEqual(backup.data.meals[0].id, "meal-batch")
        XCTAssertEqual(backup.data.meals[0].date, "2026-01-05")
        XCTAssertEqual(backup.data.recipes[0].ingredients[2].quantity, nil)
    }
    func testRejectsUnsupportedAndMalformedWithoutOverwrite() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = LocalStore(url: directory.appendingPathComponent("data.json"))
        let original = try Backup.decode(fixture())
        try store.save(original)
        for mutation in ["future", "legacy", "nested", "unknown"] {
            var envelope = try JSONSerialization.jsonObject(with: fixture()) as! [String: Any]
            if mutation == "future" { envelope["formatVersion"] = 3 }
            if mutation == "legacy" { envelope["formatVersion"] = 1 }
            if mutation == "nested" { var data = envelope["data"] as! [String: Any]; data["recipes"] = [[:]]; envelope["data"] = data }
            if mutation == "unknown" { var data = envelope["data"] as! [String: Any]; data["unsupportedField"] = true; envelope["data"] = data }
            XCTAssertThrowsError(try Backup.decode(JSONSerialization.data(withJSONObject: envelope)))
            XCTAssertEqual(try store.load(), original)
        }
    }
    func testWebMigratedLegacyBackupRoundTrip() throws {
        let bytes = try Data(contentsOf: Bundle.module.url(forResource: "migrated-backup", withExtension: "json")!)
        let backup = try Backup.decode(bytes)
        XCTAssertEqual(try JSONSerialization.jsonObject(with: bytes) as? NSDictionary,
                       try JSONSerialization.jsonObject(with: backup.encoded()) as? NSDictionary)
        XCTAssertFalse(backup.data.recipes.contains { $0.id == "legacy-demo-recipe" })
        XCTAssertFalse(backup.data.events.contains { $0.id == "legacy-demo-study" })
        XCTAssertEqual(backup.data.settings.groceryStaples.first?.name, "Synthetic oats")
    }
    func testLocalDateAndSnapshots() throws {
        XCTAssertEqual(try LocalDate("2026-03-08").value, "2026-03-08")
        XCTAssertThrowsError(try LocalDate("2026-02-30"))
        var backup = try Backup.decode(fixture())
        let log = backup.data.foodLog[0]
        let history = backup.data.groceryHistory[0]
        backup.data.recipes[0].nutritionPerServing.calories = 9999
        XCTAssertEqual(backup.data.foodLog[0], log)
        XCTAssertEqual(backup.data.groceryHistory[0], history)
    }
}
