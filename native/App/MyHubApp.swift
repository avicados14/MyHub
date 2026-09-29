import SwiftUI
import UniformTypeIdentifiers
import MyHubCore

@main
struct MyHubApp: App {
    @StateObject private var model = AppModel()
    var body: some Scene { WindowGroup { RootView().environmentObject(model) } }
}

@MainActor
final class AppModel: ObservableObject {
    @Published var backup: Backup?
    @Published var message: String?
    private let store: LocalStore
    init() {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        store = LocalStore(url: directory.appendingPathComponent("MyHub/data.json"))
        if FileManager.default.fileExists(atPath: store.url.path) {
            do { backup = try store.load() }
            catch { message = "Saved data could not be opened. It has not been replaced." }
        }
    }
    func replace(with candidate: Backup) {
        do { try store.save(candidate); backup = candidate; message = "Backup imported on this device." }
        catch { message = "The import could not be saved. Existing data has been retained." }
    }
}

enum Section: String, CaseIterable, Identifiable {
    case home = "Home", calendar = "Calendar", school = "School", food = "Food", settings = "Settings"
    var id: Self { self }
    var icon: String {
        switch self { case .home: return "house"; case .calendar: return "calendar"; case .school: return "book"; case .food: return "fork.knife"; case .settings: return "gear" }
    }
}

struct RootView: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selection: Section? = .home
    var body: some View {
        if sizeClass == .regular {
            NavigationSplitView {
                List(Section.allCases, selection: $selection) { section in Label(section.rawValue, systemImage: section.icon).tag(section) }
                .navigationTitle("MyHub")
            } detail: { NavigationStack { SectionView(section: selection ?? .home) } }
        } else {
            TabView {
                ForEach(Section.allCases) { section in
                    NavigationStack { SectionView(section: section) }
                        .tabItem { Label(section.rawValue, systemImage: section.icon) }
                }
            }
        }
    }
}

struct SectionView: View {
    @EnvironmentObject private var model: AppModel
    let section: Section
    var body: some View {
        Group {
            if section == .settings { SettingsView() }
            else if let data = model.backup?.data {
                List {
                    switch section {
                    case .home:
                        LabeledContent("Calendar events", value: String(data.events.count))
                        LabeledContent("Homework", value: String(data.assignments.count))
                        LabeledContent("Recipes", value: String(data.recipes.count))
                        Text("This native foundation provides offline backup viewing. Editing and integrations await workflow acceptance.")
                    case .calendar:
                        ForEach(Domain.visibleEvents(data).sorted { ($0.date, $0.startTime, $0.id) < ($1.date, $1.startTime, $1.id) }, id: \.id) { event in
                            VStack(alignment: .leading) { Text(event.title).font(.headline); Text("\(event.date) · \(event.startTime)–\(event.endTime)").font(.subheadline) }
                        }
                    case .school:
                        NavigationLink("Preview study plan") { StudyPreviewView(data: data) }
                        ForEach(Domain.rankAssignments(Domain.visibleAssignments(data)), id: \.id) { task in
                            VStack(alignment: .leading) { Text(task.title).font(.headline); Text("\(task.course) · Due \(task.dueDate) \(task.dueTime)"); Text(task.status).font(.caption) }
                        }
                    case .food:
                        ForEach(data.recipes, id: \.id) { recipe in
                            NavigationLink(recipe.name) {
                                RecipeDetailView(recipe: recipe)
                            }
                        }
                    case .settings: EmptyView()
                    }
                }
            } else {
                ContentUnavailableView("No local backup", systemImage: "tray", description: Text("Import a MyHub JSON backup in Settings to start. Nothing is downloaded automatically."))
            }
        }.navigationTitle(section.rawValue)
    }
}

struct BackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var bytes: Data
    init(bytes: Data) { self.bytes = bytes }
    init(configuration: ReadConfiguration) throws { bytes = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: bytes) }
}

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var importing = false
    @State private var exporting = false
    @State private var candidate: Backup?
    @State private var confirm = false
    @State private var document = BackupDocument(bytes: Data())
    var body: some View {
        Form {
            Text("JSON backups are plaintext and can contain private records. This build stores data only on this device.")
            Button("Import JSON backup") { importing = true }
            Button("Export JSON backup") {
                do {
                    guard let backup = model.backup else { return }
                    document = BackupDocument(bytes: try backup.encoded()); exporting = true
                } catch { model.message = "Export could not be prepared." }
            }.disabled(model.backup == nil)
            if let message = model.message { Text(message).accessibilityLabel(message) }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                candidate = try Backup.decode(Data(contentsOf: url)); confirm = true
            } catch BackupError.legacyRequiresWebMigration {
                model.message = "Import this version 1 backup into the web app and export version 2 first. Existing data was retained."
            } catch { model.message = "Unsupported or incomplete backup. Existing data was retained." }
        }
        .confirmationDialog("Replace this device’s data?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Replace local data", role: .destructive) { if let candidate { model.replace(with: candidate) }; candidate = nil }
            Button("Cancel", role: .cancel) { candidate = nil }
        } message: {
            Text("Import \(candidate?.data.events.count ?? 0) events, \(candidate?.data.assignments.count ?? 0) assignments and \(candidate?.data.recipes.count ?? 0) recipes. Export existing data first if you need to keep it.")
        }
        .fileExporter(isPresented: $exporting, document: document, contentType: .json, defaultFilename: "myhub-backup") { result in
            if case .failure = result { model.message = "Export was not completed." }
        }
    }
}


struct RecipeDetailView: View {
    let recipe: Recipe
    @State private var servings: Double
    init(recipe: Recipe) {
        self.recipe = recipe
        _servings = State(initialValue: NSDecimalNumber(decimal: recipe.currentYield ?? recipe.originalYield).doubleValue)
    }
    var body: some View {
        List {
            Text(recipe.description)
            Stepper("Servings: \(Domain.formatQuantity(Decimal(servings)))", value: $servings, in: 0.5...100, step: 0.5)
            if let ingredients = try? Domain.scaledIngredients(recipe, servings: Decimal(servings)) {
                ForEach(ingredients, id: \.id) { ingredient in
                    Text("\(ingredient.quantity.map(Domain.formatQuantity) ?? "To taste") \(ingredient.unit) \(ingredient.name)")
                }
            } else { Text("This recipe needs a valid original yield before it can be scaled.") }
            ForEach(recipe.steps, id: \.id) { Text($0.text) }
            Text("Scaling is a preview. Original quantities and historical meals stay unchanged.").font(.footnote)
        }.navigationTitle(recipe.name)
    }
}

struct StudyPreviewView: View {
    let data: AppData
    @State private var startDate: String
    @State private var preview: StudyPreview?
    @State private var error: String?
    init(data: AppData) {
        self.data = data
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: data.settings.calendarTimeZone ?? "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        _startDate = State(initialValue: formatter.string(from: Date()))
    }
    var body: some View {
        Form {
            TextField("Start date (YYYY-MM-DD)", text: $startDate)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
            Button("Generate preview") {
                do { preview = try Domain.studyPreview(data, startDate: startDate); error = nil }
                catch { preview = nil; self.error = "Check the date, time zone and study settings. Nothing was saved." }
            }
            if let error { Text(error) }
            if let preview {
                LabeledContent("Unscheduled minutes", value: String(preview.unscheduledMinutes))
                ForEach(Array(preview.blocks.enumerated()), id: \.offset) { _, block in
                    VStack(alignment: .leading) {
                        Text(data.assignments.first { $0.id == block.assignmentId }?.title ?? "Homework").font(.headline)
                        Text("\(block.date) · \(block.startTime)–\(block.endTime)")
                    }
                }
                Text("Preview only. Locked, completed and adjusted study blocks are retained; this does not replace your calendar.").font(.footnote)
            }
        }.navigationTitle("Study preview")
    }
}
